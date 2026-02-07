# 引き継ぎログ（このチャットでやったこと／時系列・詳細）

このドキュメントは、チャット履歴が消えても引き継げるように、
**この会話で実施した判断・変更・検証を時系列で整理**したものです。

作成日: 2026-02-07

---

## 0. 目的（このログの使い方）

- 「なぜそうしたか」を残す（設計意図と制約）
- どのファイルを触ったか、どこを見れば再現できるかを残す
- 次に何をすべきか（未完了／次タスク）を明確にする

> 注意: 会話の一部には「VPS 上の設定」など、リポジトリ外の作業も含まれます。

---

## Phase 1: インフラ／移行（Netlify → Xserver VPS / Ubuntu 24.04）

### 目的
- バックエンドを VPS で常時稼働させ、独自ドメイン配下で安定運用する

### 実施内容（リポジトリ外）
- DNS 設定、SSH ハードニング、UFW
- systemd で Node/Express 常駐
- Nginx reverse proxy
- Certbot による TLS

### 検証
- `https://airia-beyond.com`
- `https://api.airia-beyond.com/api/health`

---

## Phase 2: 認証／信頼性（メールログインの堅牢化）

### 目的
- プロキシ環境でもクライアント識別・レート制限・ログインが安定するようにする

### 実施（要点）
- forwarded headers を考慮した安全な clientId 推定
- レート制限のスコープ調整
- scrypt を async 化、pepper（任意）
- systemd WorkingDirectory 前提の落とし穴を回避

---

## Phase 3: AI 基盤の堅牢化（JSON サルベージ／サニタイズ）

### 目的
- LLM 出力が壊れても「落ちない」
- 中間表現（構造 JSON）を安全に修復して次工程へ流す

### 実施（要点）
- JSON salvage parsing + sanitization
- music JSON は strict retry
- image は preset overlay（white-world）を一貫適用

---

## Phase 4: Music “full piece” 生成（構成計画と終止の強化）

### 目的
- 1フレーズではなく「曲」になる構造（形式・転調・終止）を作る

### 実施（要点）
- classical-form planning
- セクション別 modulation
- cadence enforcement（PICARDY 対応含む）
- timeout 可能な smoke-import スクリプト

---

## Phase 5: ユーザー要望「高度で芸術的」対応（クロスモーダル一貫性）

### 目的
- 音楽と画像が同じ “世界” を共有する
- 操作できる芸術性（抽象度、密度、質感、ドラマ）を増やす

### 実施（要点）
- 音楽: 緊張→解放、leitmotifs、人間味（rubato/velocity shaping）
- 画像: 時代→美術史、編成→テクスチャ、客観的相関物のヒント、density/abstraction

---

## Phase 6: エンドツーエンド検証（HTTP スモーク、strict-provider、型の整理）

### 目的
- refine→music→image が **HTTP 経由**で壊れないことを証明
- 外部キーが無い環境でも完走（フォールバック）
- 実プロバイダがある環境では strict で保証

### 主な変更点（代表ファイル）

- `server.js`
  - `/api/health` が `services.ollama.configured` を返す（strict 判定に使う）

- `api/creativeBriefService.js`
  - `briefToGenerationInputs()` が cross-modal の既定値を生成
    - `image.density`
    - `music.humanize`

- `api/promptBuilder.js`
  - `buildPrompt()` が解決済みの `stylePreset` を返す（スモーク失敗の修正）

- `api/controllers/music.js`
  - `generateMusicStructureWithFallback()` を利用
  - ジョブに `effectiveProvider` / `fallbackUsed` など診断値

- `api/musicJobStore.js`
  - `inputSummary`（duration/period/form/key/tempo/timeSignature/humanize）を追加

- `api/controllers/image.js`
  - ジョブ `inputSummary` に `density` を追加

- `scripts/smoke-e2e-http.mjs`
  - ローカルサーバを起動し、refine → music job → image job をポーリングして成功を検証
  - refine の戻りに `image.density` と `music.humanize` が含まれることをアサート
  - `--strict` で「実プロバイダ必須」モード

- フロント型の補強
  - `apps/web/src/api/imageApi.ts`（JobStatus / inputSummary / density など）
  - `apps/web/src/utils/pendingGeneration.ts`（refined を `any` から型へ）
  - `apps/web/src/components/main/ChatSessionUI.tsx`（`any` 減、music request の組み立てを明示）
  - `apps/web/src/components/rooms/OnboardingRoom.tsx`（`as any` 削減）

### 検証（実行したコマンド）

- HTTP E2E スモーク（フォールバック許容）
  - `node scripts/smoke-e2e-http.mjs`
  - 結果: OK（キー無しでも rule-based / placeholder で完走）

---

## Phase 7: ロードマップ作成 → 日本語化 → ドキュメント統合

### 目的
- 生成フローの整備が一段落したので、全体の「次」を整理
- docs を少数ファイルに統合し、参照点を固定
- チャット消失に備え、引き継ぎログを作る

### 実施
- [docs/ROADMAP.md](ROADMAP.md) を作成 → 日本語化
- さらに統合ドキュメントへ移行:
  - [docs/INDEX.md](INDEX.md)
  - [docs/PRODUCT.md](PRODUCT.md)
  - [docs/DEV_GUIDE.md](DEV_GUIDE.md)
  - [docs/OPS_GUIDE.md](OPS_GUIDE.md)
  - 本ファイル: [docs/CHAT_HANDOVER_LOG.md](CHAT_HANDOVER_LOG.md)

---

## 現在の状態（2026-02-07 時点）

- フォールバック前提で refine→music→image が完走し、HTTP スモークで確認済み
- strict-provider を使えば「実プロバイダが本当に使われた」ことも検証できる

## 次にやると良いこと（優先順）

1) ドキュメント統合の仕上げ（旧 docs を archive へ整理し、スタブを残す）
2) CI にフォールバック smoke を追加（build だけでなく回帰検知）
3) ステージングで nightly strict（プロバイダ破壊的変更の早期検知）
4) 永続化（Postgres）と recipe 保存（再現／派生）
