import React, { useState } from 'react';
import OnboardingForm, { OnboardingData } from '../OnboardingForm';
import GeometricCanvas from '../visual/GeometricCanvas';
import '../OnboardingForm.css';

type Props = {
  onExit?: () => void;
};

const OnboardingRoom: React.FC<Props> = ({ onExit }) => {
  const [isCompleted, setIsCompleted] = useState(false);
  const [completedData, setCompletedData] = useState<OnboardingData | null>(null);
  const [progress, setProgress] = useState(0);

  const handleComplete = (data: OnboardingData) => {
    setCompletedData(data);
    setIsCompleted(true);
  };

  const handleRestart = () => {
    setIsCompleted(false);
    setCompletedData(null);
    setProgress(0);
  };

  return (
    <div className="room-content">
      {/* Onboarding only: progress/introspection symbol (backgrounded) */}
      {!isCompleted && (
        <GeometricCanvas
          pattern="polyhedron"
          isActive={true}
          progress={progress}
          layer="background"
          placement="center"
          sizePx={420}
          opacity={0.16}
        />
      )}
      
      <h1 className="room-title">はじめに</h1>
      <p className="room-subtitle">あなたに合う体験へ整えます</p>
      
      {!isCompleted ? (
        <OnboardingForm onComplete={handleComplete} onProgressChange={setProgress} />
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
                a.download = 'getting_started_profile.json';
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              プロフィールをダウンロード
            </button>
            <button
              className="btn btn-success"
              onClick={() => {
                onExit?.();
              }}
            >
              はじめる
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnboardingRoom;
