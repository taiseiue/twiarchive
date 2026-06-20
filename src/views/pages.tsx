// ページ単位のコンポーネント (ホーム / 検索 / ユーザー / プロフィール / 詳細 / エラー)。

import type { Child } from 'hono/jsx'
import type {
  AuthorListRow,
  AuthorRow,
  ListRow,
  ListWithCount,
  SortOrder,
} from '../db.js'
import type { SyncState } from '../sync.js'
import { Layout } from './Layout.js'
import { TweetCard, TweetDetail, Timeline } from './Tweet.js'
import { avatarSrc, formatCount, mediaUrl, type TweetView } from './model.js'
import {
  IconBack,
  IconCalendar,
  IconEye,
  IconEyeOff,
  IconImage,
  IconList,
  IconRefresh,
  IconSearch,
  IconSort,
  IconTrash,
  IconVerified,
} from './icons.js'

// 中央カラムのスティッキーヘッダ。action を渡すと右端に配置する。
function ColHead(props: {
  title: string
  sub?: string
  back?: string
  action?: Child
}) {
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
      {props.action ? <div class="colhead-action">{props.action}</div> : null}
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

// 並べ替えの選択肢 (ラベルは Twitter 風)。
const SORT_OPTIONS: { key: SortOrder; label: string }[] = [
  { key: 'newest', label: '日時降順' },
  { key: 'oldest', label: '日時昇順' },
  { key: 'likes', label: 'いいね数順' },
]

// list / sort を保持したままホームの URL を組み立てる。
function homeHref(listId: number | undefined, sort: SortOrder): string {
  const p = new URLSearchParams()
  if (listId != null) p.set('list', String(listId))
  if (sort !== 'newest') p.set('sort', sort)
  const qs = p.toString()
  return qs ? `/?${qs}` : '/'
}

// ホーム上部のリストタブ (Twitter のリスト風)。「すべて」+ 各リスト。
function HomeTabs(props: {
  lists: ListWithCount[]
  activeListId?: number
  sort: SortOrder
}) {
  const active = props.activeListId
  return (
    <div class="tabbar">
      <a
        class={`tab${active == null ? ' active' : ''}`}
        href={homeHref(undefined, props.sort)}
      >
        <span>すべて</span>
      </a>
      {props.lists.map((l) => (
        <a
          class={`tab${active === l.id ? ' active' : ''}`}
          href={homeHref(l.id, props.sort)}
        >
          <span>{l.name}</span>
        </a>
      ))}
      <a class="tab tab-manage" href="/lists" aria-label="リストを管理">
        <span>
          <IconList size={18} />
        </span>
      </a>
    </div>
  )
}

// 並べ替えドロップダウン (JS 不要の <details>)。各項目は現在のタブを保ったまま遷移。
function SortMenu(props: { activeListId?: number; sort: SortOrder }) {
  const current =
    SORT_OPTIONS.find((o) => o.key === props.sort) ?? SORT_OPTIONS[0]
  return (
    <details class="sortmenu">
      <summary aria-label="並べ替え">
        <IconSort size={18} />
        <span>{current.label}</span>
      </summary>
      <div class="sortmenu-list" role="menu">
        {SORT_OPTIONS.map((o) => (
          <a
            class={`sortmenu-item${o.key === props.sort ? ' active' : ''}`}
            href={homeHref(props.activeListId, o.key)}
            role="menuitem"
          >
            {o.label}
          </a>
        ))}
      </div>
    </details>
  )
}

export function HomePage(props: {
  views: TweetView[]
  authors: AuthorListRow[]
  lists: ListWithCount[]
  activeListId?: number
  sort: SortOrder
  nextHref?: string
}) {
  const empty: Child =
    props.activeListId == null ? (
      <>
        <h3>ようこそ twiarchive へ</h3>
        <p>
          右の「アーカイブを追加」からツイート URL を貼り付けるか、
          <br />
          <code>/ユーザー名/status/ID</code> にアクセスすると保存できます。
        </p>
      </>
    ) : (
      <p>
        このリストにはまだ投稿がありません。メンバーのプロフィールから追加してください。
      </p>
    )
  return (
    <Layout title="ホーム / twiarchive" active="home" right={<RightSidebar authors={props.authors} />}>
      <ColHead
        title="ホーム"
        action={
          <SortMenu activeListId={props.activeListId} sort={props.sort} />
        }
      />
      <HomeTabs
        lists={props.lists}
        activeListId={props.activeListId}
        sort={props.sort}
      />
      <Timeline views={props.views} empty={empty} nextHref={props.nextHref} />
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

export function UsersPage(props: {
  authors: AuthorListRow[]
  total: number
  nextHref?: string
}) {
  return (
    <Layout title="ユーザー / twiarchive" active="users">
      <ColHead title="ユーザー" sub={`${formatCount(props.total)} 人をアーカイブ済み`} />
      {props.total === 0 ? (
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
          {props.nextHref ? (
            <a class="loadmore" href={props.nextHref}>
              もっと見る
            </a>
          ) : null}
        </div>
      )}
    </Layout>
  )
}

export function ListsPage(props: { lists: ListWithCount[] }) {
  return (
    <Layout title="リスト / twiarchive" active="lists">
      <ColHead title="リスト" sub={`${props.lists.length} 件`} />
      <form
        method="post"
        action="/lists"
        style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;gap:10px"
      >
        <input
          class="field"
          type="text"
          name="name"
          placeholder="新しいリスト名"
          aria-label="新しいリスト名"
          maxlength={50}
          required
        />
        <button class="btn" type="submit">
          作成
        </button>
      </form>
      {props.lists.length === 0 ? (
        <div class="empty">
          <h3>リストがありません</h3>
          <p>上のフォームからリストを作成できます。</p>
        </div>
      ) : (
        <div>
          {props.lists.map((l) => {
            const hidden = l.hidden === 1
            return (
              <div class="user-row">
                <a
                  class="uinfo"
                  href={`/lists/${l.id}`}
                  style="display:block;min-width:0"
                >
                  <div class="uname">
                    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                      {l.name}
                    </span>
                    {hidden ? (
                      <span class="muted" style="font-size:13px;font-weight:400">
                        非表示
                      </span>
                    ) : null}
                  </div>
                  <div class="ucount">{formatCount(l.member_count)} 人</div>
                </a>
                <div style="display:flex;gap:8px">
                  <form method="post" action={`/lists/${l.id}/visibility`}>
                    <input
                      type="hidden"
                      name="hidden"
                      value={hidden ? '0' : '1'}
                    />
                    <button
                      class="btn sm ghost"
                      type="submit"
                      aria-label={
                        hidden ? 'ホームに表示する' : 'ホームで非表示にする'
                      }
                      title={
                        hidden ? 'ホームに表示する' : 'ホームで非表示にする'
                      }
                    >
                      {hidden ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                    </button>
                  </form>
                  <form
                    method="post"
                    action={`/lists/${l.id}/delete`}
                    onsubmit="return confirm('このリストを削除しますか?')"
                  >
                    <button
                      class="btn sm ghost"
                      type="submit"
                      aria-label="リストを削除"
                    >
                      <IconTrash size={16} />
                    </button>
                  </form>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Layout>
  )
}

export function ListTimelinePage(props: {
  list: ListRow
  views: TweetView[]
  total: number
  nextHref?: string
}) {
  return (
    <Layout title={`${props.list.name} / リスト`} active="lists">
      <ColHead
        title={props.list.name}
        sub={`${formatCount(props.total)} 件のポスト`}
        back="/lists"
      />
      <Timeline
        views={props.views}
        nextHref={props.nextHref}
        empty={
          <p>
            このリストにはまだ投稿がありません。メンバーのプロフィールから追加してください。
          </p>
        }
      />
    </Layout>
  )
}

// 同期ボタン + 進捗表示。
function SyncBar(props: { username: string; sync: SyncState }) {
  const s = props.sync
  if (s.running) {
    return (
      <div class="syncbar">
        <span class="sync-status">
          <span class="spinner" />
          同期中… {formatCount(s.added)} 件取得 ({s.pages} ページ)
        </span>
      </div>
    )
  }
  return (
    <div class="syncbar">
      <form method="post" action={`/${props.username}/sync`}>
        <button class="btn sm" type="submit" name="refresh" value="">
          <IconRefresh size={16} /> <span style="margin-left:6px">同期</span>
        </button>
        <button class="btn sm ghost" type="submit" name="refresh" value="1">
          全再取得
        </button>
      </form>
      {s.finishedAt ? (
        s.error ? (
          <span class="sync-status err">同期に失敗しました: {s.error}</span>
        ) : (
          <span class="sync-status">前回の同期: +{formatCount(s.added)} 件</span>
        )
      ) : (
        <span class="sync-status">最新のポストをまとめて取得します</span>
      )}
    </div>
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

// プロフィール上のリスト所属トグル。各リストを add/remove のフォームボタンで切り替える。
function ProfileLists(props: {
  authorId: string
  lists: ListWithCount[]
  memberOf: number[]
}) {
  const member = new Set(props.memberOf)
  return (
    <div class="syncbar" style="gap:8px">
      <span class="sync-status">
        <IconList size={16} /> リスト
      </span>
      {props.lists.length === 0 ? (
        <span class="muted" style="font-size:14px">
          <a href="/lists" style="color:var(--accent)">
            リストを作成
          </a>
          すると、ここから追加できます。
        </span>
      ) : (
        props.lists.map((l) => {
          const joined = member.has(l.id)
          return (
            <form method="post" action={`/lists/${l.id}/members`}>
              <input type="hidden" name="author_id" value={props.authorId} />
              <input
                type="hidden"
                name="action"
                value={joined ? 'remove' : 'add'}
              />
              <button
                class={joined ? 'btn sm' : 'btn sm ghost'}
                type="submit"
                aria-pressed={joined ? 'true' : 'false'}
              >
                {joined ? '✓ ' : '+ '}
                {l.name}
              </button>
            </form>
          )
        })
      )}
    </div>
  )
}

export function ProfilePage(props: {
  author: AuthorRow
  views: TweetView[]
  sync: SyncState
  lists: ListWithCount[]
  memberOf: number[]
  total: number
  nextHref?: string
}) {
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
    <Layout
      title={`${a.name} (@${a.screen_name})`}
      metaRefresh={props.sync.running ? 5 : undefined}
    >
      <ColHead title={a.name} sub={`${formatCount(props.total)} 件のポスト`} back="/users" />
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
      <SyncBar username={a.screen_name} sync={props.sync} />
      <ProfileLists
        authorId={a.id}
        lists={props.lists}
        memberOf={props.memberOf}
      />
      <Timeline
        views={props.views}
        nextHref={props.nextHref}
        empty={<p>このユーザーのアーカイブはまだありません。</p>}
      />
    </Layout>
  )
}

// まだアーカイブされていないユーザー向けの同期開始ページ。
export function ProfileSyncPrompt(props: {
  username: string
  sync: SyncState
}) {
  const s = props.sync
  return (
    <Layout
      title={`@${props.username}`}
      metaRefresh={s.running ? 5 : undefined}
    >
      <ColHead title={`@${props.username}`} back="/users" />
      <div class="empty">
        <h3>@{props.username} はまだアーカイブされていません</h3>
        <p>このユーザーのポストをまとめて取得できます。</p>
        {s.running ? (
          <p class="sync-status" style="justify-content:center">
            <span class="spinner" />
            同期中… {formatCount(s.added)} 件取得 ({s.pages} ページ)
          </p>
        ) : (
          <form
            method="post"
            action={`/${props.username}/sync`}
            style="margin-top:14px"
          >
            <button class="btn" type="submit" name="refresh" value="">
              同期を開始
            </button>
          </form>
        )}
        {!s.running && s.error ? (
          <p class="sync-status err" style="justify-content:center">
            {s.error}
          </p>
        ) : null}
      </div>
    </Layout>
  )
}

export function DetailPage(props: {
  view: TweetView
  ancestors: TweetView[]
  replies: TweetView[]
}) {
  const v = props.view
  const title = `${v.name} (@${v.screenName}): ${v.text.slice(0, 60)}`
  return (
    <Layout title={title}>
      <ColHead title="ポスト" back="/" />
      {props.ancestors.map((a) => (
        <TweetCard view={a} />
      ))}
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
      {props.replies.length > 0 ? (
        <>
          <div class="colhead" style="position:static;min-height:auto;padding:12px 16px">
            <h2 style="font-size:17px">返信 {props.replies.length} 件</h2>
          </div>
          {props.replies.map((r) => (
            <TweetCard view={r} />
          ))}
        </>
      ) : null}
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
