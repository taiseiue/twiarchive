// 共通レイアウト。X(Twitter) 風の 3 カラム (左ナビ / 中央 / 右) ダークテーマ。

import type { Child } from 'hono/jsx'
import { raw } from 'hono/html'
import {
  IconBookmark,
  IconHome,
  IconList,
  IconLogo,
  IconSearch,
  IconUsers,
} from './icons.js'

export type NavKey = 'home' | 'search' | 'users' | 'lists' | 'bookmarks' | ''

const CSS = `
  :root {
    --bg: #000;
    --bg-elev: #16181c;
    --hover: rgba(231,233,234,0.1);
    --hover-soft: rgba(231,233,234,0.03);
    --border: #2f3336;
    --text: #e7e9ea;
    --muted: #71767b;
    --accent: #1d9bf0;
    --accent-hover: #1a8cd8;
    --like: #f91880;
    --rt: #00ba7c;
    --reply: #1d9bf0;
    --header-blur: rgba(0,0,0,0.65);
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      "Helvetica Neue", "Hiragino Kaku Gothic ProN", "Hiragino Sans",
      "Noto Sans JP", Meiryo, Arial, sans-serif;
    font-size: 15px;
    line-height: 1.4;
  }
  a { color: inherit; text-decoration: none; }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }

  /* ---- 3 カラム ---- */
  .layout { max-width: 1290px; margin: 0 auto; display: flex; align-items: flex-start; }

  .sidebar {
    position: sticky; top: 0; height: 100vh;
    width: 275px; flex: 0 0 auto;
    display: flex; flex-direction: column;
    padding: 8px 12px; gap: 4px;
  }
  .sidebar .logo {
    display: inline-flex; align-items: center; justify-content: center;
    width: 52px; height: 52px; border-radius: 9999px; color: var(--text);
    transition: background .15s ease;
  }
  .sidebar .logo:hover { background: var(--hover); }
  .nav { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; }
  .navitem {
    display: flex; align-items: center; gap: 18px;
    padding: 12px; border-radius: 9999px;
    font-size: 20px; color: var(--text); width: max-content; max-width: 100%;
    transition: background .15s ease;
  }
  .navitem:hover { background: var(--hover); }
  .navitem.active { font-weight: 800; }
  .navitem svg { width: 26px; height: 26px; flex: 0 0 auto; }

  /* ---- 中央カラム ---- */
  .main {
    flex: 1 1 600px; max-width: 600px; min-width: 0;
    min-height: 100vh;
    border-left: 1px solid var(--border);
    border-right: 1px solid var(--border);
  }
  .colhead {
    position: sticky; top: 0; z-index: 20;
    background: var(--header-blur); backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
    min-height: 53px; padding: 0 16px;
    display: flex; align-items: center; gap: 20px;
  }
  .colhead h2 { font-size: 20px; font-weight: 800; margin: 0; }
  .colhead .sub { font-size: 13px; color: var(--muted); font-weight: 400; }
  .iconbtn {
    display: inline-flex; align-items: center; justify-content: center;
    width: 36px; height: 36px; margin-left: -8px; border-radius: 9999px;
    color: var(--text); transition: background .15s ease;
  }
  .iconbtn:hover { background: var(--hover); }
  .colhead-action { margin-left: auto; display: flex; align-items: center; gap: 2px; }

  /* ヘッダ右の丸アイコンボタン (リスト一括同期など) */
  .headicon {
    display: inline-flex; align-items: center; justify-content: center;
    width: 34px; height: 34px; border-radius: 9999px;
    background: transparent; border: none; cursor: pointer;
    color: var(--muted); transition: background .15s ease;
  }
  .headicon:hover { background: var(--hover); }
  .headicon[disabled] { cursor: default; }
  .icon-spin { animation: spin .8s linear infinite; }

  /* ---- 並べ替えドロップダウン ---- */
  .sortmenu { position: relative; }
  .sortmenu summary {
    list-style: none; cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 12px; border-radius: 9999px;
    color: var(--text); font-size: 14px; font-weight: 700;
    transition: background .15s ease; -webkit-user-select: none; user-select: none;
  }
  .sortmenu summary::-webkit-details-marker { display: none; }
  .sortmenu summary:hover, .sortmenu[open] summary { background: var(--hover); }
  .sortmenu summary svg { width: 18px; height: 18px; color: var(--muted); flex: 0 0 auto; }
  .sortmenu-list {
    position: absolute; right: 0; top: calc(100% + 6px); z-index: 30;
    min-width: 200px; padding: 6px 0;
    background: var(--bg); border: 1px solid var(--border);
    border-radius: 12px; box-shadow: 0 0 18px rgba(0,0,0,0.65);
  }
  .sortmenu-item { display: block; padding: 12px 16px; font-size: 15px;
    font-weight: 700; color: var(--text); transition: background .15s ease; }
  .sortmenu-item:hover { background: var(--hover); }
  .sortmenu-item.active { color: var(--accent); }

  /* ---- リストタブ (ホーム) ---- */
  .tabbar {
    position: sticky; top: 53px; z-index: 19;
    display: flex; overflow-x: auto;
    background: var(--header-blur); backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
    scrollbar-width: none;
  }
  .tabbar::-webkit-scrollbar { display: none; }
  .tab {
    flex: 1 0 auto; display: flex; align-items: center; justify-content: center;
    min-height: 53px; padding: 0 16px; white-space: nowrap;
    color: var(--muted); font-weight: 700;
    transition: background .15s ease;
  }
  .tab:hover { background: var(--hover); }
  .tab span { position: relative; display: inline-flex; align-items: center;
    height: 100%; padding: 16px 0; }
  .tab.active { color: var(--text); }
  .tab.active span::after {
    content: ""; position: absolute; left: 0; right: 0; bottom: 0;
    height: 4px; border-radius: 9999px; background: var(--accent);
  }
  .tab.tab-manage { flex: 0 0 auto; color: var(--muted); }

  /* ---- 右カラム ---- */
  .rightbar {
    width: 350px; flex: 0 0 auto;
    position: sticky; top: 0; align-self: flex-start;
    padding: 12px 16px 12px 24px;
    display: flex; flex-direction: column; gap: 16px;
  }
  .panel { background: var(--bg-elev); border-radius: 16px; padding: 14px 16px; }
  .panel h3 { margin: 0 0 10px; font-size: 19px; font-weight: 800; }
  .panel .panel-row { display: block; padding: 8px 4px; border-radius: 8px; }
  .panel .panel-row:hover { background: var(--hover-soft); }

  /* ---- 検索ボックス ---- */
  .searchbox { display: flex; align-items: center; gap: 10px;
    background: var(--bg-elev); border: 1px solid transparent;
    border-radius: 9999px; padding: 10px 16px; }
  .searchbox:focus-within { border-color: var(--accent); background: var(--bg); }
  .searchbox svg { width: 18px; height: 18px; color: var(--muted); flex: 0 0 auto; }
  .searchbox input { flex: 1; min-width: 0; background: transparent; border: none;
    color: var(--text); font-size: 15px; outline: none; }
  .field { width: 100%; background: var(--bg-elev); border: 1px solid var(--border);
    color: var(--text); border-radius: 12px; padding: 10px 14px; font-size: 15px; }
  .field:focus { outline: none; border-color: var(--accent); }
  .btn { display: inline-flex; align-items: center; justify-content: center;
    background: var(--accent); color: #fff; border: none; border-radius: 9999px;
    padding: 9px 18px; font-weight: 700; font-size: 15px; cursor: pointer;
    transition: background .15s ease; }
  .btn:hover { background: var(--accent-hover); }
  .btn.block { width: 100%; }
  .checkrow { display: flex; align-items: center; gap: 8px; color: var(--muted);
    font-size: 14px; margin: 4px 0; cursor: pointer; }

  /* ---- ツイートカード ---- */
  .tweet { display: flex; gap: 12px; padding: 12px 16px;
    border-bottom: 1px solid var(--border); position: relative; }
  .tweet.row { cursor: pointer; transition: background .15s ease; }
  .tweet.row:hover { background: var(--hover-soft); }
  .tweet .row-link { position: absolute; inset: 0; z-index: 0; }
  .tweet a:not(.row-link), .tweet .actions-bar, .tweet video { position: relative; z-index: 1; }
  .avatar { width: 44px; height: 44px; border-radius: 9999px; flex: 0 0 auto;
    background: var(--bg-elev); object-fit: cover; }
  .avatar.sm { width: 20px; height: 20px; }
  .tweet-col { flex: 1 1 auto; min-width: 0; }
  .meta-line { display: flex; align-items: center; gap: 4px; font-size: 15px;
    white-space: nowrap; overflow: hidden; }
  .meta-line .name { font-weight: 700; color: var(--text);
    overflow: hidden; text-overflow: ellipsis; }
  .meta-line .handle, .meta-line .dot, .meta-line .time { color: var(--muted);
    font-weight: 400; }
  .meta-line .handle { overflow: hidden; text-overflow: ellipsis; }
  .meta-line .time:hover { text-decoration: underline; }
  .vbadge { color: var(--accent); flex: 0 0 auto; display: inline-flex; }
  .reply-ctx { color: var(--muted); font-size: 14px; margin: 1px 0 2px; }
  .reply-ctx a { color: var(--accent); }
  .tweet-body { font-size: 15px; white-space: pre-wrap; overflow-wrap: anywhere;
    margin-top: 2px; }
  .tweet-body a { color: var(--accent); }
  .tweet-body a:hover { text-decoration: underline; }

  /* 詳細表示 */
  .tweet.detail { flex-direction: column; gap: 0; }
  .tweet.detail .detail-head { display: flex; gap: 12px; align-items: center; }
  .tweet.detail .tweet-body { font-size: 23px; line-height: 1.35; margin-top: 12px; }
  .detail-date { color: var(--muted); font-size: 15px; margin: 16px 0;
    padding-bottom: 16px; border-bottom: 1px solid var(--border); }
  .detail-metrics { display: flex; gap: 20px; padding-bottom: 12px;
    border-bottom: 1px solid var(--border); font-size: 14px; color: var(--muted);
    flex-wrap: wrap; }
  .detail-metrics b { color: var(--text); }

  /* メディア */
  .media-grid { display: grid; gap: 2px; margin-top: 12px; border-radius: 16px;
    overflow: hidden; border: 1px solid var(--border); }
  .media-grid.n1 { grid-template-columns: 1fr; }
  .media-grid.n2, .media-grid.n3, .media-grid.n4 { grid-template-columns: 1fr 1fr; }
  .media-grid img, .media-grid video { width: 100%; height: 100%;
    object-fit: cover; display: block; max-height: 510px; background: #000; }
  .media-grid.n1 img, .media-grid.n1 video { object-fit: contain; }
  .media-grid.n3 .m0 { grid-row: span 2; }

  /* 引用 */
  .quote { margin-top: 12px; border: 1px solid var(--border);
    border-radius: 16px; padding: 10px 12px; display: block;
    transition: background .15s ease; }
  .quote:hover { background: var(--hover-soft); }
  .quote .meta-line { font-size: 14px; }
  .quote .tweet-body { font-size: 14px; }
  .quote .media-grid { margin-top: 8px; }

  /* アクションバー (表示のみ) */
  .actions-bar { display: flex; justify-content: space-between;
    max-width: 420px; margin-top: 10px; color: var(--muted); }
  .act { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; }
  .act svg { width: 18px; height: 18px; }
  .act.reply:hover { color: var(--reply); }
  .act.rt:hover { color: var(--rt); }
  .act.like:hover { color: var(--like); }

  /* ---- ブックマークボタン + ドロップダウン (ツイートアクション内) ---- */
  .bmmenu { position: relative; display: inline-flex; }
  .bmmenu > summary {
    list-style: none; cursor: pointer; -webkit-user-select: none; user-select: none;
    display: inline-flex; align-items: center; justify-content: center;
    color: var(--muted); transition: color .15s ease;
  }
  .bmmenu > summary::-webkit-details-marker { display: none; }
  .bmmenu > summary svg { width: 18px; height: 18px; }
  .bmmenu > summary:hover { color: var(--accent); }
  .bmmenu.is-saved > summary { color: var(--accent); }
  .bmmenu-list {
    position: absolute; right: 0; top: calc(100% + 6px); z-index: 30;
    min-width: 220px; max-height: 320px; overflow-y: auto; padding: 6px 0;
    background: var(--bg); border: 1px solid var(--border);
    border-radius: 12px; box-shadow: 0 0 18px rgba(0,0,0,0.65);
  }
  .bmmenu-head { padding: 10px 16px 6px; font-size: 13px; font-weight: 700;
    color: var(--muted); }
  .bmmenu form { display: block; }
  .bmmenu-item {
    width: 100%; display: flex; align-items: center; gap: 10px;
    padding: 12px 16px; font-size: 15px; font-weight: 700; color: var(--text);
    background: transparent; border: none; cursor: pointer; text-align: left;
    transition: background .15s ease;
  }
  .bmmenu-item:hover { background: var(--hover); }
  .bmmenu-name { flex: 1; overflow: hidden; text-overflow: ellipsis;
    white-space: nowrap; }
  .bmmenu-check { margin-left: auto; color: var(--accent); font-weight: 800;
    visibility: hidden; }
  .bmmenu-item.active .bmmenu-check { visibility: visible; }
  .bmmenu-empty { display: block; padding: 12px 16px; font-size: 14px;
    color: var(--accent); }
  .detail-bm { margin-left: auto; }

  /* ユーザー一覧 */
  .user-row { display: flex; gap: 12px; align-items: center;
    padding: 12px 16px; border-bottom: 1px solid var(--border);
    transition: background .15s ease; }
  .user-row:hover { background: var(--hover-soft); }
  .user-row .uinfo { min-width: 0; flex: 1; }
  .user-row .uname { font-weight: 700; display: flex; align-items: center; gap: 4px; }
  .user-row .uhandle, .user-row .ucount { color: var(--muted); font-size: 14px; }
  .user-row .ubio { font-size: 14px; margin-top: 2px;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    overflow: hidden; }

  /* プロフィール */
  .profile-banner { width: 100%; aspect-ratio: 3/1; object-fit: cover;
    display: block; background: var(--bg-elev); }
  .profile-head { padding: 12px 16px; border-bottom: 1px solid var(--border); }
  .profile-avatar { width: 84px; height: 84px; border-radius: 9999px;
    border: 4px solid var(--bg); margin-top: -52px; background: var(--bg-elev);
    object-fit: cover; }
  .profile-name { font-size: 21px; font-weight: 800; display: flex;
    align-items: center; gap: 6px; margin-top: 8px; }
  .profile-handle { color: var(--muted); }
  .profile-bio { margin-top: 10px; white-space: pre-wrap; }
  .profile-stats { display: flex; gap: 18px; margin-top: 12px; color: var(--muted);
    font-size: 14px; }
  .profile-stats b { color: var(--text); }

  /* ---- リスト追加 (Twitter フォローボタン風) ---- */
  /* アバター (左, バナーに被って上にせり出す) とフォローボタン (右) を同じ行に並べ、
     ボタンをバナー右下に置く。 */
  .profile-top { display: flex; align-items: flex-start;
    justify-content: space-between; gap: 12px; }
  .followmenu { position: relative; flex: 0 0 auto; }
  .followmenu > summary {
    list-style: none; cursor: pointer; -webkit-user-select: none; user-select: none;
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 116px; padding: 8px 18px; border-radius: 9999px;
    font-size: 15px; font-weight: 700; border: 1px solid transparent;
    transition: background .15s ease, color .15s ease, border-color .15s ease;
  }
  .followmenu > summary::-webkit-details-marker { display: none; }
  /* 未追加: 白塗りのフォローボタン */
  .followmenu > summary { background: var(--text); color: var(--bg); }
  .followmenu > summary:hover { background: #d2d6d8; }
  /* 追加済み: 枠線ボタン。ホバーで赤い「フォロー解除」 */
  .followmenu.is-following > summary {
    background: transparent; color: var(--text); border-color: var(--border);
  }
  .followmenu.is-following > summary:hover {
    color: #f4212e; border-color: rgba(244,33,46,0.4);
    background: rgba(244,33,46,0.1);
  }
  .follow-label.unfollow { display: none; }
  .followmenu.is-following > summary:hover .follow-label.following { display: none; }
  .followmenu.is-following > summary:hover .follow-label.unfollow { display: inline; }
  /* ドロップダウン */
  .followmenu-list {
    position: absolute; right: 0; top: calc(100% + 6px); z-index: 30;
    min-width: 240px; padding: 6px 0; background: var(--bg);
    border: 1px solid var(--border); border-radius: 12px;
    box-shadow: 0 0 18px rgba(0,0,0,0.65);
  }
  .followmenu-head { padding: 10px 16px 6px; font-size: 13px; font-weight: 700;
    color: var(--muted); }
  .followmenu form { display: block; }
  .followmenu-item {
    width: 100%; display: flex; align-items: center; gap: 10px;
    padding: 12px 16px; font-size: 15px; font-weight: 700; color: var(--text);
    background: transparent; border: none; cursor: pointer; text-align: left;
    transition: background .15s ease;
  }
  .followmenu-item:hover { background: var(--hover); }
  .followmenu-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .followmenu-check { margin-left: auto; color: var(--accent); font-weight: 800;
    visibility: hidden; }
  .followmenu-item.active .followmenu-check { visibility: visible; }

  /* 同期バー */
  .syncbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    padding: 12px 16px; border-bottom: 1px solid var(--border); }
  .syncbar form { display: flex; gap: 8px; }
  .btn.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
  .btn.ghost:hover { background: var(--hover); }
  .btn.sm { padding: 7px 16px; font-size: 14px; }
  .sync-status { color: var(--muted); font-size: 14px;
    display: inline-flex; align-items: center; gap: 8px; }
  .sync-status.err { color: #f4212e; }
  .spinner { width: 16px; height: 16px; border: 2px solid var(--border);
    border-top-color: var(--accent); border-radius: 9999px;
    animation: spin .8s linear infinite; flex: 0 0 auto; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .loadmore { display: block; text-align: center; padding: 16px;
    color: var(--accent); font-weight: 700;
    border-bottom: 1px solid var(--border); transition: background .15s ease; }
  .loadmore:hover { background: var(--hover-soft); }

  .empty { padding: 48px 24px; text-align: center; color: var(--muted); }
  .empty h3 { color: var(--text); font-size: 20px; margin: 0 0 6px; }
  .error { padding: 48px 24px; text-align: center; }
  .error h2 { color: var(--text); }
  .muted { color: var(--muted); }

  /* ---- レスポンシブ ---- */
  @media (max-width: 1300px) {
    .sidebar { width: 88px; align-items: center; }
    .navitem span { display: none; }
    .navitem { gap: 0; }
  }
  @media (max-width: 1080px) {
    .rightbar { display: none; }
    .main { flex-basis: 600px; }
  }
  @media (max-width: 767px) {
    .layout { display: block; }
    .sidebar {
      position: fixed; bottom: 0; left: 0; right: 0; top: auto;
      height: auto; width: auto; flex-direction: row;
      padding: 0; gap: 0; z-index: 100;
      background: var(--header-blur); backdrop-filter: blur(12px);
      border-top: 1px solid var(--border);
      padding-bottom: env(safe-area-inset-bottom);
    }
    .sidebar .logo { display: none; }
    /* ナビ項目を縦並びから横並びに変え、ボトムバーいっぱいに広げる */
    .sidebar .nav {
      flex-direction: row; width: 100%; margin-top: 0; gap: 0;
    }
    .navitem {
      flex: 1 1 0; justify-content: center; gap: 0;
      padding: 12px 0; border-radius: 0; font-size: 0;
    }
    .navitem span { display: none; }
    .navitem svg { width: 24px; height: 24px; }
    .main { max-width: none; border-left: none; border-right: none;
      padding-bottom: calc(56px + env(safe-area-inset-bottom)); }
  }

  @media (prefers-reduced-motion: reduce) {
    * { transition: none !important; animation: none !important; }
  }
`

