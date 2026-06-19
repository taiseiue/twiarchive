// SQLite (node:sqlite 標準モジュール) によるデータ永続化レイヤ。
// スキーマ作成・プリペアドステートメント・CRUD ヘルパをまとめる。

import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

export const DATA_DIR = resolve(process.env.DATA_DIR ?? './data')
export const MEDIA_DIR = join(DATA_DIR, 'media')
const DB_PATH = join(DATA_DIR, 'twiarchive.db')

mkdirSync(MEDIA_DIR, { recursive: true })

export const db = new DatabaseSync(DB_PATH)

// node:sqlite の名前付きパラメータに渡せる値の型。
type SqlParams = Record<string, string | number | bigint | null | Uint8Array>

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS authors (
    id           TEXT PRIMARY KEY,
    screen_name  TEXT NOT NULL,
    name         TEXT NOT NULL,
    description  TEXT,
    avatar_path  TEXT,
    avatar_url   TEXT,
    banner_path  TEXT,
    banner_url   TEXT,
    verified     INTEGER NOT NULL DEFAULT 0,
    raw_json     TEXT NOT NULL,
    updated_at   INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_authors_screen_name ON authors (screen_name);

  CREATE TABLE IF NOT EXISTS tweets (
    id                 TEXT PRIMARY KEY,
    screen_name        TEXT NOT NULL,
    author_id          TEXT NOT NULL,
    text               TEXT NOT NULL,
    created_timestamp  INTEGER,
    lang               TEXT,
    replies            INTEGER NOT NULL DEFAULT 0,
    retweets           INTEGER NOT NULL DEFAULT 0,
    likes              INTEGER NOT NULL DEFAULT 0,
    bookmarks          INTEGER NOT NULL DEFAULT 0,
    quotes             INTEGER NOT NULL DEFAULT 0,
    views              INTEGER,
    possibly_sensitive INTEGER NOT NULL DEFAULT 0,
    quote_id           TEXT,
    replying_to_id     TEXT,
    raw_json           TEXT NOT NULL,
    archived_at        INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_tweets_created ON tweets (created_timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_tweets_screen_name ON tweets (screen_name);

  CREATE TABLE IF NOT EXISTS media (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    tweet_id       TEXT NOT NULL,
    ord            INTEGER NOT NULL,
    type           TEXT NOT NULL,
    local_path     TEXT NOT NULL,
    source_url     TEXT NOT NULL,
    thumbnail_path TEXT,
    width          INTEGER,
    height         INTEGER,
    duration       REAL,
    alt_text       TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_media_tweet ON media (tweet_id, ord);

  CREATE VIRTUAL TABLE IF NOT EXISTS tweets_fts USING fts5 (
    tweet_id UNINDEXED, text, screen_name, name
  );
`)

// ---- 行の型 ----

export interface AuthorRow {
  id: string
  screen_name: string
  name: string
  description: string | null
  avatar_path: string | null
  avatar_url: string | null
  banner_path: string | null
  banner_url: string | null
  verified: number
  raw_json: string
  updated_at: number
}

export interface TweetRow {
  id: string
  screen_name: string
  author_id: string
  text: string
  created_timestamp: number | null
  lang: string | null
  replies: number
  retweets: number
  likes: number
  bookmarks: number
  quotes: number
  views: number | null
  possibly_sensitive: number
  quote_id: string | null
  replying_to_id: string | null
  raw_json: string
  archived_at: number
}

export interface MediaRow {
  id: number
  tweet_id: string
  ord: number
  type: string
  local_path: string
  source_url: string
  thumbnail_path: string | null
  width: number | null
  height: number | null
  duration: number | null
  alt_text: string | null
}

// ---- プリペアドステートメント ----

const upsertAuthorStmt = db.prepare(`
  INSERT INTO authors
    (id, screen_name, name, description, avatar_path, avatar_url,
     banner_path, banner_url, verified, raw_json, updated_at)
  VALUES
    (:id, :screen_name, :name, :description, :avatar_path, :avatar_url,
     :banner_path, :banner_url, :verified, :raw_json, :updated_at)
  ON CONFLICT(id) DO UPDATE SET
    screen_name = excluded.screen_name,
    name        = excluded.name,
    description = excluded.description,
    avatar_path = COALESCE(excluded.avatar_path, authors.avatar_path),
    avatar_url  = excluded.avatar_url,
    banner_path = COALESCE(excluded.banner_path, authors.banner_path),
    banner_url  = excluded.banner_url,
    verified    = excluded.verified,
    raw_json    = excluded.raw_json,
    updated_at  = excluded.updated_at
`)

const upsertTweetStmt = db.prepare(`
  INSERT INTO tweets
    (id, screen_name, author_id, text, created_timestamp, lang,
     replies, retweets, likes, bookmarks, quotes, views,
     possibly_sensitive, quote_id, replying_to_id, raw_json, archived_at)
  VALUES
    (:id, :screen_name, :author_id, :text, :created_timestamp, :lang,
     :replies, :retweets, :likes, :bookmarks, :quotes, :views,
     :possibly_sensitive, :quote_id, :replying_to_id, :raw_json, :archived_at)
  ON CONFLICT(id) DO UPDATE SET
    screen_name        = excluded.screen_name,
    author_id          = excluded.author_id,
    text               = excluded.text,
    created_timestamp  = excluded.created_timestamp,
    lang               = excluded.lang,
    replies            = excluded.replies,
    retweets           = excluded.retweets,
    likes              = excluded.likes,
    bookmarks          = excluded.bookmarks,
    quotes             = excluded.quotes,
    views              = excluded.views,
    possibly_sensitive = excluded.possibly_sensitive,
    quote_id           = excluded.quote_id,
    replying_to_id     = excluded.replying_to_id,
    raw_json           = excluded.raw_json,
    archived_at        = excluded.archived_at
`)

const getAuthorStmt = db.prepare(`SELECT * FROM authors WHERE id = ?`)
const getAuthorByNameStmt = db.prepare(
  `SELECT * FROM authors WHERE screen_name = ? COLLATE NOCASE ORDER BY updated_at DESC LIMIT 1`,
)
const getTweetStmt = db.prepare(`SELECT * FROM tweets WHERE id = ?`)
const getMediaStmt = db.prepare(
  `SELECT * FROM media WHERE tweet_id = ? ORDER BY ord ASC`,
)
const deleteMediaStmt = db.prepare(`DELETE FROM media WHERE tweet_id = ?`)
const insertMediaStmt = db.prepare(`
  INSERT INTO media
    (tweet_id, ord, type, local_path, source_url, thumbnail_path,
     width, height, duration, alt_text)
  VALUES
    (:tweet_id, :ord, :type, :local_path, :source_url, :thumbnail_path,
     :width, :height, :duration, :alt_text)
`)

const deleteFtsStmt = db.prepare(`DELETE FROM tweets_fts WHERE tweet_id = ?`)
const insertFtsStmt = db.prepare(`
  INSERT INTO tweets_fts (tweet_id, text, screen_name, name)
  VALUES (:tweet_id, :text, :screen_name, :name)
`)

// ---- 書き込みヘルパ ----

export function upsertAuthor(
  row: Omit<AuthorRow, 'updated_at'> & { updated_at?: number },
): void {
  upsertAuthorStmt.run({ ...row, updated_at: row.updated_at ?? Date.now() })
}

export function upsertTweet(row: TweetRow): void {
  upsertTweetStmt.run(row as unknown as SqlParams)
}

export interface MediaInsert {
  tweet_id: string
  ord: number
  type: string
  local_path: string
  source_url: string
  thumbnail_path: string | null
  width: number | null
  height: number | null
  duration: number | null
  alt_text: string | null
}

/** 指定ツイートのメディア行を入れ替える (リフレッシュ対応)。 */
export function replaceMedia(tweetId: string, items: MediaInsert[]): void {
  deleteMediaStmt.run(tweetId)
  for (const item of items) {
    insertMediaStmt.run(item as unknown as SqlParams)
  }
}

export function syncFts(row: {
  tweet_id: string
  text: string
  screen_name: string
  name: string
}): void {
  deleteFtsStmt.run(row.tweet_id)
  insertFtsStmt.run(row)
}

// ---- 読み出しヘルパ ----

export function getAuthor(id: string): AuthorRow | undefined {
  return getAuthorStmt.get(id) as AuthorRow | undefined
}

export function getAuthorByName(screenName: string): AuthorRow | undefined {
  return getAuthorByNameStmt.get(screenName) as AuthorRow | undefined
}

export interface AuthorListRow extends AuthorRow {
  tweet_count: number
}

/** アーカイブ済み著者の一覧。ツイート数の多い順。 */
export function listAuthors(limit = 100): AuthorListRow[] {
  const stmt = db.prepare(`
    SELECT a.*,
      (SELECT COUNT(*) FROM tweets t WHERE t.author_id = a.id) AS tweet_count
    FROM authors a
    ORDER BY tweet_count DESC, a.updated_at DESC
    LIMIT ?
  `)
  return stmt.all(limit) as unknown as AuthorListRow[]
}

export function getTweet(id: string): TweetRow | undefined {
  return getTweetStmt.get(id) as TweetRow | undefined
}

export function getMedia(tweetId: string): MediaRow[] {
  return getMediaStmt.all(tweetId) as unknown as MediaRow[]
}

/** 全体タイムライン / メディア絞り込み。新しい順。 */
export function listTimeline(opts: {
  mediaOnly?: boolean
  limit?: number
  offset?: number
}): TweetRow[] {
  const limit = opts.limit ?? 50
  const offset = opts.offset ?? 0
  const where = opts.mediaOnly
    ? `WHERE id IN (SELECT DISTINCT tweet_id FROM media)`
    : ''
  const stmt = db.prepare(`
    SELECT * FROM tweets
    ${where}
    ORDER BY created_timestamp DESC, archived_at DESC
    LIMIT ? OFFSET ?
  `)
  return stmt.all(limit, offset) as unknown as TweetRow[]
}

/** ユーザー別タイムライン。 */
export function listByUser(
  screenName: string,
  opts: { limit?: number; offset?: number } = {},
): TweetRow[] {
  const stmt = db.prepare(`
    SELECT * FROM tweets
    WHERE screen_name = ? COLLATE NOCASE
    ORDER BY created_timestamp DESC, archived_at DESC
    LIMIT ? OFFSET ?
  `)
  return stmt.all(
    screenName,
    opts.limit ?? 50,
    opts.offset ?? 0,
  ) as unknown as TweetRow[]
}

/** FTS5 全文検索。ユーザー入力は安全な MATCH 文字列へ変換する。 */
export function searchTweets(
  query: string,
  opts: { limit?: number; offset?: number } = {},
): TweetRow[] {
  const match = toFtsMatch(query)
  if (!match) return []
  const stmt = db.prepare(`
    SELECT t.* FROM tweets t
    JOIN tweets_fts f ON f.tweet_id = t.id
    WHERE tweets_fts MATCH ?
    ORDER BY t.created_timestamp DESC, t.archived_at DESC
    LIMIT ? OFFSET ?
  `)
  return stmt.all(
    match,
    opts.limit ?? 50,
    opts.offset ?? 0,
  ) as unknown as TweetRow[]
}

/** 空白区切りの各トークンを前方一致 (token*) にし、特殊文字を無害化する。 */
function toFtsMatch(query: string): string {
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => `"${tok.replace(/"/g, '""')}"*`)
  return tokens.join(' ')
}
