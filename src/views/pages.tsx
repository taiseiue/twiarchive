// ページ単位のコンポーネント (ホーム / 検索 / ユーザー / プロフィール / 詳細 / エラー)。

import type { Child } from 'hono/jsx'
import type { AuthorListRow, AuthorRow } from '../db.js'
import { Layout } from './Layout.js'
import { TweetCard, TweetDetail, Timeline } from './Tweet.js'
import { avatarSrc, formatCount, mediaUrl, type TweetView } from './model.js'
import {
  IconBack,
  IconCalendar,
  IconImage,
  IconRefresh,
  IconSearch,
  IconVerified,
} from './icons.js'

// 中央カラムのスティッキーヘッダ。
function ColHead(props: { title: string; sub?: string; back?: string }) {
  return (
    <div class="colhead">
      {props.back ? (
        <a class="iconbtn" href={props.back} aria-label="戻る">
          <IconBack size={20} />
        </a>
      ) : null}
      <div>
        <h2>{props.title}</h2>
        {props.sub ? <div class="sub">{props.sub}</div> : null}
      </div>
    </div>
  )
}

function smallAvatar(a: AuthorRow): string {
  return mediaUrl(a.avatar_path) ?? a.avatar_url ?? ''
}

// 右カラム: 検索・アーカイブ追加・ユーザー一覧の抜粋。
function RightSidebar(props: { authors: AuthorListRow[] }) {
  return (
    <>
      <form class="searchbox" method="get" action="/search">
        <IconSearch />
        <input type="text" name="q" placeholder="検索" aria-label="アーカイブを検索" />
      </form>
      <div class="panel">
        <h3>アーカイブを追加</h3>
        <form
          method="get"
          action="/go"
          style="display:flex;flex-direction:column;gap:10px"
        >
          <input
            class="field"
            type="url"
            name="url"
            placeholder="ツイート URL を貼り付け"
            aria-label="ツイート URL"
            required
          />
          <button class="btn block" type="submit">
            取得して保存
          </button>
        </form>
      </div>
      {props.authors.length > 0 ? (
        <div class="panel">
          <h3>アーカイブ済みユーザー</h3>
          {props.authors.slice(0, 5).map((a) => (
            <a
              class="panel-row"
              href={`/${a.screen_name}`}
              style="display:flex;gap:10px;align-items:center"
            >
              <img
                src={smallAvatar(a)}
                alt=""
                loading="lazy"
                style="width:40px;height:40px;border-radius:9999px;object-fit:cover;background:var(--border)"
              />
              <div style="min-width:0">
                <div style="font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                  {a.name}
                </div>
                <div class="muted" style="font-size:14px">
                  @{a.screen_name}
                </div>
              </div>
            </a>
          ))}
          <a class="panel-row" href="/users" style="color:var(--accent)">
            すべて表示
          </a>
        </div>
      ) : null}
    </>
  )
}

export function HomePage(props: {
  views: TweetView[]
  authors: AuthorListRow[]
}) {
  const empty: Child = (
    <>
      <h3>ようこそ twiarchive へ</h3>
      <p>
        右の「アーカイブを追加」からツイート URL を貼り付けるか、
        <br />
        <code>/ユーザー名/status/ID</code> にアクセスすると保存できます。
      </p>
    </>
  )
  return (
    <Layout title="ホーム / twiarchive" active="home" right={<RightSidebar authors={props.authors} />}>
      <ColHead title="ホーム" />
      <Timeline views={props.views} empty={empty} />
    </Layout>
  )
}

export function SearchPage(props: {
  views: TweetView[]
  q: string
  mediaOnly: boolean
  authors: AuthorListRow[]
}) {
  const searched = props.q.length > 0 || props.mediaOnly
  const empty: Child = searched ? (
    <p>一致するアーカイブはありません。</p>
  ) : (
    <p>キーワードを入力してアーカイブを検索できます。</p>
  )
  return (
    <Layout
      title={props.q ? `${props.q} の検索結果` : '検索'}
      active="search"
      right={<RightSidebar authors={props.authors} />}
    >
      <ColHead title="検索" />
      <form
        method="get"
        action="/search"
        style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;flex-direction:column;gap:10px"
      >
        <div class="searchbox">
          <IconSearch />
          <input
            type="text"
            name="q"
            value={props.q}
            placeholder="アーカイブを検索"
            aria-label="アーカイブを検索"
            autofocus
          />
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <label class="checkrow">
            <input type="checkbox" name="media" value="1" checked={props.mediaOnly} />
            <IconImage size={16} /> メディアを含む投稿のみ
          </label>
          <button class="btn" type="submit">
            検索
          </button>
        </div>
      </form>
      <Timeline views={props.views} empty={empty} />
    </Layout>
  )
}

