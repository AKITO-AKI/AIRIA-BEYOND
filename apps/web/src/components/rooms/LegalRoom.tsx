import React from 'react';
import { TermsOfService } from '../../pages/TermsOfService';
import { PrivacyPolicy } from '../../pages/PrivacyPolicy';
import './LegalRoom.css';

type Props = {
  kind: 'terms' | 'privacy';
  onBack: () => void;
  onStart: () => void;
};

const LegalRoom: React.FC<Props> = ({ kind, onBack, onStart }) => {
  const title = kind === 'terms' ? '利用規約' : 'プライバシーポリシー';
  const subtitle = kind === 'terms' ? 'Terms of Service' : 'Privacy Policy';

  return (
    <div className="room-content legal-room" data-no-swipe="true">
      <div className="legal-topbar">
        <button className="btn" onClick={onBack}>
          ← 戻る
        </button>
        <div className="legal-topbar-spacer" />
        <button className="btn btn-primary" onClick={onStart}>
          ログインへ
        </button>
      </div>

      <header className="legal-hero">
        <div className="legal-hero-kicker">AIRIA BEYOND / Legal</div>
        <h1 className="legal-hero-title">
          {title}
          <span className="legal-hero-sub">{subtitle}</span>
        </h1>
        <p className="legal-hero-lead">
          ここに書かれていることは“堅い文章”ですが、AIRIAが守ろうとしているのは体験の安心感です。
          わからない点があれば、GitHubのIssueから相談できます。
        </p>
      </header>

      <main className="legal-body">
        {kind === 'terms' ? <TermsOfService /> : <PrivacyPolicy />}
      </main>

      <div className="legal-bottom" data-no-swipe="true">
        <div className="legal-bottom-inner">
          <div>
            <div className="legal-bottom-title">続きはアプリで</div>
            <div className="legal-bottom-sub">ログインして、最初のセッションを始めましょう。</div>
          </div>
          <div className="legal-bottom-actions">
            <button className="btn btn-primary" onClick={onStart}>
              ログインしてはじめる
            </button>
            <button className="btn" onClick={onBack}>
              戻る
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LegalRoom;