export function Layout(props: {
  title: string
  active?: NavKey
  right?: Child
  /** 指定秒ごとにページを自動リロード (同期の進捗表示用)。 */
  metaRefresh?: number
  children?: Child
}) {
  const active = props.active ?? ''
  const navClass = (key: NavKey) => `navitem${active === key ? ' active' : ''}`
  return (
    <>
      {raw('<!DOCTYPE html>')}
      <html lang="ja">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          {props.metaRefresh ? (
            <meta http-equiv="refresh" content={String(props.metaRefresh)} />
          ) : null}
          <title>{props.title}</title>
          <style dangerouslySetInnerHTML={{ __html: CSS }} />
        </head>
        <body>
          <div class="layout">
            <nav class="sidebar" aria-label="メインナビゲーション">
              <a class="logo" href="/" aria-label="ホーム">
                <IconLogo size={28} />
              </a>
              <div class="nav">
                <a class={navClass('home')} href="/">
                  <IconHome />
                  <span>ホーム</span>
                </a>
                <a class={navClass('search')} href="/search">
                  <IconSearch />
                  <span>検索</span>
                </a>
                <a class={navClass('users')} href="/users">
                  <IconUsers />
                  <span>ユーザー</span>
                </a>
                <a class={navClass('lists')} href="/lists">
                  <IconList />
                  <span>リスト</span>
                </a>
                <a class={navClass('bookmarks')} href="/bookmarks">
                  <IconBookmark />
                  <span>ブックマーク</span>
                </a>
              </div>
            </nav>
            <main class="main">{props.children}</main>
            {props.right ? <aside class="rightbar">{props.right}</aside> : null}
          </div>
        </body>
      </html>
    </>
  )
}
