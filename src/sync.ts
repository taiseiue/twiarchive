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
