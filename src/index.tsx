import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { join, normalize, sep } from 'node:path'
import { Readable } from 'node:stream'

import { archiveTweet } from './archive.js'
import { getSyncState, startSync } from './sync.js'
import {
  MEDIA_DIR,
  getAncestors,
  getAuthorByName,
  getReplies,
  getTweet,
  listAuthors,
  listByUser,
  listTimeline,
  searchTweets,
} from './db.js'
import { FxTwitterError } from './fxtwitter.js'
import { loadTimelineViews, loadTweetView } from './views/model.js'
import {
  DetailPage,
  ErrorPage,
  HomePage,
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
  'favicon.ico',
  'robots.txt',
])
const SCREEN_NAME_RE = /^[A-Za-z0-9_]{1,15}$/
const TWEET_ID_RE = /^\d+$/

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

// ---- ホーム (全体タイムライン) ----
app.get('/', (c) => {
  const views = loadTimelineViews(listTimeline({ limit: 100 }))
  return c.html(<HomePage views={views} authors={listAuthors()} />)
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
  const views = loadTimelineViews(listByUser(username, { limit: 500 }))
  return c.html(<ProfilePage author={author} views={views} sync={sync} />)
})

const port = Number(process.env.PORT ?? 3000)
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
