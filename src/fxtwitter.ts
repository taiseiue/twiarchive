// fxtwitter (api.fxtwitter.com) API クライアントと型定義。
// 実測したレスポンス形状に基づく。未知のフィールドもあり得るので raw_json は別途保持する。

const API_BASE = 'https://api.fxtwitter.com'
const USER_AGENT =
  'twiarchive/1.0 (+https://github.com/taiseiue/twiarchive)'

export interface ApiPhoto {
  type: 'photo'
  id: string
  url: string
  width: number
  height: number
  altText?: string
}

export interface ApiVideoVariant {
  url: string
  bitrate?: number
  content_type: string
}

export interface ApiVideo {
  type: 'video' | 'gif'
  id: string
  url: string
  thumbnail_url: string
  duration?: number
  width: number
  height: number
  format?: string
  variants?: ApiVideoVariant[]
}

export type ApiMediaItem = ApiPhoto | ApiVideo

export interface ApiMedia {
  all?: ApiMediaItem[]
  photos?: ApiPhoto[]
  videos?: ApiVideo[]
  mosaic?: unknown | null
}

export interface ApiAuthor {
  screen_name: string
  id: string
  name: string
  url?: string
  description?: string
  location?: string
  avatar_url?: string | null
  banner_url?: string | null
  followers?: number
  following?: number
  likes?: number
  media_count?: number
  joined?: string
  protected?: boolean
  verification?: {
    verified?: boolean
    verified_at?: string | null
    type?: string
  }
}

export interface ApiTweet {
  url: string
  id: string
  text: string
  lang?: string | null
  created_at?: string
  created_timestamp?: number
  source?: string
  possibly_sensitive?: boolean
  replies?: number
  retweets?: number
  likes?: number
  bookmarks?: number
  quotes?: number
  views?: number | null
  author: ApiAuthor
  media?: ApiMedia | null
  quote?: ApiTweet | null
  replying_to?: string | null
  replying_to_status?: string | null
}

export interface ApiResponse {
  code: number
  message: string
  tweet?: ApiTweet | null
}

export class FxTwitterError extends Error {
  constructor(
    message: string,
    readonly code: number,
  ) {
    super(message)
    this.name = 'FxTwitterError'
  }
}

/**
 * fxtwitter からツイートを取得する。
 * 取得できない場合 (404 など) は FxTwitterError を投げる。
 */
export async function fetchTweet(
  screenName: string,
  id: string,
): Promise<ApiTweet> {
  const url = `${API_BASE}/${encodeURIComponent(screenName)}/status/${encodeURIComponent(id)}`
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })

  let body: ApiResponse | null = null
  try {
    body = (await res.json()) as ApiResponse
  } catch {
    throw new FxTwitterError(
      `Invalid JSON response (HTTP ${res.status})`,
      res.status,
    )
  }

  if (!body || body.code !== 200 || !body.tweet) {
    throw new FxTwitterError(
      body?.message ?? `HTTP ${res.status}`,
      body?.code ?? res.status,
    )
  }

  return body.tweet
}
