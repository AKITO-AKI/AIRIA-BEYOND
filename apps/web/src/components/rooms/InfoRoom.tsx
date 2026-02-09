import React from 'react';
import './InfoRoom.css';
import Dialog from '../ui/Dialog';
import { useRoomNavigation } from '../../contexts/RoomNavigationContext';

const STORAGE_KEY = 'airia_onboarding_data';

const InfoRoom: React.FC = () => {
  const isDev = import.meta.env.DEV;
  const { navigateToRoom } = useRoomNavigation();
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
      <div className="info-card">
        <section className="info-section" data-no-swipe="true">
          <h2 className="info-title">フィードバック</h2>
          <p className="info-text">
            不便・バグ・改善案はもちろん、良かった点も歓迎です。短くても大丈夫。
          </p>
          <div className="info-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigateToRoom('feedback')}>
              フィードバックを書く
            </button>
          </div>
        </section>

        <section className="info-section">
          <h2 className="info-title">目的</h2>
          <p className="info-text">この体験の目的は、「より貴方らしい芸術」を日常の中で生み出せること。</p>
          <p className="info-text">そして、気持ちの変化に合わせて「ずっと寄り添える」相棒になることです。</p>
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
        description="あなたの一日を、作品へ。"
        footer={
          <button className="btn btn-primary" onClick={() => setShowAbout(false)}>
            閉じる
          </button>
        }
      >
        <p className="info-text">
          会話と気分の手がかりから、あなたに合うレコメンドや創作を少しずつ育てていきます。
        </p>
        <p className="info-text">
          まだプレリリース段階です。気づいたことがあれば、ぜひフィードバックを送ってください。
        </p>
      </Dialog>
    </div>
  );
};

export default InfoRoom;
