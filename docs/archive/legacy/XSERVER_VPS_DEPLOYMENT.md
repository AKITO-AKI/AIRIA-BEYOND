# Xserver VPS（Ubuntu）で API（Node/Express）を運用する

この手順は **Xserver VPS 上で AIRIA-BEYOND のバックエンド(API)を常時稼働**させるためのものです。

- フロントは静的配信（Xserver共有サーバ / GitHub Pages 等）でも、同じVPSでNginx配信でもOK
- DBは **Neon(Postgres)** を継続推奨（無料・運用が軽い）

> 注意: 共有サーバ（public_html）では Node サーバを常時稼働できないことが多いので、**APIはVPS向き**です。

---

## 0. 事前に決めること（推奨構成）

- フロント: `https://app.example.com`（または `https://example.com`）
- API: `https://api.example.com`
- Neon: `DATABASE_URL` を用意（`sslmode=require`）

この構成にすると CORS と証明書が分かりやすいです。

---

## 1. VPS作成時（SSH Key）

- 可能なら **インポート（自分のPCで作成した公開鍵）**
- 最短なら **自動生成**でもOK（秘密鍵は必ず安全に保管）

---

## 2. SSHでログイン

1) VPSのIPが出たらログイン（秘密鍵のパスは手元に合わせて）

- `ssh -i <keyfile> root@<VPS_IP>`

---

## 3. 初期セットアップ（セキュリティ最低限）

### 3.1 パッケージ更新

- `apt update && apt -y upgrade`

### 3.2 デプロイ用ユーザー作成（例: airia）

- `adduser airia`
- `usermod -aG sudo airia`

以後は `airia` で作業するのが安全です。

### 3.3 SSHを鍵ログインに寄せる（推奨）

- `/etc/ssh/sshd_config` を編集
  - `PasswordAuthentication no`
  - `PermitRootLogin prohibit-password`（もしくは `no`）
- `systemctl restart ssh`

> 先に別ターミナルで `airia` ユーザーで鍵ログインできることを確認してから切り替えてください。

### 3.4 ファイアウォール（UFW）

- `ufw allow OpenSSH`
- `ufw allow 80/tcp`
- `ufw allow 443/tcp`
- `ufw enable`
- `ufw status`

---

## 4. Node.js を入れる（推奨: Node 20+）

Ubuntuでは nvm が扱いやすいです。

- `sudo -u airia -H bash -lc "curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash"`
- `sudo -u airia -H bash -lc "source ~/.nvm/nvm.sh && nvm install 20 && nvm use 20 && node -v"`

systemd から node を呼ぶ場合、nodeのパスが変わることがあります。
- 確実にするなら `/usr/bin/node` を使えるように **aptのnode** を使うか、
- もしくは service ファイルの `ExecStart` を nvm の node パスに合わせて調整します。

（テンプレは [deploy/vps/airia-beyond.service.example](deploy/vps/airia-beyond.service.example)）

---

## 5. アプリを配置

### 5.1 配置先

- 推奨: `/opt/airia-beyond`

- `sudo mkdir -p /opt/airia-beyond`
- `sudo chown -R airia:airia /opt/airia-beyond`

### 5.2 Git clone & install

- `sudo -u airia -H bash -lc "cd /opt && git clone <YOUR_REPO_URL> airia-beyond"`
- `sudo -u airia -H bash -lc "cd /opt/airia-beyond && npm install"`

---

## 6. サーバ環境変数を作る

- `sudo -u airia -H nano /opt/airia-beyond/.env`

雛形: [deploy/vps/env.server.example](deploy/vps/env.server.example)

重要ポイント:
- `DATABASE_URL` に **ダブルクオートを付けない**
- `APP_ALLOWED_ORIGINS` に **実際のフロントのOrigin** を入れる

---

## 7. まず手動で起動確認

- `sudo -u airia -H bash -lc "cd /opt/airia-beyond && node server.js"`

別端末で:
- `curl -i http://127.0.0.1:3000/api/health`

OKなら次へ。

> メモ（つまずきポイント）
>
> - `127.0.0.1` は「今いるマシン自身」です。VPS上のAPIを確認したい場合は **VPSにSSHログインして** `curl` してください。
> - WindowsのPowerShellは `curl` が別コマンド扱いになることがあります。Windows側で確認したい場合は `curl.exe` を使うか、SSHのポート転送で確認できます。
>   - 例: `ssh -L 3000:127.0.0.1:3000 airia@api.example.com`
>   - 別タブで: `curl.exe -i "http://127.0.0.1:3000/api/health"`

---

## 8. systemd で常駐化

1) テンプレをコピーして調整
- `sudo cp /opt/airia-beyond/deploy/vps/airia-beyond.service.example /etc/systemd/system/airia-beyond.service`

