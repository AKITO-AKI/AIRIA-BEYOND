import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './AuthRoom.css';

const AuthRoom: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { loginWithPassword, registerWithPassword, busy } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
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
      if (!String(loginIdentifier || '').includes('@')) {
        throw new Error('メールアドレスを入力してください');
      }
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
              <p>プレリリースはメールアドレスとパスワードでアカウントを作成します。</p>
            </>
          ) : (
            <>
              <p>メールアドレスとパスワードでログインしてください。</p>
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

        {mode === 'signup' ? (
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
        ) : (
          <form className="auth-form" onSubmit={(e) => void submitLogin(e)}>
            <label className="auth-label">
              メールアドレス
              <input
                className="auth-input"
                type="email"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
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
        )}

        {error && <div className="auth-error">{error}</div>}

        {success && <div className="auth-success">{success}</div>}

      </div>
    </div>
  );
};

export default AuthRoom;
