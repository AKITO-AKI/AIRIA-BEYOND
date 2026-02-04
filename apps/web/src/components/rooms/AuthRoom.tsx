import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
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
  const { loginWithGoogle, loginWithApple, loading } = useAuth();
  const googleBtnRef = React.useRef<HTMLDivElement | null>(null);
  const [error, setError] = React.useState<string | null>(null);
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
    setError(null);

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

  return (
    <div className="room-content auth-room">
      <div className="auth-card" data-no-swipe="true">
        {onBack ? (
          <div style={{ marginBottom: 8 }}>
            <button className="btn" onClick={onBack} disabled={loading}>
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
            disabled={loading}
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
            disabled={loading}
          >
            ログイン
          </button>
        </div>

        <h1 className="auth-title">AIRIA</h1>
        <p className="auth-subtitle">{mode === 'signup' ? '無料で始める（初回ログイン＝登録）' : 'おかえりなさい。ログインして続ける'}</p>

        <div className="auth-note">
          {mode === 'signup' ? (
            <>
              <p>Google / Apple を選ぶだけでアカウントが作成されます（新規登録）。</p>
              <p>プレリリースでは OAuth-only（パスワード登録なし）です。</p>
            </>
          ) : (
            <>
              <p>以前使った Google / Apple でログインしてください。</p>
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
                  disabled={loading}
                >
                  新規登録
                </button>
                。
              </p>
            </>
          )}
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

          <button className="btn btn-apple" onClick={() => void handleApple()} disabled={loading || !APPLE_CLIENT_ID}>
            Appleでログイン{APPLE_CLIENT_ID ? '' : '（未設定）'}
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        
      </div>
    </div>
  );
};

export default AuthRoom;
