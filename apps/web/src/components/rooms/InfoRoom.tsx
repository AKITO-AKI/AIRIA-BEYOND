import React from 'react';

const STORAGE_KEY = 'airia_onboarding_data';

const InfoRoom: React.FC = () => {
  const isDev = import.meta.env.DEV;

  const resetOnboarding = () => {
    if (!isDev) return;
    const ok = window.confirm('開発用: オンボーディングをリセットしますか？\n次回リロードでオンボーディングが表示されます。');
    if (!ok) return;
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };

  return (
    <div className="room-content">
      <h1 className="room-title">INFO</h1>
      <p className="room-subtitle">このアプリについて / ローカル運用 / デバッグ</p>

      <div style={{
        border: '1px solid rgba(0,0,0,0.12)',
        borderRadius: 16,
        background: 'rgba(255,255,255,0.65)',
        boxShadow: '0 16px 50px rgba(0,0,0,0.06)',
        padding: 16,
        display: 'grid',
        gap: 12,
      }}>
        <section>
          <h2 style={{ margin: '0 0 6px 0', fontSize: 16 }}>目的</h2>
          <p style={{ margin: 0, color: 'rgba(0,0,0,0.68)', lineHeight: 1.7 }}>
            会話を軸に、クラシック中心のレコメンドと、時々「生成イベント」（曲＋アルバムアート）を作ります。
          </p>
        </section>

        <section>
          <h2 style={{ margin: '0 0 6px 0', fontSize: 16 }}>ローカル運用</h2>
          <p style={{ margin: 0, color: 'rgba(0,0,0,0.68)', lineHeight: 1.7 }}>
            有料APIを避けたい場合は、LLMはOllama、画像はComfyUIを推奨します。
          </p>
        </section>

        <section>
          <h2 style={{ margin: '0 0 6px 0', fontSize: 16 }}>リンク</h2>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'rgba(0,0,0,0.75)', lineHeight: 1.7 }}>
            <li>
              <a href="https://github.com/AKITO-AKI/AIRIA-BEYOND" target="_blank" rel="noreferrer">
                GitHub Repository
              </a>
            </li>
            <li>
              <a href="https://ollama.com" target="_blank" rel="noreferrer">Ollama</a>
              {' / '}
              <a href="https://github.com/comfyanonymous/ComfyUI" target="_blank" rel="noreferrer">ComfyUI</a>
            </li>
          </ul>
        </section>

        {isDev ? (
          <section>
            <h2 style={{ margin: '0 0 6px 0', fontSize: 16 }}>開発用</h2>
            <button
              onClick={resetOnboarding}
              style={{
                appearance: 'none',
                borderRadius: 12,
                border: '1px solid rgba(0,0,0,0.14)',
                padding: '10px 12px',
                background: 'rgba(255,255,255,0.9)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              オンボーディングをリセット
            </button>
          </section>
        ) : null}
      </div>
    </div>
  );
};

export default InfoRoom;
