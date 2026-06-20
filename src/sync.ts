// プロフィール一括アーカイブをバックグラウンドで走らせ、進捗をメモリ上で管理する。
// クライアント JS を使わず、ページの自動リロードで進捗を見せるための状態保持。

import { archiveProfile } from './archive.js'

export interface SyncState {
  running: boolean
  added: number
  pages: number
  error: string | null
  startedAt: number | null
  finishedAt: number | null
}

const IDLE: SyncState = {
  running: false,
  added: 0,
  pages: 0,
  error: null,
  startedAt: null,
  finishedAt: null,
}

const states = new Map<string, SyncState>()
const key = (name: string) => name.toLowerCase()

export function getSyncState(name: string): SyncState {
  return states.get(key(name)) ?? IDLE
}

/**
 * バックグラウンド同期を開始する (fire-and-forget)。
 * すでに走っている場合は二重起動せず現在の状態を返す。
 */
export function startSync(name: string, refresh = false): SyncState {
  const k = key(name)
  const current = states.get(k)
  if (current?.running) return current

  const state: SyncState = {
    running: true,
    added: 0,
    pages: 0,
    error: null,
    startedAt: Date.now(),
    finishedAt: null,
  }
  states.set(k, state)

  void archiveProfile(name, {
    refresh,
    onProgress: (p) => {
      state.added = p.added
      state.pages = p.pages
    },
  })
    .then((r) => {
      state.added = r.added
      state.pages = r.pages
    })
    .catch((e) => {
      state.error = e instanceof Error ? e.message : String(e)
    })
    .finally(() => {
      state.running = false
      state.finishedAt = Date.now()
    })

  return state
}

// ---- リスト一括同期 ----
// リストに属するユーザーを 1 人ずつ順番に同期する。1 人失敗しても続行し、
// エラーは最後にまとめて報告する。進捗はメモリ上でリスト id ごとに保持。

export interface ListSyncState {
  running: boolean
  /** 同期対象のユーザー総数。 */
  total: number
  /** 完了済みのユーザー数。 */
  done: number
  /** 現在同期中のユーザー名 (なければ null)。 */
  current: string | null
  /** 全ユーザー合計の新規取得件数。 */
  added: number
  /** 失敗したユーザーの一覧 (@名: 理由)。 */
  errors: string[]
  startedAt: number | null
  finishedAt: number | null
}

const LIST_IDLE: ListSyncState = {
  running: false,
  total: 0,
  done: 0,
  current: null,
  added: 0,
  errors: [],
  startedAt: null,
  finishedAt: null,
}

const listStates = new Map<number, ListSyncState>()

export function getListSyncState(listId: number): ListSyncState {
  return listStates.get(listId) ?? LIST_IDLE
}

/**
 * リスト内の全ユーザーを順番に同期する (fire-and-forget)。
 * すでに走っている場合は二重起動せず現在の状態を返す。
 */
export function startListSync(
  listId: number,
  usernames: string[],
  refresh = false,
): ListSyncState {
  const current = listStates.get(listId)
  if (current?.running) return current

  const state: ListSyncState = {
    running: true,
    total: usernames.length,
    done: 0,
    current: null,
    added: 0,
    errors: [],
    startedAt: Date.now(),
    finishedAt: null,
  }
  listStates.set(listId, state)

  void (async () => {
    // これまでに完了したユーザーの合計。現在のユーザーの進捗を足して added とする。
    let base = 0
    for (const name of usernames) {
      state.current = name
      try {
        const r = await archiveProfile(name, {
          refresh,
          // ユーザー内の進捗もリアルタイムに反映し、大きなアカウントで
          // 止まって見えないようにする。
          onProgress: (p) => {
            state.added = base + p.added
          },
        })
        base += r.added
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        state.errors.push(`@${name}: ${msg}`)
      }
      state.added = base
      state.done += 1
    }
  })().finally(() => {
    state.running = false
    state.current = null
    state.finishedAt = Date.now()
  })

  return state
}
