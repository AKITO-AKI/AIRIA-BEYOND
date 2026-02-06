import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { authConfig as apiAuthConfig } from '../../api/authApi';
import './AuthRoom.css';

declare global {
  interface Window {
    google?: any;
    AppleID?: any;
  }
}

const OAUTH_ENABLED = String(import.meta.env.VITE_ENABLE_OAUTH || '')
  .trim()
  .toLowerCase() === 'true';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const APPLE_CLIENT_ID = import.meta.env.VITE_APPLE_CLIENT_ID as string | undefined;
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || (import.meta.env.DEV ? 'http://localhost:3000' : '');
const APPLE_REDIRECT_URI =
  (import.meta.env.VITE_APPLE_REDIRECT_URI as string | undefined) ||
  `${window.location.origin}${window.location.pathname}`;

const AuthRoom: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { loginWithGoogle, loginWithApple, loginWithPassword, registerWithPassword, busy } = useAuth();
  const googleBtnRef = React.useRef<HTMLDivElement | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [passwordEnabled, setPasswordEnabled] = React.useState<boolean>(true);
  const [apiReachable, setApiReachable] = React.useState<boolean | null>(null);
  const [healthStatus, setHealthStatus] = React.useState<{ ok: boolean; status: number; body?: any } | null>(null);
  const [authCfg, setAuthCfg] = React.useState<{ passwordEnabled: boolean; oauth: { enabled?: boolean; google: boolean; apple: boolean } } | null>(null);
  const [versionStatus, setVersionStatus] = React.useState<{ ok: boolean; status: number; body?: any } | null>(null);
  const [lastCheckAt, setLastCheckAt] = React.useState<string | null>(null);
  const [checkSeq, setCheckSeq] = React.useState(0);

  const [adminToken, setAdminToken] = React.useState('');
  const [adminIncludeEmail, setAdminIncludeEmail] = React.useState(false);
  const [adminUsersStatus, setAdminUsersStatus] = React.useState<{ ok: boolean; status: number; body?: any } | null>(null);

  const deploymentHint = React.useMemo(() => {
    try {
      const host = String(window.location.host || '').toLowerCase();
      if (host.endsWith('netlify.app')) return 'Netlify（Site settings → Environment variables）';
      if (host.includes('github.io')) return 'GitHub（Actions/Pages の Secrets）';
      return 'ホスティングサービスのビルド環境（環境変数）';
    } catch {
      return 'ホスティングサービスのビルド環境（環境変数）';
    }
  }, []);
  const [mode, setMode] = React.useState<'signup' | 'login'>(() => {
    try {
      const h = String(window.location.hash || '').toLowerCase();
      return h === '#signup' ? 'signup' : 'login';
    } catch {
      return 'login';
    }
  });

  React.useEffect(() => {
    try {
      const h = String(window.location.hash || '').toLowerCase();
      if (h === '#signup') setMode('signup');
      if (h === '#login') setMode('login');
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLastCheckAt(new Date().toISOString());
        if (!API_BASE) {
          setApiReachable(false);
          setHealthStatus(null);
          setAuthCfg(null);
          setVersionStatus(null);
          return;
        }

        const healthResp = await fetch(`${API_BASE}/api/health`).catch(() => null);
        if (!alive) return;
        if (!healthResp) {
          setApiReachable(false);
          setHealthStatus(null);
        } else {
          const body = await healthResp.json().catch(() => null);
          setApiReachable(Boolean(healthResp.ok));
          setHealthStatus({ ok: Boolean(healthResp.ok), status: healthResp.status, body });
        }

        const cfg = await apiAuthConfig();
        if (!alive) return;
        setAuthCfg(cfg);
        setPasswordEnabled(Boolean(cfg?.passwordEnabled));

        const verResp = await fetch(`${API_BASE}/api/diagnostics/version`).catch(() => null);
        if (!alive) return;
        if (!verResp) {
          setVersionStatus(null);
        } else {
          const body = await verResp.json().catch(() => null);
          setVersionStatus({ ok: Boolean(verResp.ok), status: verResp.status, body });
        }
      } catch {
        // If config can't be loaded (e.g. API base misconfigured), keep password UI visible.
        if (alive) {
          setApiReachable(false);
          setHealthStatus(null);
          setAuthCfg(null);
          setVersionStatus(null);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [checkSeq]);

  React.useEffect(() => {
    setError(null);
    setSuccess(null);

    if (!OAUTH_ENABLED) return;

    if (!GOOGLE_CLIENT_ID) return;
    const google = window.google;
    if (!google?.accounts?.id) return;
    if (!googleBtnRef.current) return;

    try {
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (resp: any) => {
          try {
            const idToken = String(resp?.credential || '');
            if (!idToken) throw new Error('Google credential is missing');
            await loginWithGoogle(idToken);
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      googleBtnRef.current.innerHTML = '';
      google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: 280,
        text: 'signin_with',
        shape: 'pill',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [loginWithGoogle]);

  const handleApple = async () => {
    setError(null);
    setSuccess(null);

    if (!OAUTH_ENABLED) {
      setError('このプレリリースでは OAuth ログインは無効です');
      return;
    }
    if (!APPLE_CLIENT_ID) {
      setError('Apple Client ID が未設定です');
      return;
    }
    const AppleID = window.AppleID;
    if (!AppleID?.auth) {
      setError('Apple のログインスクリプトが読み込まれていません');
      return;
    }

    try {
      AppleID.auth.init({
        clientId: APPLE_CLIENT_ID,
        scope: 'name email',
        redirectURI: APPLE_REDIRECT_URI,
        usePopup: true,
      });

      const res = await AppleID.auth.signIn();
      const idToken = String(res?.authorization?.id_token || '');
      if (!idToken) throw new Error('Apple id_token が取得できませんでした');
      await loginWithApple(idToken, res?.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const googleReady = OAUTH_ENABLED && Boolean(GOOGLE_CLIENT_ID);
  const appleReady = OAUTH_ENABLED && Boolean(APPLE_CLIENT_ID);
  const missingOAuthProviders = [
    ...(googleReady ? [] : ['Google']),
    ...(appleReady ? [] : ['Apple']),
  ];

  const [signupEmail, setSignupEmail] = React.useState('');
  const [signupPassword, setSignupPassword] = React.useState('');
  const [signupDisplayName, setSignupDisplayName] = React.useState('');
  const [loginIdentifier, setLoginIdentifier] = React.useState('');
  const [loginPassword, setLoginPassword] = React.useState('');

  const canSubmitSignup = Boolean(signupEmail.trim() && signupPassword);
  const canSubmitLogin = Boolean(loginIdentifier.trim() && loginPassword);

  const submitSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await registerWithPassword({
        email: signupEmail,
        password: signupPassword,
        displayName: signupDisplayName || undefined,
      });

      const nextEmail = signupEmail.trim();
      setSuccess('新規登録が完了しました。メールとパスワードでログインしてください。');
      setMode('login');
      setLoginIdentifier(nextEmail);
      setLoginPassword('');
      setSignupPassword('');
      try {
        window.location.hash = '#login';
      } catch {
        // ignore
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await loginWithPassword({ identifier: loginIdentifier, password: loginPassword });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="room-content auth-room">
      <div className="auth-card" data-no-swipe="true">
        {onBack ? (
          <div style={{ marginBottom: 8 }}>
            <button className="btn" onClick={onBack} disabled={busy}>
              ← 戻る
            </button>
          </div>
        ) : null}

        <div className="auth-tabs" role="tablist" aria-label="認証モード">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => {
              setMode('signup');
              try {
                window.location.hash = '#signup';
              } catch {
                // ignore
              }
            }}
            disabled={busy}
          >
            新規登録
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => {
              setMode('login');
              try {
                window.location.hash = '#login';
              } catch {
                // ignore
              }
            }}
            disabled={busy}
          >
            ログイン
          </button>
        </div>

        <h1 className="auth-title">AIRIA</h1>
        <p className="auth-subtitle">{mode === 'signup' ? 'メールで新規登録（登録後にログイン）' : 'おかえりなさい。ログインして続ける'}</p>

        {apiReachable === false ? (
          <div className="auth-loading" role="note">
            <div className="auth-loading-title">API に接続できません</div>
            <div className="auth-loading-sub">
              新規登録/ログインが「Failed to fetch」になる場合、ほとんどが API 設定または CORS が原因です。
              <br />
              現在の API: {API_BASE || '(未設定)'}
              <br />
              対応: {deploymentHint} に `VITE_API_BASE_URL`（例: https://airia-beyond.onrender.com）を設定して再デプロイ。
              <br />
              併せてバックエンド側で `APP_PUBLIC_URL` / `APP_ALLOWED_ORIGINS` にフロントのURLを追加してください。
            </div>
          </div>
        ) : null}

        <details className="auth-loading" style={{ marginTop: 10 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 650 }}>接続/認証チェック（診断）</summary>
          <div className="auth-loading-sub" style={{ marginTop: 8 }}>
            <div>API: {API_BASE || '(未設定)'}</div>
            <div>Origin: {(() => { try { return window.location.origin; } catch { return '(unknown)'; } })()}</div>
            <div>
              /api/health: {healthStatus ? (healthStatus.ok ? `OK (${healthStatus.status})` : `NG (${healthStatus.status})`) : apiReachable === false ? 'NG (no response)' : '未取得'}
            </div>
            <div>
              /api/auth/config: {authCfg ? `passwordEnabled=${String(Boolean(authCfg.passwordEnabled))}` : '未取得'}
            </div>
            <div>
              /api/diagnostics/version:{' '}
              {versionStatus
                ? versionStatus.ok
                  ? `OK (${versionStatus.status})`
                  : `NG (${versionStatus.status})`
                : '未取得'}
            </div>
            {versionStatus?.body ? (
              <div style={{ opacity: 0.9 }}>
                authStorePath: {String(versionStatus.body?.authStorePath ?? '(unknown)')}
                {versionStatus.body?.commit ? ` / commit: ${String(versionStatus.body.commit)}` : ''}
              </div>
            ) : null}
            {lastCheckAt ? <div>checkedAt: {lastCheckAt}</div> : null}

            <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn" type="button" onClick={() => setCheckSeq((v) => v + 1)} disabled={busy}>
                再チェック
              </button>
              {API_BASE ? (
                <a className="btn" href={`${API_BASE}/api/health`} target="_blank" rel="noreferrer">
                  health を開く
                </a>
              ) : null}
              {API_BASE ? (
                <a className="btn" href={`${API_BASE}/api/auth/config`} target="_blank" rel="noreferrer">
                  auth config を開く
                </a>
              ) : null}
              {API_BASE ? (
                <a className="btn" href={`${API_BASE}/api/diagnostics/version`} target="_blank" rel="noreferrer">
                  version を開く
                </a>
              ) : null}
            </div>

            {authCfg && authCfg.passwordEnabled === false ? (
              <div style={{ marginTop: 10 }}>
                ブロッカー: バックエンド側でメール/パスワード認証が無効です。Render の環境変数に `AUTH_ALLOW_PASSWORD=true` を追加して再デプロイしてください。
              </div>
            ) : null}

            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
              <div style={{ fontWeight: 650 }}>管理（ADMIN_TOKEN 必須）</div>
              <div style={{ marginTop: 6, opacity: 0.9 }}>
                注意: トークンは共有しないでください。入力値はこの画面のメモリにのみ保持されます。
              </div>

              <div style={{ marginTop: 8, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  className="auth-input"
                  style={{ maxWidth: 360 }}
                  type="password"
                  value={adminToken}
                  onChange={(e) => setAdminToken(e.target.value)}
                  placeholder="ADMIN_TOKEN"
                  autoComplete="off"
                  disabled={busy}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, opacity: 0.9 }}>
                  <input
                    type="checkbox"
                    checked={adminIncludeEmail}
                    onChange={(e) => setAdminIncludeEmail(e.target.checked)}
                    disabled={busy}
                  />
                  email も表示
                </label>
                <button
                  className="btn"
                  type="button"
                  disabled={busy || !API_BASE || !adminToken.trim()}
                  onClick={async () => {
                    try {
                      setAdminUsersStatus(null);
                      const url = `${API_BASE}/api/admin/users?token=${encodeURIComponent(adminToken.trim())}&limit=50&includeEmail=${adminIncludeEmail ? '1' : '0'}`;
                      const resp = await fetch(url).catch(() => null);
                      if (!resp) {
                        setAdminUsersStatus({ ok: false, status: 0, body: { error: 'No response' } });
                        return;
                      }
                      const body = await resp.json().catch(() => null);
                      setAdminUsersStatus({ ok: Boolean(resp.ok), status: resp.status, body });
                    } catch (e) {
                      setAdminUsersStatus({ ok: false, status: 0, body: { error: e instanceof Error ? e.message : String(e) } });
                    }
                  }}
                >
                  ユーザー一覧取得
                </button>
              </div>

              {adminUsersStatus ? (
                <div style={{ marginTop: 8 }}>
                  <div>
                    /api/admin/users: {adminUsersStatus.ok ? `OK (${adminUsersStatus.status})` : `NG (${adminUsersStatus.status})`}
                  </div>
                  <pre
                    style={{
                      marginTop: 6,
                      padding: 10,
                      borderRadius: 10,
                      background: 'rgba(0,0,0,0.35)',
                      maxHeight: 240,
                      overflow: 'auto',
                      fontSize: 12,
                      lineHeight: 1.35,
                    }}
                  >
                    {JSON.stringify(adminUsersStatus.body, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          </div>
        </details>

        {OAUTH_ENABLED && missingOAuthProviders.length ? (
          <div className="auth-loading" role="note">
            <div className="auth-loading-title">OAuth が未設定です</div>
            <div className="auth-loading-sub">
              {missingOAuthProviders.join(' / ')} の Client ID がフロントエンド側で未投入です。
              このアプリは Vite のため、環境変数は「実行時」ではなく「ビルド時」に埋め込まれます。
              {deploymentHint} に以下を設定して再デプロイしてください。
              <br />
              必須: `VITE_GOOGLE_CLIENT_ID` / `VITE_APPLE_CLIENT_ID` / `VITE_API_BASE_URL`
              <br />
              推奨: `VITE_APPLE_REDIRECT_URI`（例: {window.location.origin}/）
            </div>
          </div>
        ) : null}

        {!passwordEnabled ? (
          <div className="auth-loading" role="note">
            <div className="auth-loading-title">メール/パスワードは無効です</div>
            <div className="auth-loading-sub">
              この環境ではメール/パスワードログインが無効化されています。管理者設定（`AUTH_ALLOW_PASSWORD=true`）を確認してください。
            </div>
          </div>
        ) : null}

        {busy ? (
          <div className="auth-loading" aria-live="polite" aria-busy="true">
            <div className="auth-loading-row">
              <div className="auth-spinner" aria-hidden="true" />
              <div>
                <div className="auth-loading-title">処理中…</div>
                <div className="auth-loading-sub">
                  通信環境によっては時間がかかる場合があります。安全にログイン処理を行っています。
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="auth-note">
          {mode === 'signup' ? (
            <>
              <p>プレリリースはメールアドレスでの新規登録/ログインに限定しています。</p>
            </>
          ) : (
            <>
              <p>メールアドレス（またはハンドル）とパスワードでログインしてください。</p>
              <p>
                初めての方は{' '}
                <button
                  type="button"
                  className="auth-inline-link"
                  onClick={() => {
                    setMode('signup');
                    try {
                      window.location.hash = '#signup';
                    } catch {
                      // ignore
                    }
                  }}
                  disabled={busy}
                >
                  新規登録
                </button>
                。
              </p>
            </>
          )}
        </div>

        {passwordEnabled && mode === 'signup' ? (
          <form className="auth-form" onSubmit={(e) => void submitSignup(e)}>
            <label className="auth-label">
              メールアドレス
              <input
                className="auth-input"
                type="email"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={busy}
                required
              />
            </label>

            <label className="auth-label">
              パスワード（6文字以上）
              <input
                className="auth-input"
                type="password"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                placeholder="••••••"
                autoComplete="new-password"
                disabled={busy}
                required
                minLength={6}
              />
            </label>

            <label className="auth-label">
              表示名（任意）
              <input
                className="auth-input"
                type="text"
                value={signupDisplayName}
                onChange={(e) => setSignupDisplayName(e.target.value)}
                placeholder="AIRIAユーザー"
                autoComplete="nickname"
                disabled={busy}
              />
            </label>

            <button className="btn auth-submit" type="submit" disabled={busy || !canSubmitSignup}>
              {busy ? '作成中…' : 'メールで新規登録'}
            </button>
          </form>
        ) : passwordEnabled && mode === 'login' ? (
          <form className="auth-form" onSubmit={(e) => void submitLogin(e)}>
            <label className="auth-label">
              メールアドレス / ハンドル
              <input
                className="auth-input"
                type="text"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                placeholder="you@example.com または your_handle"
                autoComplete="username"
                disabled={busy}
                required
              />
            </label>

            <label className="auth-label">
              パスワード
              <input
                className="auth-input"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••"
                autoComplete="current-password"
                disabled={busy}
                required
              />
            </label>

            <button className="btn auth-submit" type="submit" disabled={busy || !canSubmitLogin}>
              {busy ? 'ログイン中…' : 'メールでログイン'}
            </button>
          </form>
        ) : null}

        {OAUTH_ENABLED ? (
          <>
            <div className="auth-sep" aria-hidden="true">
              <span />
              <div>または</div>
              <span />
            </div>

            <div className="auth-actions">
              <div className={`auth-google ${googleReady ? '' : 'disabled'}`}>
                {googleReady ? (
                  <div ref={googleBtnRef} />
                ) : (
                  <button className="btn" disabled>
                    Googleでログイン（未設定）
                  </button>
                )}
              </div>

              <button className="btn btn-apple" onClick={() => void handleApple()} disabled={busy || !APPLE_CLIENT_ID}>
                Appleでログイン{APPLE_CLIENT_ID ? '' : '（未設定）'}
              </button>
            </div>
          </>
        ) : null}

        {error && <div className="auth-error">{error}</div>}

        {success && <div className="auth-success">{success}</div>}

      </div>
    </div>
  );
};

export default AuthRoom;
