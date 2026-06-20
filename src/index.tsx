import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { join, normalize, sep } from 'node:path'
import { Readable } from 'node:stream'

import { archiveTweet } from './archive.js'
import { getSyncState, startSync } from './sync.js'
import {
  MEDIA_DIR,
  addListMember,
  countByList,
  countByUser,
  createList,
  deleteList,
  getAncestors,
  getAuthorByName,
  getList,
  getReplies,
  getTweet,
  listAuthors,
  listByList,
  listByUser,
  listIdsForAuthor,
  listLists,
  listTimeline,
  removeListMember,
  searchTweets,
  setListHidden,
} from './db.js'
import type { SortOrder } from './db.js'
import { FxTwitterError } from './fxtwitter.js'
import { loadTimelineViews, loadTweetView } from './views/model.js'
import {
  DetailPage,
  ErrorPage,
  HomePage,
  ListsPage,
  ListTimelinePage,
  ProfilePage,
  ProfileSyncPrompt,
  SearchPage,
  UsersPage,
} from './views/pages.js'

const app = new Hono()

// /:username で拾ってはいけない予約語。
const RESERVED = new Set([
  'media',
  'go',
  'search',
  'users',
  'lists',
  'favicon.ico',
  'robots.txt',
])
const SCREEN_NAME_RE = /^[A-Za-z0-9_]{1,15}$/
const TWEET_ID_RE = /^\d+$/

// タイムライン系の 1 ページあたりの表示件数。
const PAGE_SIZE = 50

// ?offset= を 0 以上の整数として読む。不正値は 0。
function parseOffset(c: { req: { query: (k: string) => string | undefined } }): number {
  const n = Number(c.req.query('offset'))
  return Number.isInteger(n) && n > 0 ? n : 0
}

// ?sort= をタイムラインの並び順として読む。不正値は newest (日時降順)。
function parseSort(c: {
  req: { query: (k: string) => string | undefined }
}): SortOrder {
  const s = c.req.query('sort')
  return s === 'oldest' || s === 'likes' ? s : 'newest'
}

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  mp4: 'video/mp4',
  webm: 'video/webm',
  m3u8: 'application/x-mpegURL',
}

function contentTypeOf(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return CONTENT_TYPES[ext] ?? 'application/octet-stream'
}

// HTML ページは毎回再検証させる (メディアは個別に immutable を付与)。
// no-store ではなく no-cache を使うのが重要:
//   - no-store だと正しい応答もブラウザが保存しないため、ヘッダが無かった頃に
//     保存された「空のキャッシュエントリ」が上書きされず残り、通常リロード
//     (Cmd+R) で真っ白なまま、ハードリロード (Cmd+Shift+R) のみ正常になる。
//   - no-cache なら保存は許可しつつ毎回再検証するので、古い空エントリが
//     正しいページで上書きされ、以降は通常リロードでも正しく表示される。
app.use('*', async (c, next) => {
  await next()
  if (!c.req.path.startsWith('/media/')) {
    c.header('Cache-Control', 'no-cache')
  }
})

// ---- 静的メディア配信 (Range 対応) ----
app.get('/media/*', (c) => {
  let rel: string
  try {
    rel = decodeURIComponent(c.req.path.slice('/media/'.length))
  } catch {
    return c.notFound()
  }
  const full = join(MEDIA_DIR, normalize(rel))
  // ディレクトリトラバーサル防止。
  if (full !== MEDIA_DIR && !full.startsWith(MEDIA_DIR + sep)) {
    return c.notFound()
  }
  if (!existsSync(full) || !statSync(full).isFile()) return c.notFound()

  const stat = statSync(full)
  const type = contentTypeOf(full)
  const range = c.req.header('Range')
  const baseHeaders: Record<string, string> = {
    'Content-Type': type,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable',
  }

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range)
    if (m) {
      const start = m[1] ? parseInt(m[1], 10) : 0
      const end = m[2] ? parseInt(m[2], 10) : stat.size - 1
      if (start <= end && start < stat.size) {
        const safeEnd = Math.min(end, stat.size - 1)
        const stream = Readable.toWeb(
          createReadStream(full, { start, end: safeEnd }),
        ) as ReadableStream
        return new Response(stream, {
          status: 206,
          headers: {
            ...baseHeaders,
            'Content-Range': `bytes ${start}-${safeEnd}/${stat.size}`,
            'Content-Length': String(safeEnd - start + 1),
          },
        })
      }
    }
  }

  const stream = Readable.toWeb(createReadStream(full)) as ReadableStream
  return new Response(stream, {
    headers: { ...baseHeaders, 'Content-Length': String(stat.size) },
  })
})

