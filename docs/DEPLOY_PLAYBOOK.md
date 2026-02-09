# 変更を本番に反映する手順書（AIRIA-BEYOND）

この手順書は「どこを直したら、どこをどう更新すれば本番に反映されるか」を迷わず辿れるようにまとめたものです。

- フロント（Web UI）: GitHub Pages（GitHub Actions で自動デプロイ）
- API（/api/*）: Render（Web Service）

---

## 0) まず結論（最短）

### UI/フロントだけ直した

1. `main` に push
2. GitHub Actions の `Deploy to GitHub Pages` が完了するのを待つ
3. ブラウザで `Ctrl+F5`（強制リロード）

### APIだけ直した（server.js / api/*）

1. `main` に push
2. Render が自動デプロイ（または手動 Deploy）完了するのを待つ
3. 疎通: `https://airia-beyond.onrender.com/api/health`

### Render の環境変数だけ直した

- Render ダッシュボードで env を更新 → **Restart service**（再起動）
  - 変更が反映されないときは **Manual Deploy** でもOK

---

## 1) 反映先マップ（ここが一番大事）

| 変更したもの | 反映先 | 反映方法 |
|---|---|---|
| `apps/web/src/**`（React/TS/CSS） | フロント | `main` push → GitHub Actions → Pages |
| `apps/web/public/**`（画像/CNAME等） | フロント | `main` push → GitHub Actions → Pages |
| `server.js` / `api/**` | API | `main` push → Render deploy |
| GitHub Secrets（`VITE_*`） | フロント | **ビルド時に埋め込み** → 再ビルド/再デプロイが必要 |
| Render Env（`APP_*` 等） | API | **実行時に参照** → Restart で反映 |

重要:
- `VITE_*` は **フロントのビルド時に固定**されます（実行時に変えても反映されません）。
- Render の `APP_*` は **API 実行時に参照**されます（Restart で反映）。

---

## 2) フロント（GitHub Pages）反映手順

### 2-1. いつも通り（推奨）: GitHub Actions で自動デプロイ

1) 変更を commit

2) `main` に push

3) GitHub の Actions タブで以下を確認
- Workflow: `Deploy to GitHub Pages`
- Job が緑になったら反映完了

4) ブラウザで確認
- キャッシュが残ることがあるので `Ctrl+F5`

### 2-2. 注意: `npm run deploy` について

このリポジトリは [GitHub Actions の Pages デプロイ](../.github/workflows/deploy.yml) が前提です。

- `npm run deploy`（gh-pages）は **成功しても本番が更新されない**ことがあります
  - GitHub Settings → Pages → Build and deployment が「GitHub Actions」になっている場合

迷ったら: **`main` に push → Actions 完了** が正です。

---

## 3) API（Render）反映手順

### 3-1. コード変更を反映

1) 変更を commit

2) `main` に push

3) Render 側の挙動（どちらか）
- Auto Deploy がON: push を検知して自動デプロイ
- OFF/手動: Render ダッシュボードから `Manual Deploy`

4) 反映確認
- `https://airia-beyond.onrender.com/api/health`
- `https://airia-beyond.onrender.com/api/diagnostics/version`
  - `commit` が出る場合、どのコミットが動いているか追えます

### 3-2. Render 環境変数の変更を反映

- Render ダッシュボード → Environment で値更新
- **Restart service**

---

## 4) カスタムドメイン（www.airia-beyond.com）運用の要点

### 4-1. フロント側

- GitHub Pages の Custom domain は `www.airia-beyond.com`
- ルート配信（`/`）になるので、フロントの `VITE_PUBLIC_BASE_PATH` は `/`
  - この repo は GitHub Secrets の `VITE_PUBLIC_BASE_PATH` で上書きできます

### 4-2. API側（CORS）

フロントとAPIが別オリジンなので、API側で `Origin` を許可する必要があります。

推奨（末尾スラッシュ無し）:
- `APP_PUBLIC_URL=https://www.airia-beyond.com`
- `APP_ALLOWED_ORIGINS=https://www.airia-beyond.com,https://airia-beyond.com`

※ ブラウザの `Origin` は末尾 `/` が付かないため、末尾 `/` 付きだけを登録するとズレることがあります。

---

## 5) 反映確認チェック（トラブル時の切り分け）

### 5-1. フロントが更新されない

- Actions が成功しているか（失敗していたら本番は更新されません）
- 強制リロード（`Ctrl+F5`）
- それでも怪しい場合: いったん別ブラウザ/シークレットで確認

### 5-2. ログイン/通信が NG（CORS/接続系）

APIは生きているが、特定Originだけ失敗するケースが多いです。

確認（Windows PowerShell 例）:
- `curl.exe -i https://airia-beyond.onrender.com/api/health`
- `curl.exe -i -H "Origin: https://www.airia-beyond.com" https://airia-beyond.onrender.com/api/health`

期待:
- 200 かつ `access-control-allow-origin: https://www.airia-beyond.com`

500/未応答なら:
- Render env の `APP_PUBLIC_URL` / `APP_ALLOWED_ORIGINS`
- Render の再起動（env反映）
- Render が正しいブランチ/リポジトリをデプロイしているか

---

## 6) よくある“反映されない”原因トップ3

1) フロントの変更なのに Render をいじっていた（逆もある）
2) `VITE_*` を本番の Secrets に入れたが **再ビルドされていない**（＝Actionsが走ってない/失敗）
3) Render env を変えたのに **再起動していない**

---

## 7) 画像生成の精度を上げる（クラシック音楽ジャケット向け）

このプロジェクトでは、画像生成は以下の2層で品質を上げられます。

1) **LLM がプロンプトを美術監督として翻訳**（自然言語 + 構図/照明/質感）
2) **ComfyUI のワークフローを強化**（LoRA / Hi-Res Fix / Refiner）

### 7-0. 画像生成は ComfyUI に固定（運用を簡単にする）

このプロジェクトは **ComfyUI 統一** で運用します（Replicate 経路は無効化済み）。

Render（API）の Environment に最低限入れるもの:

- `IMAGE_PROVIDER=comfyui`
- `COMFYUI_BASE_URL=http(s)://<Render から到達できる ComfyUI>:8188`

任意（品質・固定化）:

- `COMFYUI_CHECKPOINT=...`
- `COMFYUI_STEPS=30`
- `COMFYUI_CFG=7.0`
- `COMFYUI_SAMPLER=dpmpp_2m`
- `COMFYUI_SCHEDULER=karras`
- `COMFYUI_TIMEOUT_MS=240000`
- `COMFYUI_HTTP_TIMEOUT_MS=20000`
- 7-2 の LoRA / Hi-Res Fix / Refiner / IP-Adapter

重要:

- Render 上の API からローカルPCの ComfyUI（`http://127.0.0.1:8188`）へは基本的に接続できません。
- 本番 ComfyUI は「VPS/同一LANの到達可能ホスト/安全なトンネル」などで API から見えるURLにしてください。

### 7-1. Art Director prompt layer（推奨）

SDXL は「タグの羅列」よりも、自然言語で構図・照明・質感まで書いたほうが安定してジャケットっぽくなります。

環境変数:

- `IMAGE_ART_DIRECTOR_ENABLED=true` で有効化（既定は無効）
- `IMAGE_PROMPT_LLM_PROVIDER=openai|ollama`（省略時: OpenAI があれば OpenAI、なければ Ollama）
- `OPENAI_API_KEY=...`（OpenAI を使う場合）
- `OPENAI_MODEL_IMAGE_PROMPT=gpt-4o-mini`（任意）
- `IMAGE_PROMPT_LLM_TEMPERATURE=0.7`（任意）
- `IMAGE_PROMPT_LLM_MAX_TOKENS=800`（任意）

仕様:

- 失敗時は自動で rule-based のフォールバック（従来 promptBuilder ベース）に戻るため、画像生成全体が落ちにくい設計です。
- クライアントから `key`（例: `"D minor"`）を送ると、調性→色彩ディレクションがプロンプトに反映されます。

### 7-2. ComfyUI workflow enhancements（ローカル ComfyUI）

ローカル ComfyUI を使う場合、環境変数でワークフローを強化できます。
既定では従来のベーシック・ワークフローのまま動き、設定した場合のみ追加ノードを組み込みます。

LoRA（複数可、最大4）:

- `COMFYUI_LORAS` に JSON 配列を指定

例:

```json
[
  {"name":"oil_painting_xl.safetensors","strength_model":0.75,"strength_clip":0.6},
  {"name":"classical_art_xl.safetensors","strength_model":0.55,"strength_clip":0.5}
]
```

Hi-Res Fix（潜在アップスケール + 追いサンプル）:

- `COMFYUI_HIRES_ENABLED=true`
- `COMFYUI_HIRES_SCALE=1.5`（1.1〜2.0）
- `COMFYUI_HIRES_DENOISE=0.35`
- `COMFYUI_HIRES_STEPS=12`
- `COMFYUI_HIRES_UPSCALE_METHOD=nearest-exact`

SDXL Refiner（チェックポイントがある場合のみ）:

- `COMFYUI_REFINER_CHECKPOINT=sdxl_refiner_1.0.safetensors`
- `COMFYUI_REFINER_DENOISE=0.22`
- `COMFYUI_REFINER_STEPS=12`

IP-Adapter（スタイル参照画像; ComfyUI にノードが入っている場合のみ）:

- `COMFYUI_IPADAPTER_ENABLED=true`
- `COMFYUI_IPADAPTER_MODEL=...`（例: `ip-adapter_sdxl_vit-h.safetensors`）
- `COMFYUI_CLIP_VISION_MODEL=...`（例: `CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors`）
- `COMFYUI_IPADAPTER_WEIGHT=0.65`
- `COMFYUI_IPADAPTER_START_AT=0.0`
- `COMFYUI_IPADAPTER_END_AT=1.0`

参照画像の渡し方（どちらか）:

- API リクエストで `styleReferenceImageUrl` を送る
- もしくは env で `COMFYUI_IPADAPTER_REFERENCE_URL=https://...` を設定

補足（安定運用のためのタイムアウト）:

- `COMFYUI_TIMEOUT_MS`（生成全体の待ち時間。重い設定では 240000〜420000 推奨）
- `COMFYUI_POLL_INTERVAL_MS`（既定 750）
- `COMFYUI_HTTP_TIMEOUT_MS`（ComfyUI の各HTTP呼び出しのタイムアウト。既定 20000）

注意:

- 追加ノードは ComfyUI の `/object_info` を見て存在確認できた場合のみ使います。
- LoRA/Refiner のファイル名は、ComfyUI 側の `models/loras` / `models/checkpoints` に配置されている必要があります。

---

## 関連ドキュメント

- 運用/デプロイ統合: [docs/OPS_GUIDE.md](OPS_GUIDE.md)
- システム構成: [docs/SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md)
