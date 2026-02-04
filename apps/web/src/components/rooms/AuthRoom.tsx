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

const AuthRoom: React.FC = () => {
  const { loginWithGoogle, loginWithApple, loading } = useAuth();
  const googleBtnRef = React.useRef<HTMLDivElement | null>(null);
  const [error, setError] = React.useState<string | null>(null);

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
        <h1 className="auth-title">AIRIA</h1>
        <p className="auth-subtitle">はじめるにはログインが必要です</p>

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

        <div className="auth-note">
          <p>プレリリースでは Google / Apple ログインのみ対応します。</p>
        </div>
      </div>
    </div>
  );
};

export default AuthRoom;
