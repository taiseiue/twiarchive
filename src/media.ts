// メディア (画像/動画/サムネ/アバター/バナー) を data/media 配下へダウンロードする。
// 保存パスは MEDIA_DIR からの相対パスで返し、そのまま /media/<path> で配信できる。

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { MEDIA_DIR } from './db.js'
import type {
  ApiAuthor,
  ApiMediaItem,
  ApiTweet,
  ApiVideo,
  ApiVideoVariant,
} from './fxtwitter.js'
import type { MediaInsert } from './db.js'

const USER_AGENT =
  'twiarchive/1.0 (+https://github.com/taiseiue/twiarchive)'

/** pbs.twimg.com の画像URLをオリジナル解像度 (name=orig) に正規化する。 */
function toOrigImageUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname !== 'pbs.twimg.com') return url
    // 拡張子付き形式 (…/media/ID.jpg) を format+name 形式へ変換する。
    const m = u.pathname.match(/^(.*)\.([a-zA-Z0-9]+)$/)
    if (m) {
      u.pathname = m[1]
      u.searchParams.set('format', m[2])
    }
    u.searchParams.set('name', 'orig')
    return u.toString()
  } catch {
    return url
  }
}

/** URL から拡張子を推定する。取れなければ fallback を使う。 */
function extFromUrl(url: string, fallback: string): string {
  try {
    const u = new URL(url)
    // pbs.twimg.com の name=orig 形式は拡張子が format クエリに入る。
    const fmt = u.searchParams.get('format')
    if (fmt && /^[a-zA-Z0-9]{1,5}$/.test(fmt)) return fmt.toLowerCase()
    const m = u.pathname.match(/\.([a-zA-Z0-9]{1,5})$/)
    if (m) return m[1].toLowerCase()
  } catch {
    /* ignore */
  }
  return fallback
}

/** URL からファイルをダウンロードし、MEDIA_DIR/relPath へ保存する。失敗時は false。 */
async function downloadTo(url: string, relPath: string): Promise<boolean> {
  const dest = join(MEDIA_DIR, relPath)
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
    if (!res.ok) {
      console.warn(`[media] download failed ${res.status}: ${url}`)
      return false
    }
    const buf = Buffer.from(await res.arrayBuffer())
    await mkdir(dirname(dest), { recursive: true })
    await writeFile(dest, buf)
    return true
  } catch (err) {
    console.warn(`[media] download error: ${url}`, err)
    return false
  }
}

/** variant URL から解像度 (幅×高さの画素数) を推定する。例: /vid/1280x720/ */
function variantPixels(url: string): number {
  const m = url.match(/\/(\d+)x(\d+)\//)
  if (!m) return 0
  return Number(m[1]) * Number(m[2])
}

/** variant の「画質スコア」。bitrate を優先し、無ければ解像度で代替する。 */
function variantScore(v: ApiVideoVariant): number {
  return v.bitrate ?? variantPixels(v.url)
}

/** 動画 variants から mp4 の最高画質のものを1つ選ぶ。 */
function pickBestVideoVariant(
  video: ApiVideo,
): ApiVideoVariant | undefined {
  const mp4 = (video.variants ?? []).filter(
    (v) => v.content_type === 'video/mp4',
  )
  if (mp4.length === 0) return undefined
  return mp4.reduce((best, v) =>
    variantScore(v) > variantScore(best) ? v : best,
  )
}

function isVideo(item: ApiMediaItem): item is ApiVideo {
  return item.type === 'video' || item.type === 'gif'
}

/**
 * ツイートのメディアをすべて保存し、DB へ書き込む MediaInsert[] を返す。
 * media.all を優先し、無ければ photos/videos を結合する。
 */
export async function saveTweetMedia(tweet: ApiTweet): Promise<MediaInsert[]> {
  const media = tweet.media
  if (!media) return []
  const items: ApiMediaItem[] =
    media.all && media.all.length > 0
      ? media.all
      : [...(media.photos ?? []), ...(media.videos ?? [])]

  const result: MediaInsert[] = []
  let ord = 0
  for (const item of items) {
    const mediaId = item.id || `${tweet.id}_${ord}`
    if (isVideo(item)) {
      const variant = pickBestVideoVariant(item)
      const sourceUrl = variant?.url ?? item.url
      const ext = extFromUrl(sourceUrl, 'mp4')
      const relPath = `${tweet.id}/${mediaId}.${ext}`
      const ok = await downloadTo(sourceUrl, relPath)
      if (!ok) {
        ord++
        continue
      }
      // サムネイル
      let thumbPath: string | null = null
      if (item.thumbnail_url) {
        const thumbExt = extFromUrl(item.thumbnail_url, 'jpg')
        const thumbRel = `${tweet.id}/${mediaId}_thumb.${thumbExt}`
        if (await downloadTo(item.thumbnail_url, thumbRel)) thumbPath = thumbRel
      }
      result.push({
        tweet_id: tweet.id,
        ord,
        type: item.type,
        local_path: relPath,
        source_url: sourceUrl,
        thumbnail_path: thumbPath,
        width: item.width ?? null,
        height: item.height ?? null,
        duration: item.duration ?? null,
        alt_text: null,
      })
    } else {
      const sourceUrl = toOrigImageUrl(item.url)
      const ext = extFromUrl(sourceUrl, 'jpg')
      const relPath = `${tweet.id}/${mediaId}.${ext}`
      const ok = await downloadTo(sourceUrl, relPath)
      if (!ok) {
        ord++
        continue
      }
      result.push({
        tweet_id: tweet.id,
        ord,
        type: 'photo',
        local_path: relPath,
        source_url: sourceUrl,
        thumbnail_path: null,
        width: item.width ?? null,
        height: item.height ?? null,
        duration: null,
        alt_text: item.altText ?? null,
      })
    }
    ord++
  }
  return result
}

/** 著者のアバター/バナーを保存し、相対パスを返す。 */
export async function saveAuthorAssets(
  author: ApiAuthor,
): Promise<{ avatarPath: string | null; bannerPath: string | null }> {
  let avatarPath: string | null = null
  let bannerPath: string | null = null

  if (author.avatar_url) {
    const ext = extFromUrl(author.avatar_url, 'jpg')
    const rel = `avatars/${author.id}.${ext}`
    if (await downloadTo(author.avatar_url, rel)) avatarPath = rel
  }
  if (author.banner_url) {
    const ext = extFromUrl(author.banner_url, 'jpg')
    const rel = `banners/${author.id}.${ext}`
    if (await downloadTo(author.banner_url, rel)) bannerPath = rel
  }
  return { avatarPath, bannerPath }
}
