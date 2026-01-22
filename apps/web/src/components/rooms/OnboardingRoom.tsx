import React, { useState } from 'react';
import OnboardingForm, { OnboardingData } from '../OnboardingForm';
import '../OnboardingForm.css';

const OnboardingRoom: React.FC = () => {
  const [isCompleted, setIsCompleted] = useState(false);
  const [completedData, setCompletedData] = useState<OnboardingData | null>(null);

  const handleComplete = (data: OnboardingData) => {
    setCompletedData(data);
    setIsCompleted(true);
  };

  const handleRestart = () => {
    setIsCompleted(false);
    setCompletedData(null);
  };

  return (
    <div className="room-content">
      <h1 className="room-title">ONBOARDING</h1>
      <p className="room-subtitle">ようこそ AIRIA BEYOND へ</p>
      
      {!isCompleted ? (
        <OnboardingForm onComplete={handleComplete} />
      ) : (
        <div className="onboarding-complete">
          <h2 className="blend-text">完了しました！</h2>
          <p className="completion-message">
            ありがとうございます。あなたの回答は保存されました。<br />
            この情報は、より良いセッション体験のために活用されます。
          </p>
          <div className="button-group">
            <button className="btn btn-secondary" onClick={handleRestart}>
              回答を編集
            </button>
            <button 
              className="btn btn-primary" 
              onClick={() => {
                if (!completedData) return;
                const dataStr = JSON.stringify(completedData, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'onboarding_profile.json';
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              プロフィールをダウンロード
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnboardingRoom;
