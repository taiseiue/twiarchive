// DB 行を描画用のビューモデルへ変換するヘルパと整形ユーティリティ。

import type { Child } from 'hono/jsx'
import { getAuthor, getMedia, getTweet } from '../db.js'
import type { MediaRow, TweetRow } from '../db.js'

export interface TweetView {
  id: string
  screenName: string
  name: string
  avatarPath: string | null
  avatarUrl: string | null
  verified: boolean
  text: string
  createdTimestamp: number | null
  replies: number
  retweets: number
  likes: number
  quotes: number
  views: number | null
  media: MediaRow[]
  quote: TweetView | null
  replyingTo: { screenName: string; id: string } | null
}

/** TweetRow から描画用ビューモデルを構築する。quote は 1 段だけ展開する。 */
export function loadTweetView(row: TweetRow, expandQuote = true): TweetView {
  const author = getAuthor(row.author_id)
  let quote: TweetView | null = null
  if (expandQuote && row.quote_id) {
    const quoteRow = getTweet(row.quote_id)
    if (quoteRow) quote = loadTweetView(quoteRow, false)
  }
  let replyingTo: { screenName: string; id: string } | null = null
  if (row.replying_to_id) {
    const parent = getTweet(row.replying_to_id)
    if (parent) replyingTo = { screenName: parent.screen_name, id: parent.id }
  }
  return {
    id: row.id,
    screenName: row.screen_name,
    name: author?.name ?? row.screen_name,
    avatarPath: author?.avatar_path ?? null,
    avatarUrl: author?.avatar_url ?? null,
    verified: (author?.verified ?? 0) === 1,
    text: row.text,
    createdTimestamp: row.created_timestamp,
    replies: row.replies,
    retweets: row.retweets,
    likes: row.likes,
    quotes: row.quotes,
    views: row.views,
    media: getMedia(row.id),
    quote,
    replyingTo,
  }
}

export function loadTimelineViews(rows: TweetRow[]): TweetView[] {
  return rows.map((r) => loadTweetView(r))
}

/** メディア相対パスを配信 URL へ。 */
export function mediaUrl(relPath: string | null): string | null {
  if (!relPath) return null
  return `/media/${relPath}`
}

/** アバター URL: ローカル保存があればそれを、無ければ元 URL を使う。 */
export function avatarSrc(view: {
  avatarPath: string | null
  avatarUrl: string | null
}): string {
  return mediaUrl(view.avatarPath) ?? view.avatarUrl ?? ''
}

/** 1234567 -> "1.2M" のような短縮表記。 */
export function formatCount(n: number | null | undefined): string {
  if (n == null) return ''
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`
  return `${(n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0)}M`
}

/** unix 秒 -> "2026年6月19日 9:16" 形式 (JST)。 */
export function formatDate(ts: number | null): string {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  const fmt = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  })
  return fmt.format(d)
}

/** タイムライン用の短い相対表記 (X 風)。今/分/時間、年内は M月D日、それ以前は年付き。 */
export function formatRelative(ts: number | null, now = Date.now()): string {
  if (!ts) return ''
  const diffSec = Math.floor(now / 1000) - ts
  if (diffSec < 60) return '今'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}時間`
  const d = new Date(ts * 1000)
  const nowD = new Date(now)
  const opts: Intl.DateTimeFormatOptions =
    d.getFullYear() === nowD.getFullYear()
      ? { month: 'long', day: 'numeric', timeZone: 'Asia/Tokyo' }
      : { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tokyo' }
  return new Intl.DateTimeFormat('ja-JP', opts).format(d)
}

const escapeAttr = (s: string) => s.replace(/"/g, '&quot;')

/**
 * 本文中の URL / @メンション / #ハッシュタグをリンク化した JSX 配列を返す。
 * テキストノードは JSX により自動エスケープされる。
 */
export function linkifyText(text: string) {
  const pattern =
    /(https?:\/\/[^\s]+)|(@[A-Za-z0-9_]{1,15})|(#[\p{L}\p{N}_]+)/gu
  const nodes: Child[] = []
  let last = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const [match, url, mention, hashtag] = m
    if (url) {
      nodes.push(
        <a key={key++} href={url} target="_blank" rel="noreferrer noopener">
          {url}
        </a>,
      )
    } else if (mention) {
      const handle = mention.slice(1)
      nodes.push(
        <a key={key++} href={`/${escapeAttr(handle)}`}>
          {mention}
        </a>,
      )
    } else if (hashtag) {
      nodes.push(
        <a key={key++} href={`/?q=${encodeURIComponent(hashtag)}`}>
          {hashtag}
        </a>,
      )
    }
    last = m.index + match.length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}