> もし上のテンプレが見つからない場合（VPS上のリポジトリが古い/別フォルダに clone した等）は、次で service ファイルを直接作れます。
>
> ```bash
> sudo tee /etc/systemd/system/airia-beyond.service >/dev/null <<'EOF'
> [Unit]
> Description=AIRIA-BEYOND API (Node/Express)
> After=network.target
>
> [Service]
> Type=simple
> User=airia
> WorkingDirectory=/opt/airia-beyond
> EnvironmentFile=/opt/airia-beyond/.env
> ExecStart=/usr/bin/node /opt/airia-beyond/server.js
> Restart=on-failure
> RestartSec=3
> NoNewPrivileges=true
> PrivateTmp=true
> ProtectSystem=full
> ProtectHome=true
>
> [Install]
> WantedBy=multi-user.target
> EOF
> ```

2) 反映 & 起動
- `sudo systemctl daemon-reload`
- `sudo systemctl enable --now airia-beyond`

3) ログ確認
- `sudo journalctl -u airia-beyond -n 200 --no-pager`

---

## 9. Nginx リバースプロキシ

1) インストール
- `sudo apt -y install nginx`

2) 設定追加
- `sudo cp /opt/airia-beyond/deploy/vps/nginx-airia-beyond-api.conf.example /etc/nginx/sites-available/airia-beyond-api.conf`
- `sudo ln -s /etc/nginx/sites-available/airia-beyond-api.conf /etc/nginx/sites-enabled/airia-beyond-api.conf`

3) 構文チェック & リロード
- `sudo nginx -t`
- `sudo systemctl reload nginx`

---

## 10. TLS（Let’s Encrypt）

1) DNSで `api.example.com` を VPS のIPに向ける（Aレコード）
2) certbot
- `sudo apt -y install certbot python3-certbot-nginx`
- `sudo certbot --nginx -d api.example.com`

自動更新:
- `sudo systemctl status certbot.timer`

---

## 10.5 VPSだけでフロントも配信する（レンタルサーバ不要）

API（`api.airia-beyond.com`）とは別に、**フロント（画面）**もこのVPSから配信できます。

### (1) DNS（先にこれが必要）

次のどちらかを設定してください（どちらもVPSのIPへ）。

- `airia-beyond.com` → Aレコード → VPSのIP
- `www.airia-beyond.com` → Aレコード（または CNAME で `airia-beyond.com`）

確認（どちらでもOK）:
- Windows: `nslookup airia-beyond.com 8.8.8.8`
- VPS: `dig +short airia-beyond.com A`

### (2) フロントをビルド（手元のPC）

フロントはビルド時にAPIのURLを埋め込みます。

- `VITE_API_BASE_URL=https://api.airia-beyond.com`
- `VITE_PUBLIC_BASE_PATH=/`

ビルド後、`apps/web/dist` ができます。

### (3) dist をVPSへアップ（VPS側の置き場所を作る）

VPSで:

- `sudo mkdir -p /var/www/airia-beyond`
- `sudo chown -R airia:airia /var/www/airia-beyond`

手元PCから `apps/web/dist` の中身を `/var/www/airia-beyond` にアップします。

例（Windows PowerShell / OpenSSH）:

- `scp -r .\apps\web\dist\* airia@api.airia-beyond.com:/var/www/airia-beyond/`

### (4) Nginx（メインドメイン用の設定）

VPSで、次を作ります（SPAの直リンク対策も込み）:

```bash
sudo tee /etc/nginx/sites-available/airia-beyond-web.conf >/dev/null <<'EOF'
server {
  listen 80;
  listen [::]:80;

  server_name airia-beyond.com www.airia-beyond.com;

  root /var/www/airia-beyond;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /assets/ {
    expires 30d;
    add_header Cache-Control "public, immutable";
    try_files $uri =404;
  }
}
EOF

sudo ln -sf /etc/nginx/sites-available/airia-beyond-web.conf /etc/nginx/sites-enabled/airia-beyond-web.conf
sudo nginx -t && sudo systemctl reload nginx
```

確認（VPSで）:
- `curl -I http://airia-beyond.com/`

### (5) メインドメインも HTTPS にする

VPSで:

- `sudo certbot --nginx -d airia-beyond.com -d www.airia-beyond.com`

確認:
- `curl -I https://airia-beyond.com/`

---

## 11. フロント側のAPI URLを更新してビルド

フロントは **ビルド時に** `VITE_API_BASE_URL=https://api.example.com` を入れて作り直します。

- 例: `apps/web/.env.xserver.local` の `VITE_API_BASE_URL` を `https://api.example.com` に変更
- `npm run build:xserver`
- 生成された `apps/web/dist` を静的ホストへアップ

---

## 12. 動作確認

- `https://api.example.com/api/health` が `OK`
- フロントの Auth診断で
  - `API: https://api.example.com`
  - `/api/health: OK`
  - ログイン/登録 OK

---

## よくある詰まり

- 403/ CORS: `APP_ALLOWED_ORIGINS` がフロントのOriginと不一致
- 502: `airia-beyond` サービスが落ちてる / ポート違い
- `DATABASE_URL` エラー: クオート混入、`sslmode=require` 未指定
