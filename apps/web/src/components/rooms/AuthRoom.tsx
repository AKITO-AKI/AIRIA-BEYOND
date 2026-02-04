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

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const APPLE_CLIENT_ID = import.meta.env.VITE_APPLE_CLIENT_ID as string | undefined;
const APPLE_REDIRECT_URI =
  (import.meta.env.VITE_APPLE_REDIRECT_URI as string | undefined) ||
  `${window.location.origin}${window.location.pathname}`;

const AuthRoom: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { loginWithGoogle, loginWithApple, loginWithPassword, registerWithPassword, busy } = useAuth();
  const googleBtnRef = React.useRef<HTMLDivElement | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [passwordEnabled, setPasswordEnabled] = React.useState<boolean>(true);
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
        const cfg = await apiAuthConfig();
        if (!alive) return;
        setPasswordEnabled(Boolean(cfg?.passwordEnabled));
      } catch {
        // If config can't be loaded (e.g. API base misconfigured), keep password UI visible.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    setError(null);
    setSuccess(null);

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

  const googleReady = Boolean(GOOGLE_CLIENT_ID);
  const appleReady = Boolean(APPLE_CLIENT_ID);
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
        <p className="auth-subtitle">{mode === 'signup' ? '無料で始める（初回ログイン＝登録）' : 'おかえりなさい。ログインして続ける'}</p>

        {missingOAuthProviders.length ? (
          <div className="auth-loading" role="note">
            <div className="auth-loading-title">OAuth が未設定です</div>
            <div className="auth-loading-sub">
              {missingOAuthProviders.join(' / ')} の Client ID がフロントエンド側で未投入です。
              GitHub Pages では環境変数はビルド時に埋め込まれるため、管理者が GitHub Secrets に
              `VITE_GOOGLE_CLIENT_ID` / `VITE_APPLE_CLIENT_ID` を設定して再デプロイする必要があります。
            </div>
          </div>
        ) : null}

        {!passwordEnabled ? (
          <div className="auth-loading" role="note">
            <div className="auth-loading-title">メール/パスワードは無効です</div>
            <div className="auth-loading-sub">この環境では OAuth（Google / Apple）でログインしてください。</div>
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
              <p>メール/パスワード、または Google / Apple でアカウントを作成できます。</p>
            </>
          ) : (
            <>
              <p>メール/パスワード、または以前使った Google / Apple でログインしてください。</p>
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

        {error && <div className="auth-error">{error}</div>}

        {success && <div className="auth-success">{success}</div>}

      </div>
    </div>
  );
};

export default AuthRoom;
