import React, { useState, useEffect } from 'react';

// Types for onboarding data
export interface OnboardingData {
  recentMomentWhen: string;
  recentMomentEmotion: string;
  recentMomentWhy: string;
  dailyPatternWhen: string;
  dailyPatternEmotion: string;
  emotionalTrigger: string;
  emotionalTriggerWhy: string;
  emotionalGoal: string;
  emotionalGoalTimeframe: string;
  completedAt?: string;
}

const STORAGE_KEY = 'airia_onboarding_data';

// Time period options
const TIME_PERIODS = [
  { value: '', label: '選択してください' },
  { value: '今日', label: '今日' },
  { value: '昨日', label: '昨日' },
  { value: '今週', label: '今週' },
  { value: '先週', label: '先週' },
  { value: '今月', label: '今月' },
  { value: '先月', label: '先月' },
];

// Daily time slots
const DAILY_TIME_SLOTS = [
  { value: '', label: '選択してください' },
  { value: '朝（6-9時）', label: '朝（6-9時）' },
  { value: '午前（9-12時）', label: '午前（9-12時）' },
  { value: '昼（12-15時）', label: '昼（12-15時）' },
  { value: '午後（15-18時）', label: '午後（15-18時）' },
  { value: '夕方（18-21時）', label: '夕方（18-21時）' },
  { value: '夜（21-24時）', label: '夜（21-24時）' },
  { value: '深夜（0-6時）', label: '深夜（0-6時）' },
];

// Emotion options
const EMOTIONS = [
  { value: '', label: '選択してください' },
  { value: '穏やか', label: '😌 穏やか' },
  { value: '嬉しい', label: '😊 嬉しい' },
  { value: '不安', label: '😰 不安' },
  { value: '疲れ', label: '😫 疲れ' },
  { value: '怒り', label: '😠 怒り' },
  { value: '悲しい', label: '😢 悲しい' },
  { value: '興奮', label: '🤩 興奮' },
  { value: '退屈', label: '😐 退屈' },
];

// Timeframe for goals
const GOAL_TIMEFRAMES = [
  { value: '', label: '選択してください' },
  { value: '1週間以内', label: '1週間以内' },
  { value: '1ヶ月以内', label: '1ヶ月以内' },
  { value: '3ヶ月以内', label: '3ヶ月以内' },
  { value: '6ヶ月以内', label: '6ヶ月以内' },
  { value: '1年以内', label: '1年以内' },
  { value: '長期的', label: '長期的' },
];

interface OnboardingFormProps {
  onComplete?: (data: OnboardingData) => void;
}

