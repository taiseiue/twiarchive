# twiarchive

Twitter (X) の投稿をアーカイブして、Twitter クローン風に閲覧できる自己ホスト型アプリ。

`http://localhost:3000/:username/status/:id` にアクセスすると、未アーカイブの場合は
[fxtwitter API](https://api.fxtwitter.com) から投稿を取得して SQLite と画像/動画ファイルに保存し、
アーカイブ済みの場合は保存済みデータを表示します。引用・リプライ元も再帰的に保存します。

## 使い方

```sh
pnpm install
pnpm dev      # 開発サーバ (http://localhost:3000)
```

本番:

```sh
pnpm build    # tsc で dist/ に出力
pnpm start    # node dist/index.js
# または
docker compose up --build
```

### 主なルート

| パス | 説明 |
| --- | --- |
| `/:username/status/:id` | 投稿の表示。未取得なら取得してから表示。`?refresh=1` で再取得 |
| `/` | 全体タイムライン。`?q=...` で全文検索、`?media=1` でメディア有りのみ |
| `/:username` | ユーザー別のプロフィール + タイムライン |
| `/go?url=<ツイートURL>` | 貼り付けた URL を該当パスへリダイレクト |
| `/media/*` | 保存済みメディアの配信 (Range 対応) |

## データ

- SQLite: `DATA_DIR`(既定 `./data`)/`twiarchive.db` — Node 標準の `node:sqlite` を使用
- メディア: `DATA_DIR/media/` 配下に画像・動画・サムネ・アバター・バナーを保存

## 技術スタック

Hono + `@hono/node-server`、`hono/jsx` による SSR、`node:sqlite`(FTS5)。追加の DB/ORM 依存なし。
