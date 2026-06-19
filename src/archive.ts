// ツイートのアーカイブ処理。fetch → 永続化 → メディア DL を行い、
// 引用 (quote) とリプライ元 (replying_to_status) を再帰的に辿って保存する。

import {
  getTweet,
  replaceMedia,
  syncFts,
  upsertAuthor,
  upsertTweet,
  type TweetRow,
} from './db.js'
import { fetchTweet, type ApiTweet } from './fxtwitter.js'
import { saveAuthorAssets, saveTweetMedia } from './media.js'

// 再帰アーカイブ 1 回あたりの上限 (暴走・循環防止)。
const MAX_TWEETS_PER_ARCHIVE = 50

type QueueItem =
  | { kind: 'have'; tweet: ApiTweet }
  | { kind: 'fetch'; screenName: string; id: string }

/** 1 ツイートを author/tweet/media/FTS としてすべて保存する。 */
async function persistTweet(tweet: ApiTweet): Promise<void> {
  const author = tweet.author

  // 著者アセット (アバター/バナー) を保存してから authors を upsert。
  const assets = await saveAuthorAssets(author)
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

/**
 * ツイートをアーカイブして DB 行を返す。
 * - 既にアーカイブ済みで refresh でなければ、fetch せず保存済みを返す。
 * - quote は埋め込みオブジェクトをそのまま保存、replying_to_status は再 fetch。
 * - ルート以外で既存のものは再取得しない (refresh の対象はルートのみ)。
 */
export async function archiveTweet(
  screenName: string,
  id: string,
  opts: { refresh?: boolean } = {},
): Promise<TweetRow> {
  const refresh = opts.refresh ?? false
  const existing = getTweet(id)
  if (existing && !refresh) return existing

  const visited = new Set<string>()
  let budget = MAX_TWEETS_PER_ARCHIVE
  const queue: QueueItem[] = [{ kind: 'fetch', screenName, id }]

  while (queue.length > 0 && budget > 0) {
    const item = queue.shift()!
    let tweet: ApiTweet

    if (item.kind === 'have') {
      if (visited.has(item.tweet.id)) continue
      tweet = item.tweet
    } else {
      if (visited.has(item.id)) continue
      // ルート以外で既にアーカイブ済みなら再取得しない。
      if (item.id !== id && getTweet(item.id)) {
        visited.add(item.id)
        continue
      }
      try {
        tweet = await fetchTweet(item.screenName, item.id)
      } catch (err) {
        console.warn(
          `[archive] failed to fetch ${item.screenName}/${item.id}:`,
          err instanceof Error ? err.message : err,
        )
        continue
      }
    }

    visited.add(tweet.id)
    budget--
    await persistTweet(tweet)

    // 引用元: 完全なオブジェクトが埋め込まれているので追加 fetch 不要。
    if (tweet.quote && !visited.has(tweet.quote.id)) {
      queue.push({ kind: 'have', tweet: tweet.quote })
    }
    // リプライ元: id のみなので再 fetch する。
    if (
      tweet.replying_to_status &&
      tweet.replying_to &&
      !visited.has(tweet.replying_to_status)
    ) {
      queue.push({
        kind: 'fetch',
        screenName: tweet.replying_to,
        id: tweet.replying_to_status,
      })
    }
  }

  const root = getTweet(id)
  if (!root) {
    throw new Error(`Failed to archive tweet ${screenName}/${id}`)
  }
  return root
}
