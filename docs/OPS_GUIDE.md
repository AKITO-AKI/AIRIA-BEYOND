# 運用・デプロイ・セキュリティ（統合ガイド）

このドキュメントは、散らばっていた運用／デプロイ／セキュリティ系の情報を統合したものです。

まず「変更をどう反映するか」だけ知りたい場合は、手順書を参照してください:
- [docs/DEPLOY_PLAYBOOK.md](DEPLOY_PLAYBOOK.md)

## 1. デプロイ方針（推奨順）

### A) 推奨: フロント静的 + API 常時稼働

- フロント: GitHub Pages / 共有サーバ / VPS の Nginx 静的配信
- API: Render もしくは VPS（systemd + Nginx + TLS）

理由:
- 生成は API 依存（鍵、CORS、ジョブ、認証）
- 常時稼働の API があると UX が安定（コールドスタート問題を避けやすい）

### B) Render（簡単・無料枠）

- `render.yaml` またはダッシュボードで Web Service を作成
- `node server.js` で起動
- Free は 15 分無通信でスリープ（初回が遅い）

運用のコツ:
- UX に「初回は少し待つ」説明
- 必要なら keep-alive を導入（コスト／規約と相談）

### C) VPS（Xserver VPS / Ubuntu）

- systemd で Node を常駐
- Nginx で reverse proxy
- Certbot で TLS
- UFW で 80/443/SSH のみ開ける

> 詳しい手順は旧ドキュメントを archive に退避しています（本書では要点のみ）。

### GitHub Pages + カスタムドメイン（チェックリスト）

- GitHub（Repo Settings → Pages）
	- Custom domain に `www.airia-beyond.com` を設定
	- HTTPS を有効化
- DNS（ドメイン管理側）
	- GitHub Pages の案内に従って A/AAAA もしくは CNAME を設定
- フロント（ビルド時）
	- ルート配信になるため `VITE_PUBLIC_BASE_PATH=/` を使用
	- この repo は GitHub Actions の secret `VITE_PUBLIC_BASE_PATH` で上書き可能
- API（Render の環境変数）
	- CORS 許可のため `APP_PUBLIC_URL=https://www.airia-beyond.com/`（または `APP_ALLOWED_ORIGINS` に追加）
	- OAuth を使う場合は Google/Apple 側の Origin/Redirect も更新

## 2. 監視・運用のチェックリスト

### 毎日

- `/api/health` の疎通
- 直近 24h のエラー傾向（ログ／Sentry など）
- 生成の失敗率／フォールバック率（上がっていないか）

### 週次

- 依存の脆弱性確認（`npm audit`）
- レート制限／並列制限が効いているか
- コスト（OpenAI / ComfyUI ホスト）の増加がないか

### 月次

- 依存更新（破壊的変更は別タスクで）
- 本番環境変数のバックアップ（どこに何を設定したかの棚卸し）

## 3. インシデント対応（最小手順）

1) 影響把握
- `/api/health` を確認
- 直近のデプロイ履歴／差分を確認

2) 一時対処
- 外部プロバイダ障害: フォールバックを前提に UX を保つ
- レート制限超過: まずは異常トラフィックを疑う

3) 原因調査
- API ログ（systemd / Render logs）
- クライアントエラー（Sentry など）

4) 恒久対応
- 修正 → スモーク（`npm run smoke:e2e:http`）→ デプロイ

## 4. セキュリティ（優先度順）

### 高

- admin エンドポイントを認証必須（トークン）
- 本番 CORS を許可 Origin に限定
- レート制限（IP / 将来的にユーザー単位）

### 中

- 監査ログ（誰が何をしたか）
- トークン／鍵のローテーション運用

### 低

- CSP/SRI などのヘッダ強化

## 5. “本番検証” の考え方

- フォールバック許容の E2E は「常に通る」ことが大事
- 実プロバイダを必須にした検証（strict）は、ステージングや運用確認で使う

例:
- 通常: `npm run smoke:e2e:http`
- strict: `node scripts/smoke-e2e-http.mjs --strict`
