// インライン SVG アイコン群 (絵文字は使わない)。
// stroke 系は Lucide ベース。currentColor で配色を継承する。

interface IconProps {
  size?: number
  class?: string
}

function Stroke(props: IconProps & { children: unknown }) {
  const s = props.size ?? 24
  return (
    <svg
      class={props.class}
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {props.children}
    </svg>
  )
}

export function IconLogo(props: IconProps) {
  return (
    <Stroke {...props}>
      <rect width="20" height="5" x="2" y="3" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </Stroke>
  )
}

export function IconHome(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </Stroke>
  )
}

export function IconSearch(props: IconProps) {
  return (
    <Stroke {...props}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </Stroke>
  )
}

export function IconUsers(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Stroke>
  )
}

export function IconList(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </Stroke>
  )
}

export function IconBack(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </Stroke>
  )
}

export function IconTrash(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6M14 11v6" />
    </Stroke>
  )
}

export function IconReply(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </Stroke>
  )
}

export function IconRetweet(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </Stroke>
  )
}

export function IconLike(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </Stroke>
  )
}

export function IconViews(props: IconProps) {
  return (
    <Stroke {...props}>
      <line x1="6" x2="6" y1="20" y2="14" />
      <line x1="12" x2="12" y1="20" y2="4" />
      <line x1="18" x2="18" y1="20" y2="10" />
    </Stroke>
  )
}

export function IconRefresh(props: IconProps) {
  return (
    <Stroke {...props}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </Stroke>
  )
}

export function IconSort(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="m21 16-4 4-4-4" />
      <path d="M17 20V4" />
      <path d="m3 8 4-4 4 4" />
      <path d="M7 4v16" />
    </Stroke>
  )
}

export function IconCalendar(props: IconProps) {
  return (
    <Stroke {...props}>
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18M8 2v4M16 2v4" />
    </Stroke>
  )
}

export function IconImage(props: IconProps) {
  return (
    <Stroke {...props}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
    </Stroke>
  )
}

export function IconEye(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </Stroke>
  )
}

export function IconEyeOff(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </Stroke>
  )
}

/** ブックマーク。filled=true で保存済みの塗りつぶし表示。 */
export function IconBookmark(props: IconProps & { filled?: boolean }) {
  const s = props.size ?? 24
  return (
    <svg
      class={props.class}
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill={props.filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

/** 認証済みバッジ (塗りつぶし)。X の seal アイコンを再現。 */
export function IconVerified(props: IconProps) {
  const s = props.size ?? 19
  return (
    <svg
      class={props.class}
      width={s}
      height={s}
      viewBox="0 0 22 22"
      aria-label="認証済みアカウント"
    >
      <path
        fill="currentColor"
        d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.085-1.245-1.4C11.276 1.493 10.647 1.295 10 1.277c-.646.018-1.275.215-1.816.57-.54.354-.972.852-1.246 1.438-.607-.223-1.264-.27-1.897-.14-.634.131-1.218.437-1.687.882-.445.47-.75 1.053-.882 1.687-.13.633-.083 1.29.14 1.897-.587.274-1.085.705-1.4 1.246C1.493 10.724 1.295 11.353 1.277 12c.018.646.215 1.275.57 1.816.354.54.852.972 1.438 1.246-.223.607-.27 1.264-.14 1.897.131.634.437 1.218.882 1.687.47.445 1.053.75 1.687.882.633.13 1.29.083 1.897-.14.274.587.705 1.085 1.246 1.4.54.354 1.17.552 1.816.57.646-.018 1.275-.215 1.816-.57.54-.355.972-.853 1.246-1.439.607.223 1.264.27 1.897.14.634-.131 1.218-.437 1.687-.882.445-.47.75-1.053.882-1.687.13-.633.083-1.29-.14-1.897.587-.273 1.085-.704 1.4-1.245.354-.541.552-1.17.57-1.817zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"
      />
    </svg>
  )
}
