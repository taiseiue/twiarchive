// ツイートのアーカイブ処理。fetch → 永続化 → メディア DL を行う。
// 単発ツイートは /2/conversation/:id を使い、本体・スレッド・引用・返信を
// まとめて保存する。

import {
  getTweet,
  replaceMedia,
  syncFts,
  upsertAuthor,
  upsertTweet,
  type TweetRow,
} from './db.js'
import {
  fetchConversation,
  fetchProfileStatuses,
  type ApiTweet,
} from './fxtwitter.js'
import { saveAuthorAssets, saveTweetMedia } from './media.js'

// 会話アーカイブで辿る返信ページ数の上限。
const MAX_CONVERSATION_PAGES = 10

// プロフィール一括アーカイブで辿るページ数の上限 (1 ページ = 20 件)。
const MAX_PROFILE_PAGES = 60

/**
 * 1 ツイートを author/tweet/media/FTS としてすべて保存する。
 * skipAuthorAssets=true のときはアバター/バナーの再ダウンロードを省く
 * (一括アーカイブで同一著者の画像を何度も取得しないため)。既存のローカル
 * パスは upsert の COALESCE で保持される。
 */
async function persistTweet(
  tweet: ApiTweet,
  opts: { skipAuthorAssets?: boolean } = {},
): Promise<void> {
  const author = tweet.author

  // 著者アセット (アバター/バナー) を保存してから authors を upsert。
  const assets = opts.skipAuthorAssets
    ? { avatarPath: null, bannerPath: null }
    : await saveAuthorAssets(author)
  upsertAuthor({
    id: author.id,
    screen_name: author.screen_name,
    name: author.name,
    description: author.description ?? null,
    avatar_path: assets.avatarPath,
    avatar_url: author.avatar_url ?? null,
    banner_path: assets.bannerPath,
    banner_url: author.banner_url ?? null,
    verified: author.verification?.verified ? 1 : 0,
    raw_json: JSON.stringify(author),
  })

  const media = await saveTweetMedia(tweet)

  upsertTweet({
    id: tweet.id,
    screen_name: author.screen_name,
    author_id: author.id,
    text: tweet.text ?? '',
    created_timestamp: tweet.created_timestamp ?? null,
    lang: tweet.lang ?? null,
    replies: tweet.replies ?? 0,
    retweets: tweet.retweets ?? 0,
    likes: tweet.likes ?? 0,
    bookmarks: tweet.bookmarks ?? 0,
    quotes: tweet.quotes ?? 0,
    views: tweet.views ?? null,
    possibly_sensitive: tweet.possibly_sensitive ? 1 : 0,
    quote_id: tweet.quote?.id ?? null,
    replying_to_id: tweet.replying_to_status ?? null,
    raw_json: JSON.stringify(tweet),
    archived_at: Date.now(),
  })
  replaceMedia(tweet.id, media)
  syncFts({
    tweet_id: tweet.id,
    text: tweet.text ?? '',
    screen_name: author.screen_name,
    name: author.name,
  })
}

/** ツイートと、埋め込まれた引用 (quote) を再帰的に保存する。 */
async function persistWithQuote(
  tweet: ApiTweet,
  assetsSaved: Set<string>,
): Promise<void> {
  await persistTweet(tweet, {
    skipAuthorAssets: assetsSaved.has(tweet.author.id),
  })
  assetsSaved.add(tweet.author.id)
  if (tweet.quote) await persistWithQuote(tweet.quote, assetsSaved)
}

/**
 * 会話 (/2/conversation/:id) をアーカイブして起点ツイートの DB 行を返す。
 * - 起点ツイート・スレッド (親チェーン)・返信・各引用をまとめて保存。
 * - 返信はカーソルでページングしながら取得 (上限あり)。
 * - 既にアーカイブ済みで refresh でなければ fetch せず保存済みを返す。
 */
export async function archiveTweet(
  screenName: string,
  id: string,
  opts: { refresh?: boolean } = {},
): Promise<TweetRow> {
  const refresh = opts.refresh ?? false
  const existing = getTweet(id)
  if (existing && !refresh) return existing

  const assetsSaved = new Set<string>()
  const seen = new Set<string>()
  let cursor: string | undefined
  let pages = 0

  while (pages < MAX_CONVERSATION_PAGES) {
    let convo
    try {
      convo = await fetchConversation(id, cursor)
    } catch (err) {
      // 1 ページ目の失敗はそのまま伝える。2 ページ目以降は「返信がもう無い」扱い。
      if (pages === 0) throw err
      break
    }

    const batch =
      pages === 0
        ? [convo.main, ...convo.thread, ...convo.replies]
        : convo.replies
    pages++

    let newOnPage = 0
    for (const tweet of batch) {
      if (seen.has(tweet.id)) continue
      seen.add(tweet.id)
      await persistWithQuote(tweet, assetsSaved)
      newOnPage++
    }

    if (!convo.cursor || convo.cursor === cursor) break
    if (pages > 1 && newOnPage === 0) break
    cursor = convo.cursor
  }

  const root = getTweet(id)
  if (!root) {
    throw new Error(`Failed to archive tweet ${screenName}/${id}`)
  }
  return root
}

/**
 * プロフィールのタイムラインをページネーションしながら一括アーカイブする。
 * - cursor.bottom を辿り、結果が空 / カーソルが進まなくなったら終了。
 * - refresh でない場合、丸ごと既知のページに到達した時点で打ち切る (差分取得)。
 * - 同一著者のアバター/バナーは 1 回だけダウンロードする。
 * 戻り値は新規保存した件数と辿ったページ数。
 */
export async function archiveProfile(
  screenName: string,
  opts: {
    refresh?: boolean
    onProgress?: (p: { added: number; pages: number }) => void
  } = {},
): Promise<{ added: number; pages: number }> {
  const refresh = opts.refresh ?? false
  const assetsSaved = new Set<string>()
  let cursor: string | undefined
  let added = 0
  let pages = 0

  while (pages < MAX_PROFILE_PAGES) {
    let page
    try {
      page = await fetchProfileStatuses(screenName, cursor)
    } catch (err) {
      // 1 ページ目の失敗 (ユーザー不在/非公開など) は呼び出し元へ伝える。
      if (pages === 0) throw err
      console.warn(
        `[archive] profile page ${pages} of @${screenName} failed:`,
        err instanceof Error ? err.message : err,
      )
      break
    }
    pages++
    if (page.results.length === 0) break

    let newOnPage = 0
    for (const tweet of page.results) {
      if (!refresh && getTweet(tweet.id)) continue
      await persistWithQuote(tweet, assetsSaved)
      added++
      newOnPage++
    }

    opts.onProgress?.({ added, pages })

    // 差分取得: このページが丸ごと既知なら追いついたとみなす。
    if (newOnPage === 0 && !refresh) break
    // カーソルが尽きた / 進まないなら終了。
    if (!page.cursor || page.cursor === cursor) break
    cursor = page.cursor
  }

  return { added, pages }
}