// ---- ホーム (全体タイムライン + リストタブ) ----
app.get('/', (c) => {
  const offset = parseOffset(c)
  const sort = parseSort(c)
  // ホームのタブにはホーム表示中 (hidden=0) のリストのみ並べる。
  const lists = listLists({ visibleOnly: true })
  // ?list= が有効なリスト id ならそのタブを開く。
  const listParam = c.req.query('list')
  let activeListId: number | undefined
  if (listParam && /^\d+$/.test(listParam)) {
    const id = Number(listParam)
    if (lists.some((l) => l.id === id)) activeListId = id
  }
  const rows =
    activeListId != null
      ? listByList(activeListId, { limit: PAGE_SIZE + 1, offset, sort })
      : listTimeline({ limit: PAGE_SIZE + 1, offset, sort })
  const hasNext = rows.length > PAGE_SIZE
  const views = loadTimelineViews(rows.slice(0, PAGE_SIZE))
  // list / sort を保持したまま次ページへ進む URL を組み立てる。
  const homeHref = (extra: Record<string, string | number>): string => {
    const p = new URLSearchParams()
    if (activeListId != null) p.set('list', String(activeListId))
    if (sort !== 'newest') p.set('sort', sort)
    for (const [k, v] of Object.entries(extra)) p.set(k, String(v))
    const qs = p.toString()
    return qs ? `/?${qs}` : '/'
  }
  const nextHref = hasNext ? homeHref({ offset: offset + PAGE_SIZE }) : undefined
  return c.html(
    <HomePage
      views={views}
      authors={listAuthors()}
      lists={lists}
      activeListId={activeListId}
      sort={sort}
      nextHref={nextHref}
    />,
  )
})

// ---- 検索 / メディア絞り込み ----
app.get('/search', (c) => {
  const q = c.req.query('q')?.trim() ?? ''
  const mediaOnly = c.req.query('media') === '1'
  let rows: ReturnType<typeof searchTweets>
  if (q) {
    rows = searchTweets(q)
    if (mediaOnly) {
      const withMedia = new Set(
        listTimeline({ mediaOnly: true, limit: 1000 }).map((r) => r.id),
      )
      rows = rows.filter((r) => withMedia.has(r.id))
    }
  } else if (mediaOnly) {
    rows = listTimeline({ mediaOnly: true, limit: 100 })
  } else {
    rows = []
  }
  return c.html(
    <SearchPage
      views={loadTimelineViews(rows)}
      q={q}
      mediaOnly={mediaOnly}
      authors={listAuthors()}
    />,
  )
})

// ---- ユーザー一覧 ----
app.get('/users', (c) => {
  return c.html(<UsersPage authors={listAuthors()} />)
})

// ---- ユーザーリスト ----
app.get('/lists', (c) => {
  return c.html(<ListsPage lists={listLists()} />)
})

app.post('/lists', async (c) => {
  const body = await c.req.parseBody()
  const name = String(body['name'] ?? '').trim()
  if (name) createList(name.slice(0, 50))
  return c.redirect('/lists')
})

app.get('/lists/:id', (c) => {
  const id = c.req.param('id')
  if (!/^\d+$/.test(id)) return c.notFound()
  const list = getList(Number(id))
  if (!list) return c.notFound()
  const offset = parseOffset(c)
  const rows = listByList(list.id, { limit: PAGE_SIZE + 1, offset })
  const hasNext = rows.length > PAGE_SIZE
  const views = loadTimelineViews(rows.slice(0, PAGE_SIZE))
  const nextHref = hasNext
    ? `/lists/${list.id}?offset=${offset + PAGE_SIZE}`
    : undefined
  return c.html(
    <ListTimelinePage
      list={list}
      views={views}
      total={countByList(list.id)}
      nextHref={nextHref}
    />,
  )
})

