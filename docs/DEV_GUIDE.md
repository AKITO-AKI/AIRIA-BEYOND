# 開発・テストガイド（ローカル起動／スモーク／検証）

## 前提

- Node.js: 18 以上（推奨 20）
- npm: 9 以上

## セットアップ

```bash
npm install
```

必要に応じて `.env` を作成:

```bash
cp .env.example .env
```

代表的な環境変数:

- `OPENAI_API_KEY`（未設定でも rule-based にフォールバック）
- `REPLICATE_API_TOKEN`（未設定でも placeholder/ComfyUI などにフォールバック）
- `IMAGE_PROVIDER=comfyui`（ローカル ComfyUI を使う場合）
- `DISABLE_LLM_ANALYSIS=true`（分析を LLM ではなくルールベースに固定）

## ローカル起動

### フロント + API を同時起動

```bash
npm run dev
```

- Web: `http://localhost:5173/AIRIA-BEYOND/`
- API: `http://localhost:3000/api/*`

### API のみ

```bash
npm run dev:api
```

## スモークテスト（重要）

このリポジトリでは「壊れにくさ」をスモークで担保します。

### 1) HTTP E2E（フォールバック許容）

```bash
npm run smoke:e2e:http
```

- ローカルでサーバを起動して `/api/health` → refine → music → image を叩きます
- キー未設定でも **rule-based / placeholder** で完走するのが正です

### 2) strict-provider（実プロバイダ必須）

実環境で「本当に OpenAI/Ollama と Replicate/ComfyUI を使えているか」を検証する用途です。

```bash
node scripts/smoke-e2e-http.mjs --strict
```

- `/api/health` の configured フラグを前提に、フォールバック（rule-based/placeholder）を許容しません

### 3) その他スモーク（用途別）

- ComfyUI 直叩き: `npm run smoke:comfyui`
- Image API + ComfyUI: `npm run smoke:image:comfyui`
- 依存の import 確認: `npm run smoke:require`
- 音楽コントローラ import + タイムアウト: `npm run smoke:music-controller`
- 芸術パイプライン（非 HTTP）: `npm run smoke:artistic`

## よくあるトラブル

- 生成が遅い／失敗する
  - まず `npm run smoke:e2e:http` が通るか確認（フォールバックで良い）
  - strict で落ちる場合は環境変数やプロバイダ疎通が原因

- CORS エラー
  - API 側の `APP_ALLOWED_ORIGINS` / `APP_PUBLIC_URL` を見直す

- 認証が消える（プレリリース）
  - JSON ストアの場合、バックエンド再起動／再デプロイで初期化される可能性あり
  - 本番は Postgres（Neon など）への移行を推奨
