// fxtwitter (api.fxtwitter.com) API クライアントと型定義。
// 実測したレスポンス形状に基づく。未知のフィールドもあり得るので raw_json は別途保持する。

const API_BASE = 'https://api.fxtwitter.com'
const USER_AGENT =
  'twiarchive/1.0 (+https://github.com/taiseiue/twiarchive)'

// API が応答しないと一括同期が丸ごと止まるので、1 リクエストに上限を設ける。
const API_TIMEOUT_MS = 30_000

// タイムアウト付きで JSON API を叩く。時間切れ・通信失敗は FxTwitterError にして
// 呼び出し元 (archiveProfile など) が握りつぶせるようにする。
async function fetchJson(url: URL): Promise<Response> {
  try {
    return await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    })
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError'
    throw new FxTwitterError(
      timedOut
        ? `応答がありません (${API_TIMEOUT_MS / 1000}s で打ち切り)`
        : `通信に失敗しました: ${err instanceof Error ? err.message : String(err)}`,
      0,
    )
  }
}

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

export class FxTwitterError extends Error {
  constructor(
    message: string,
    readonly code: number,
  ) {
    super(message)
    this.name = 'FxTwitterError'
  }
}

export interface ProfileFeedPage {
  /** このページのツイート (ApiTweet へ正規化済み)。 */
  results: ApiTweet[]
  /** 次の (より古い) ページを取得するためのカーソル。末尾なら null。 */
  cursor: string | null
}

interface ProfileStatusesResponse {
  code: number
  message?: string
  results?: Array<Record<string, unknown> & { reposts?: number }>
  cursor?: { top?: string; bottom?: string }
}

/**
 * プロフィールのタイムライン 1 ページを取得する。
 * フィードの項目は単発エンドポイントと少し形が違う (retweets ではなく reposts、
 * quote / replying_to_status を含まない) ので ApiTweet へ正規化する。
 */
export async function fetchProfileStatuses(
  screenName: string,
  cursor?: string,
): Promise<ProfileFeedPage> {
  const url = new URL(
    `${API_BASE}/2/profile/${encodeURIComponent(screenName)}/statuses`,
  )
  if (cursor) url.searchParams.set('cursor', cursor)

  const res = await fetchJson(url)

  let body: ProfileStatusesResponse | null = null
  try {
    body = (await res.json()) as ProfileStatusesResponse
  } catch {
    throw new FxTwitterError(
      `Invalid JSON response (HTTP ${res.status})`,
      res.status,
    )
  }

  if (!body || body.code !== 200 || !Array.isArray(body.results)) {
    throw new FxTwitterError(
      body?.message ?? `HTTP ${res.status}`,
      body?.code ?? res.status,
    )
  }

  const results = body.results.filter(isValidStatus).map(normalizeStatus)

  return { results, cursor: body.cursor?.bottom ?? null }
}

export interface ConversationResult {
  /** 起点となるツイート。 */
  main: ApiTweet
  /** 先祖 (親チェーン) + 起点ツイートのスレッド。 */
  thread: ApiTweet[]
  /** 起点ツイートへの返信群 (このページ分)。 */
  replies: ApiTweet[]
  /** さらに返信を取得するためのカーソル。末尾/無しなら null。 */
  cursor: string | null
}

interface ConversationResponse {
  code: number
  message?: string
  status?: Record<string, unknown> | null
  thread?: Array<Record<string, unknown>>
  replies?: Array<Record<string, unknown>> | null
  cursor?: { top?: string; bottom?: string }
}

/**
 * 会話 (/2/conversation/:id) を取得する。1 回で本体・スレッド・返信をまとめて返す。
 * 返信はカーソルでページングできる。
 */
export async function fetchConversation(
  id: string,
  cursor?: string,
): Promise<ConversationResult> {
  const url = new URL(`${API_BASE}/2/conversation/${encodeURIComponent(id)}`)
  if (cursor) url.searchParams.set('cursor', cursor)

  const res = await fetchJson(url)

  let body: ConversationResponse | null = null
  try {
    body = (await res.json()) as ConversationResponse
  } catch {
    throw new FxTwitterError(
      `Invalid JSON response (HTTP ${res.status})`,
      res.status,
    )
  }

  if (!body || body.code !== 200 || !body.status) {
    throw new FxTwitterError(
      body?.message ?? `HTTP ${res.status}`,
      body?.code ?? res.status,
    )
  }

  return {
    main: normalizeStatus(body.status),
    thread: (body.thread ?? []).filter(isValidStatus).map(normalizeStatus),
    replies: (body.replies ?? []).filter(isValidStatus).map(normalizeStatus),
    cursor: body.cursor?.bottom ?? null,
  }
}

function isValidStatus(r: Record<string, unknown> | null | undefined): boolean {
  return !!r && typeof r.id === 'string' && !!r.author
}

/**
 * /2/ 系 (conversation / profile statuses) の status を ApiTweet へ正規化する。
 * - reposts -> retweets
 * - replying_to がオブジェクト ({screen_name, status}) の場合は分解
 * - quote を再帰的に正規化
 */
function normalizeStatus(raw: Record<string, unknown>): ApiTweet {
  let replyingTo: string | null = null
  let replyingToStatus: string | null = null
  const rt = raw.replying_to
  if (rt && typeof rt === 'object') {
    const o = rt as { screen_name?: string; status?: string }
    replyingTo = o.screen_name ?? null
    replyingToStatus = o.status ?? null
  } else if (typeof rt === 'string') {
    replyingTo = rt
  }
  return {
    ...(raw as unknown as ApiTweet),
    retweets:
      (raw as { reposts?: number }).reposts ??
      (raw as { retweets?: number }).retweets ??
      0,
    replying_to: replyingTo,
    replying_to_status: replyingToStatus,
    // 引用元が削除/凍結/非公開などで author を欠く場合があるので検証してから正規化する。
    quote: isValidStatus(raw.quote as Record<string, unknown>)
      ? normalizeStatus(raw.quote as Record<string, unknown>)
      : null,
  }
}