export function UsersPage(props: { authors: AuthorListRow[] }) {
  return (
    <Layout title="ユーザー / twiarchive" active="users">
      <ColHead title="ユーザー" sub={`${props.authors.length} 人をアーカイブ済み`} />
      {props.authors.length === 0 ? (
        <div class="empty">
          <p>まだ誰もアーカイブされていません。</p>
        </div>
      ) : (
        <div>
          {props.authors.map((a) => (
            <a class="user-row" href={`/${a.screen_name}`}>
              <img class="avatar" src={smallAvatar(a)} alt="" loading="lazy" />
              <div class="uinfo">
                <div class="uname">
                  <span
                    style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                  >
                    {a.name}
                  </span>
                  {a.verified === 1 ? (
                    <span class="vbadge">
                      <IconVerified size={16} />
                    </span>
                  ) : null}
                </div>
                <div class="uhandle">@{a.screen_name}</div>
                <div class="ucount">{formatCount(a.tweet_count)} 件のポスト</div>
              </div>
            </a>
          ))}
        </div>
      )}
    </Layout>
  )
}

function formatJoined(joined?: string): string {
  if (!joined) return ''
  const d = new Date(joined)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    timeZone: 'Asia/Tokyo',
  }).format(d)
}

export function ProfilePage(props: { author: AuthorRow; views: TweetView[] }) {
  const a = props.author
  let followers = 0
  let following = 0
  let joined = ''
  let description = a.description ?? ''
  try {
    const raw = JSON.parse(a.raw_json) as {
      followers?: number
      following?: number
      joined?: string
      description?: string
    }
    followers = raw.followers ?? 0
    following = raw.following ?? 0
    joined = raw.joined ?? ''
    description = raw.description ?? description
  } catch {
    /* ignore */
  }
  const banner = mediaUrl(a.banner_path) ?? a.banner_url
  const avatar = mediaUrl(a.avatar_path) ?? a.avatar_url ?? ''
  const joinedText = formatJoined(joined)
  return (
    <Layout title={`${a.name} (@${a.screen_name})`}>
      <ColHead title={a.name} sub={`${formatCount(props.views.length)} 件のポスト`} back="/users" />
      {banner ? (
        <img class="profile-banner" src={banner} alt="" />
      ) : (
        <div class="profile-banner" />
      )}
      <div class="profile-head">
        <img class="profile-avatar" src={avatar} alt="" />
        <div class="profile-name">
          {a.name}
          {a.verified === 1 ? (
            <span class="vbadge">
              <IconVerified size={20} />
            </span>
          ) : null}
        </div>
        <div class="profile-handle">@{a.screen_name}</div>
        {description ? <div class="profile-bio">{description}</div> : null}
        <div class="profile-stats">
          {joinedText ? (
            <span style="display:inline-flex;align-items:center;gap:6px">
              <IconCalendar size={16} /> {joinedText}から利用
            </span>
          ) : null}
        </div>
        <div class="profile-stats">
          <span>
            <b>{formatCount(following)}</b> フォロー中
          </span>
          <span>
            <b>{formatCount(followers)}</b> フォロワー
          </span>
        </div>
      </div>
      <Timeline
        views={props.views}
        empty={<p>このユーザーのアーカイブはまだありません。</p>}
      />
    </Layout>
  )
}

export function DetailPage(props: { view: TweetView }) {
  const v = props.view
  const title = `${v.name} (@${v.screenName}): ${v.text.slice(0, 60)}`
  return (
    <Layout title={title}>
      <ColHead title="ポスト" back="/" />
      <TweetDetail view={v} />
      <div
        style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;gap:16px;font-size:14px"
      >
        <a
          href={`/${v.screenName}/status/${v.id}?refresh=1`}
          style="display:inline-flex;align-items:center;gap:6px;color:var(--accent)"
        >
          <IconRefresh size={16} /> リフレッシュ
        </a>
        <a href={`/${v.screenName}`} style="color:var(--accent)">
          @{v.screenName} の一覧
        </a>
      </div>
    </Layout>
  )
}

export function ErrorPage(props: {
  message: string
  screenName?: string
  id?: string
}) {
  return (
    <Layout title="エラー">
      <ColHead title="エラー" back="/" />
      <div class="error">
        <h2>ポストを取得できませんでした</h2>
        <p class="muted">{props.message}</p>
        {props.screenName && props.id ? (
          <p>
            <a
              class="btn"
              href={`/${props.screenName}/status/${props.id}?refresh=1`}
            >
              再試行
            </a>
          </p>
        ) : null}
        <p>
          <a href="/" style="color:var(--accent)">
            ← ホームへ戻る
          </a>
        </p>
      </div>
    </Layout>
  )
}
