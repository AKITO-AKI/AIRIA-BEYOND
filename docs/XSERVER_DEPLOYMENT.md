# Xserver へのデプロイ（Netlify から移行）

このプロジェクトのフロントエンドは Vite の静的ビルド（`apps/web/dist`）なので、Xserver（共有サーバ）の `public_html` にアップする方式で運用できます。

> 重要: `VITE_*` は **ビルド時に埋め込まれる** ため、Xserver 側で環境変数を設定しても反映されません。必ずビルド時に `VITE_API_BASE_URL` 等を入れてから `dist` をアップしてください。

## 1) 事前に決めること

- **フロントの公開URL**: 例 `https://example.com/`
- **APIの公開URL**: 例 `https://airia-beyond.onrender.com`
- バックエンドはどこで動かすか
  - そのまま Render/Neon を継続（推奨: 移行が最小）
  - Xserver 上で Node を動かす場合は VPS 等が必要（共有サーバでは基本不可）

## 2) バックエンド側（CORS）を更新

フロントを Xserver のドメインに替えたら、API（Render）側でフロントの Origin を許可する必要があります。

- Render の環境変数に以下を追加/更新
  - `APP_PUBLIC_URL=https://example.com`
  - `APP_ALLOWED_ORIGINS=https://example.com,https://www.example.com`

デプロイ後、フロントの診断（Auth画面の診断パネル）で `/api/health` が `OK` になれば CORS は概ねOKです。

## 3) フロントを Xserver 用にビルド

### 推奨: `.env.xserver.local` を使う

1. `apps/web/.env.xserver.example` を `apps/web/.env.xserver.local` にコピー
2. `VITE_API_BASE_URL` と `VITE_PUBLIC_BASE_PATH` を自分の環境に合わせて編集
3. リポジトリルートでビルド

- `npm run build:xserver`

生成物は `apps/web/dist` に出ます。

### 公開パス（`VITE_PUBLIC_BASE_PATH`）の目安

- `public_html` 直下（ドメインルート）に置く → `VITE_PUBLIC_BASE_PATH=/`
- `public_html/app/` 配下に置く → `VITE_PUBLIC_BASE_PATH=/app/`

## 4) Xserver にアップロード

- アップ先: `public_html/`
- `apps/web/dist` の **中身** をまるごとアップ（`dist` フォルダ自体ではなく中身）
- 既存ファイルがある場合は上書き（古い `assets/` が残ると表示崩れの原因になります）

`apps/web/public/.htaccess` を同梱しているので、Apache環境での直リンク（SPA fallback）の保険が入ります。

## 5) 動作確認チェックリスト

- ブラウザで `https://example.com/` を開ける
- Auth画面の診断で以下が満たされる
  - `API: https://...` が空でない
  - `/api/health: OK`
  - `/api/auth/config: OK`
- ログイン/新規登録が正常

## 6) Netlify を止める前の注意

- 先に Xserver 側URLで問題なく動くことを確認
- DNS 切り替えは TTL の影響で反映に時間がかかることがあります
- 旧サイトのキャッシュ（Service Worker等）を使っていない想定ですが、表示が古い場合は強制リロード/キャッシュクリアを試してください