app.post('/lists/:id/delete', (c) => {
  const id = c.req.param('id')
  if (/^\d+$/.test(id)) deleteList(Number(id))
  return c.redirect('/lists')
})

// ---- ホーム表示/非表示の切り替え ----
app.post('/lists/:id/visibility', async (c) => {
  const id = c.req.param('id')
  if (!/^\d+$/.test(id)) return c.notFound()
  const body = await c.req.parseBody()
  setListHidden(Number(id), body['hidden'] === '1')
  return c.redirect('/lists')
})

app.post('/lists/:id/members', async (c) => {
  const id = c.req.param('id')
  if (!/^\d+$/.test(id)) return c.notFound()
  const listId = Number(id)
  const body = await c.req.parseBody()
  const authorId = String(body['author_id'] ?? '')
  const action = body['action']
  if (authorId) {
    if (action === 'remove') removeListMember(listId, authorId)
    else addListMember(listId, authorId)
  }
  return c.redirect(c.req.header('Referer') ?? `/lists/${listId}`)
})

// ---- URL 貼り付け → 該当パスへリダイレクト ----
app.get('/go', (c) => {
  const url = c.req.query('url') ?? ''
  const m = /(?:^|\/)([A-Za-z0-9_]{1,15})\/status\/(\d+)/.exec(url)
  if (!m) return c.redirect('/')
  return c.redirect(`/${m[1]}/status/${m[2]}`)
})

// ---- ツイート詳細 (未アーカイブなら取得) ----
app.get('/:username/status/:id', async (c) => {
  const username = c.req.param('username')
  const id = c.req.param('id')
  const refresh = c.req.query('refresh') === '1'

  if (!SCREEN_NAME_RE.test(username) || !TWEET_ID_RE.test(id)) {
    c.status(400)
    return c.html(<ErrorPage message="URL の形式が正しくありません。" />)
  }

  try {
    let row = getTweet(id)
    if (!row || refresh) {
      row = await archiveTweet(username, id, { refresh })
    }
    const view = loadTweetView(row)
    const ancestors = loadTimelineViews(getAncestors(id))
    const replies = loadTimelineViews(getReplies(id))
    return c.html(
      <DetailPage view={view} ancestors={ancestors} replies={replies} />,
    )
  } catch (err) {
    const message =
      err instanceof FxTwitterError
        ? `${err.message} (code: ${err.code})`
        : err instanceof Error
          ? err.message
          : '不明なエラー'
    c.status(err instanceof FxTwitterError ? 404 : 500)
    return c.html(
      <ErrorPage message={message} screenName={username} id={id} />,
    )
  }
})

// ---- プロフィールの同期を開始 (バックグラウンド) ----
app.post('/:username/sync', async (c) => {
  const username = c.req.param('username')
  if (RESERVED.has(username) || !SCREEN_NAME_RE.test(username)) {
    return c.notFound()
  }
  const body = await c.req.parseBody()
  const refresh = body['refresh'] === '1'
  startSync(username, refresh)
  return c.redirect(`/${username}`)
})

// ---- ユーザー別ページ (同期はボタンから手動で開始) ----
app.get('/:username', (c) => {
  const username = c.req.param('username')
  if (RESERVED.has(username) || !SCREEN_NAME_RE.test(username)) {
    return c.notFound()
  }
  const sync = getSyncState(username)
  const author = getAuthorByName(username)
  if (!author) {
    // 未アーカイブ: 同期を促すページ (同期中なら自動リロードで待つ)。
    if (!sync.running) c.status(404)
    return c.html(<ProfileSyncPrompt username={username} sync={sync} />)
  }
  const offset = parseOffset(c)
  const rows = listByUser(username, { limit: PAGE_SIZE + 1, offset })
  const hasNext = rows.length > PAGE_SIZE
  const views = loadTimelineViews(rows.slice(0, PAGE_SIZE))
  const nextHref = hasNext
    ? `/${author.screen_name}?offset=${offset + PAGE_SIZE}`
    : undefined
  return c.html(
    <ProfilePage
      author={author}
      views={views}
      sync={sync}
      lists={listLists()}
      memberOf={listIdsForAuthor(author.id)}
      total={countByUser(author.screen_name)}
      nextHref={nextHref}
    />,
  )
})

const port = Number(process.env.PORT ?? 3000)
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
