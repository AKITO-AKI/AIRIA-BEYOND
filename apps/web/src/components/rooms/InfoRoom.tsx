import React from 'react';
import './InfoRoom.css';
import Dialog from '../ui/Dialog';
import Tooltip from '../ui/Tooltip';

const STORAGE_KEY = 'airia_onboarding_data';
const THEME_STORAGE_KEY = 'airia_theme';

type ThemeChoice = 'system' | 'light' | 'dark' | 'high-contrast';

function applyThemeChoice(choice: ThemeChoice) {
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const next = choice === 'system' ? (prefersDark ? 'dark' : 'light') : choice;
  document.documentElement.setAttribute('data-theme', next);
}

const InfoRoom: React.FC = () => {
  const isDev = import.meta.env.DEV;
  const [themeChoice, setThemeChoice] = React.useState<ThemeChoice>(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeChoice | null;
      return stored || 'system';
    } catch {
      return 'system';
    }
  });

  const updateTheme = (choice: ThemeChoice) => {
    setThemeChoice(choice);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, choice);
    } catch {
      // ignore
    }
    applyThemeChoice(choice);
  };

  const [showAbout, setShowAbout] = React.useState(false);

  const resetOnboarding = () => {
    if (!isDev) return;
    const ok = window.confirm('開発用: オンボーディングをリセットしますか？\n次回リロードでオンボーディングが表示されます。');
    if (!ok) return;
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };

  return (
    <div className="room-content info-room">
      <h1 className="room-title">INFO</h1>
      <p className="room-subtitle">このアプリについて / ローカル運用 / デバッグ</p>

      <div className="info-card">
        <section className="info-section">
          <h2 className="info-title">目的</h2>
          <p className="info-text">
            会話を軸に、クラシック中心のレコメンドと、時々「生成イベント」（曲＋アルバムアート）を作ります。
          </p>
        </section>

        <section className="info-section">
          <h2 className="info-title">ローカル運用</h2>
          <p className="info-text">
            有料APIを避けたい場合は、LLMはOllama、画像はComfyUIを推奨します。
          </p>
        </section>

        <section className="info-section" data-no-swipe="true">
          <div className="info-actions">
            <h2 className="info-title">テーマ</h2>
            <Tooltip label="見やすさに合わせて切り替えできます">
              <span className="info-badge" aria-hidden="true">?</span>
            </Tooltip>
          </div>
          <div className="info-actions">
            <div className="theme-toggle" role="group" aria-label="テーマ切り替え">
              {([
                { id: 'system', label: 'システム' },
                { id: 'light', label: 'ライト' },
                { id: 'dark', label: 'ダーク' },
                { id: 'high-contrast', label: '高コントラスト' },
              ] as const).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="theme-button"
                  aria-pressed={themeChoice === option.id}
                  onClick={() => updateTheme(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <p className="info-text">見やすさに合わせて切り替えられます。</p>
        </section>

        <section className="info-section">
          <div className="info-actions">
            <h2 className="info-title">リンク</h2>
            <button
              type="button"
              className="info-reset"
              onClick={() => setShowAbout(true)}
            >
              アプリ情報
            </button>
          </div>
          <ul className="info-list">
            <li>
              <a className="info-link" href="https://github.com/AKITO-AKI/AIRIA-BEYOND" target="_blank" rel="noreferrer">
                GitHub Repository
              </a>
            </li>
            <li>
              <a className="info-link" href="https://ollama.com" target="_blank" rel="noreferrer">Ollama</a>
              {' / '}
              <a className="info-link" href="https://github.com/comfyanonymous/ComfyUI" target="_blank" rel="noreferrer">ComfyUI</a>
            </li>
          </ul>
        </section>

        {isDev ? (
          <section className="info-section">
            <h2 className="info-title">開発用</h2>
            <button
              onClick={resetOnboarding}
              className="info-reset"
            >
              オンボーディングをリセット
            </button>
          </section>
        ) : null}
      </div>

      <Dialog
        open={showAbout}
        onOpenChange={setShowAbout}
        title="AIRIA BEYOND"
        description="Design Tokens / UI基盤の整備中"
        footer={
          <button className="btn btn-primary" onClick={() => setShowAbout(false)}>
            閉じる
          </button>
        }
      >
        <p className="info-text">
          テーマ・タイポグラフィ・余白・影・角丸・モーションを共通化し、品質を安定させるための基盤を整えています。
        </p>
        <p className="info-text">
          次は Dialog / Tooltip / Toast などの基礎部品を統一規約で拡張していきます。
        </p>
      </Dialog>
    </div>
  );
};

export default InfoRoom;
