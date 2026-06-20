// ツイート表示コンポーネント群 (カード / メディアグリッド / 引用 / アクションバー)。

import type { Child } from 'hono/jsx'
import type { BookmarkListWithCount, MediaRow } from '../db.js'
import {
  avatarSrc,
  formatCount,
  formatDate,
  formatRelative,
  linkifyText,
  mediaUrl,
  type TweetView,
} from './model.js'
import {
  IconBookmark,
  IconLike,
  IconReply,
  IconRetweet,
  IconVerified,
  IconViews,
} from './icons.js'

function permalink(v: { screenName: string; id: string }): string {
  return `/${v.screenName}/status/${v.id}`
}

function MediaGrid(props: { media: MediaRow[]; detail: boolean }) {
  const { media, detail } = props
  if (media.length === 0) return null
  const n = Math.min(media.length, 4)
  return (
    <div class={`media-grid n${n}`}>
      {media.map((m, i) => {
        const src = mediaUrl(m.local_path)!
        const poster = mediaUrl(m.thumbnail_path) ?? undefined
        if (m.type === 'video' || m.type === 'gif') {
          if (detail) {
            return (
              <video
                class={`m${i}`}
                controls
                preload="metadata"
                poster={poster}
                loop={m.type === 'gif'}
              >
                <source src={src} />
              </video>
            )
          }
          return (
            <img class={`m${i}`} src={poster ?? src} alt="" loading="lazy" />
          )
        }
        return (
          <img class={`m${i}`} src={src} alt={m.alt_text ?? ''} loading="lazy" />
        )
      })}
    </div>
  )
}

function MetaLine(props: { view: TweetView; withTime?: boolean }) {
  const v = props.view
  return (
    <div class="meta-line">
      <a class="name" href={`/${v.screenName}`}>
        {v.name}
      </a>
      {v.verified ? (
        <span class="vbadge">
          <IconVerified size={18} />
        </span>
      ) : null}
      <a class="handle" href={`/${v.screenName}`}>
        @{v.screenName}
      </a>
      {props.withTime ? (
        <>
          <span class="dot">·</span>
          <a class="time" href={permalink(v)}>
            {formatRelative(v.createdTimestamp)}
          </a>
        </>
      ) : null}
    </div>
  )
}

// ツイートのブックマークボタン。押すとリスト一覧のドロップダウンが開き、
// 各リストへの保存/解除を <details>+フォームで切り替える (JS 不要)。
// 送信後は Referer へ戻るので、開いていたページがそのまま再描画される。
function BookmarkMenu(props: {
  view: TweetView
  lists: BookmarkListWithCount[]
}) {
  const v = props.view
  const member = new Set(v.bookmarkedIn)
  const saved = member.size > 0
  return (
    <details class={`bmmenu${saved ? ' is-saved' : ''}`}>
      <summary class="act bm" aria-label="ブックマーク">
        <IconBookmark size={18} filled={saved} />
      </summary>
      <div class="bmmenu-list" role="menu">
        <div class="bmmenu-head">ブックマークに保存</div>
        {props.lists.length === 0 ? (
          <a class="bmmenu-empty" href="/bookmarks">
            ブックマークリストを作成
          </a>
        ) : (
          props.lists.map((l) => {
            const inList = member.has(l.id)
            return (
              <form method="post" action={`/bookmarks/${l.id}/tweets`}>
                <input type="hidden" name="tweet_id" value={v.id} />
                <input
                  type="hidden"
                  name="action"
                  value={inList ? 'remove' : 'add'}
                />
                <button
                  class={`bmmenu-item${inList ? ' active' : ''}`}
                  type="submit"
                  role="menuitemcheckbox"
                  aria-checked={inList ? 'true' : 'false'}
                >
                  <span class="bmmenu-name">{l.name}</span>
                  <span class="bmmenu-check" aria-hidden="true">
                    ✓
                  </span>
                </button>
              </form>
            )
          })
        )}
      </div>
    </details>
  )
}

function ActionsBar(props: {
  view: TweetView
  bookmarkLists: BookmarkListWithCount[]
}) {
  const v = props.view
  return (
    <div class="actions-bar">
      <span class="act reply" aria-hidden="true">
        <IconReply />
        {formatCount(v.replies)}
      </span>
      <span class="act rt" aria-hidden="true">
        <IconRetweet />
        {formatCount(v.retweets)}
      </span>
      <span class="act like" aria-hidden="true">
        <IconLike />
        {formatCount(v.likes)}
      </span>
      <span class="act views" aria-hidden="true">
        <IconViews />
        {v.views != null ? formatCount(v.views) : ''}
      </span>
      <BookmarkMenu view={v} lists={props.bookmarkLists} />
    </div>
  )
}