const OnboardingForm: React.FC<OnboardingFormProps> = ({ onComplete }) => {
  const [formData, setFormData] = useState<OnboardingData>({
    recentMomentWhen: '',
    recentMomentEmotion: '',
    recentMomentWhy: '',
    dailyPatternWhen: '',
    dailyPatternEmotion: '',
    emotionalTrigger: '',
    emotionalTriggerWhy: '',
    emotionalGoal: '',
    emotionalGoalTimeframe: '',
  });

  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 4;

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFormData(parsed);
      } catch (e) {
        console.error('Failed to parse saved onboarding data:', e);
      }
    }
  }, []);

  // Save to localStorage whenever formData changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
  }, [formData]);

  const updateField = (field: keyof OnboardingData, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    const completedData = {
      ...formData,
      completedAt: new Date().toISOString(),
    };
    setFormData(completedData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completedData));
    if (onComplete) {
      onComplete(completedData);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return formData.recentMomentWhen && formData.recentMomentEmotion && formData.recentMomentWhy.trim();
      case 1:
        return formData.dailyPatternWhen && formData.dailyPatternEmotion;
      case 2:
        return formData.emotionalTrigger && formData.emotionalTriggerWhy.trim();
      case 3:
        return formData.emotionalGoal.trim() && formData.emotionalGoalTimeframe;
      default:
        return false;
    }
  };

  return (
    <div className="onboarding-form">
      <div className="onboarding-header">
        <h2 className="blend-text">深い自己理解への質問</h2>
        <p className="onboarding-subtitle">
          あなたの感情のパターンを理解し、より良い自己認識を築きましょう
        </p>
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
          />
        </div>
        <p className="step-indicator">ステップ {currentStep + 1} / {totalSteps}</p>
      </div>

      <div className="question-container">
        {currentStep === 0 && (
          <div className="question-step">
            <h3 className="question-title">1. 最近の感情的な瞬間</h3>
            <p className="question-description">
              最近経験した強い感情の瞬間について教えてください
            </p>
            
            <div className="form-group">
              <label htmlFor="recent-when">それはいつでしたか？</label>
              <select
                id="recent-when"
                className="form-select"
                value={formData.recentMomentWhen}
                onChange={(e) => updateField('recentMomentWhen', e.target.value)}
              >
                {TIME_PERIODS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="recent-emotion">どんな感情でしたか？</label>
              <select
                id="recent-emotion"
                className="form-select"
                value={formData.recentMomentEmotion}
                onChange={(e) => updateField('recentMomentEmotion', e.target.value)}
              >
                {EMOTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="recent-why">なぜその感情が湧いたのですか？</label>
              <textarea
                id="recent-why"
                className="form-textarea"
                placeholder="例：プロジェクトが成功したから、大切な人と話せたから、など"
                value={formData.recentMomentWhy}
                onChange={(e) => updateField('recentMomentWhy', e.target.value)}
                rows={3}
              />
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div className="question-step">
            <h3 className="question-title">2. 日常の感情パターン</h3>
            <p className="question-description">
              普段、一日の中でどの時間帯にどんな感情を感じやすいですか？
            </p>
            
            <div className="form-group">
              <label htmlFor="daily-when">最も特徴的な時間帯は？</label>
              <select
                id="daily-when"
                className="form-select"
                value={formData.dailyPatternWhen}
                onChange={(e) => updateField('dailyPatternWhen', e.target.value)}
              >
                {DAILY_TIME_SLOTS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="daily-emotion">その時間帯によく感じる感情は？</label>
              <select
                id="daily-emotion"
                className="form-select"
                value={formData.dailyPatternEmotion}
                onChange={(e) => updateField('dailyPatternEmotion', e.target.value)}
              >
                {EMOTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="question-step">
            <h3 className="question-title">3. 感情のトリガー</h3>
            <p className="question-description">
              あなたの感情を動かす主な要因は何ですか？
            </p>
            
            <div className="form-group">
              <label htmlFor="trigger">最も影響する要因は？</label>
              <input
                id="trigger"
                type="text"
                className="form-input"
                placeholder="例：人間関係、仕事、健康、趣味など"
                value={formData.emotionalTrigger}
                onChange={(e) => updateField('emotionalTrigger', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="trigger-why">それはなぜですか？</label>
              <textarea
                id="trigger-why"
                className="form-textarea"
                placeholder="その要因があなたにとって重要な理由を教えてください"
                value={formData.emotionalTriggerWhy}
                onChange={(e) => updateField('emotionalTriggerWhy', e.target.value)}
                rows={3}
              />
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="question-step">
            <h3 className="question-title">4. 感情面での目標</h3>
            <p className="question-description">
              感情面でどうなりたいですか？
            </p>
            
            <div className="form-group">
              <label htmlFor="goal">あなたの感情的な目標は？</label>
              <textarea
                id="goal"
                className="form-textarea"
                placeholder="例：もっと穏やかでいたい、ストレスに強くなりたい、喜びを増やしたいなど"
                value={formData.emotionalGoal}
                onChange={(e) => updateField('emotionalGoal', e.target.value)}
                rows={3}
              />
            </div>

            <div className="form-group">
              <label htmlFor="goal-timeframe">いつまでに達成したいですか？</label>
              <select
                id="goal-timeframe"
                className="form-select"
                value={formData.emotionalGoalTimeframe}
                onChange={(e) => updateField('emotionalGoalTimeframe', e.target.value)}
              >
                {GOAL_TIMEFRAMES.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="button-group">
        {currentStep > 0 && (
          <button 
            className="btn btn-secondary"
            onClick={handlePrevious}
          >
            ← 戻る
          </button>
        )}
        
        {currentStep < totalSteps - 1 ? (
          <button 
            className="btn btn-primary"
            onClick={handleNext}
            disabled={!canProceed()}
          >
            次へ →
          </button>
        ) : (
          <button 
            className="btn btn-success"
            onClick={handleSubmit}
            disabled={!canProceed()}
          >
            ✓ 完了
          </button>
        )}
      </div>
    </div>
  );
};

export default OnboardingForm;