function QuoteCard(props: { view: TweetView }) {
  const v = props.view
  return (
    <a class="quote" href={permalink(v)}>
      <div class="meta-line">
        <img class="avatar sm" src={avatarSrc(v)} alt="" loading="lazy" />
        <span class="name">{v.name}</span>
        {v.verified ? (
          <span class="vbadge">
            <IconVerified size={16} />
          </span>
        ) : null}
        <span class="handle">@{v.screenName}</span>
      </div>
      {v.text ? <div class="tweet-body">{v.text}</div> : null}
      <MediaGrid media={v.media} detail={false} />
    </a>
  )
}

function ReplyContext(props: { view: TweetView }) {
  const v = props.view
  if (!v.replyingTo) return null
  return (
    <div class="reply-ctx">
      返信先{' '}
      <a href={`/${v.replyingTo.screenName}`}>@{v.replyingTo.screenName}</a>さん
    </div>
  )
}

/** 一覧用のツイートカード (X 風の横並び)。カード全体がクリック可能。 */
export function TweetCard(props: {
  view: TweetView
  bookmarkLists?: BookmarkListWithCount[]
}) {
  const v = props.view
  return (
    <article class="tweet row">
      <a class="row-link" href={permalink(v)} aria-label="ポストを開く" />
      <a href={`/${v.screenName}`}>
        <img class="avatar" src={avatarSrc(v)} alt="" loading="lazy" />
      </a>
      <div class="tweet-col">
        <MetaLine view={v} withTime />
        <ReplyContext view={v} />
        {v.text ? <div class="tweet-body">{linkifyText(v.text)}</div> : null}
        <MediaGrid media={v.media} detail={false} />
        {v.quote ? <QuoteCard view={v.quote} /> : null}
        <ActionsBar view={v} bookmarkLists={props.bookmarkLists ?? []} />
      </div>
    </article>
  )
}

/** 詳細表示のツイート (本文大きめ・日時・メトリクス)。 */
export function TweetDetail(props: {
  view: TweetView
  bookmarkLists?: BookmarkListWithCount[]
}) {
  const v = props.view
  return (
    <article class="tweet detail">
      <ReplyContext view={v} />
      <div class="detail-head">
        <a href={`/${v.screenName}`}>
          <img class="avatar" src={avatarSrc(v)} alt="" loading="lazy" />
        </a>
        <MetaLine view={v} />
        <div class="detail-bm">
          <BookmarkMenu view={v} lists={props.bookmarkLists ?? []} />
        </div>
      </div>
      {v.text ? <div class="tweet-body">{linkifyText(v.text)}</div> : null}
      <MediaGrid media={v.media} detail />
      {v.quote ? <QuoteCard view={v.quote} /> : null}
      <div class="detail-date">{formatDate(v.createdTimestamp)}</div>
      <div class="detail-metrics">
        <span>
          <b>{formatCount(v.replies)}</b> 返信
        </span>
        <span>
          <b>{formatCount(v.retweets)}</b> リポスト
        </span>
        <span>
          <b>{formatCount(v.likes)}</b> いいね
        </span>
        {v.views != null ? (
          <span>
            <b>{formatCount(v.views)}</b> 表示
          </span>
        ) : null}
      </div>
    </article>
  )
}

/** ツイート配列をタイムラインとして描画。nextHref があれば「もっと見る」を表示。 */
export function Timeline(props: {
  views: TweetView[]
  empty?: Child
  nextHref?: string
  bookmarkLists?: BookmarkListWithCount[]
}) {
  if (props.views.length === 0) {
    return (
      <div class="empty">
        {props.empty ?? <p>まだアーカイブがありません。</p>}
      </div>
    )
  }
  return (
    <div>
      {props.views.map((v) => (
        <TweetCard view={v} bookmarkLists={props.bookmarkLists} />
      ))}
      {props.nextHref ? (
        <a class="loadmore" href={props.nextHref}>
          もっと見る
        </a>
      ) : null}
    </div>
  )
}
