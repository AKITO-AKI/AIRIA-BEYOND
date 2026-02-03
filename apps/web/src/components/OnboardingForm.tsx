import React, { useState, useEffect } from 'react';

// Types for onboarding data
export interface OnboardingData {
  startMode: 'talk' | 'create' | '';
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

const START_MODES: Array<{ value: OnboardingData['startMode']; label: string }> = [
  { value: '', label: '選択してください' },
  { value: 'talk', label: '会話からはじめる（やさしく）' },
  { value: 'create', label: '創作からはじめる（早く作品へ）' },
];

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
  { value: '穏やか', label: '○ 穏やか' },
  { value: '嬉しい', label: '△ 嬉しい' },
  { value: '不安', label: '□ 不安' },
  { value: '疲れ', label: '◇ 疲れ' },
  { value: '怒り', label: '▲ 怒り' },
  { value: '悲しい', label: '◆ 悲しい' },
  { value: '興奮', label: '▽ 興奮' },
  { value: '退屈', label: '◻︎ 退屈' },
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
  onProgressChange?: (progress: number) => void;
}

const OnboardingForm: React.FC<OnboardingFormProps> = ({ onComplete, onProgressChange }) => {
  const [formData, setFormData] = useState<OnboardingData>({
    startMode: '',
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

  type Step = {
    key: keyof OnboardingData;
    title: string;
    description?: string;
    kind: 'select' | 'textarea' | 'input';
    options?: Array<{ value: string; label: string }>;
    placeholder?: string;
    rows?: number;
  };

  const steps: Step[] = [
    {
      key: 'startMode',
      title: 'はじめに：どちらから始めたい？',
      description: '迷ったら「会話から」でOK。後からいつでも変えられます。',
      kind: 'select',
      options: START_MODES,
    },
    {
      key: 'recentMomentWhen',
      title: '最近の感情的な瞬間は「いつ」でしたか？',
      description: '時間の粒度はざっくりで大丈夫です。',
      kind: 'select',
      options: TIME_PERIODS,
    },
    {
      key: 'recentMomentEmotion',
      title: 'そのときの感情は？',
      description: '一番近いものを選んでください。',
      kind: 'select',
      options: EMOTIONS,
    },
    {
      key: 'recentMomentWhy',
      title: 'なぜその感情が湧きましたか？',
      description: '短文でもOKです。',
      kind: 'textarea',
      placeholder: '例：プロジェクトが成功した／大切な人と話せた／不安な連絡が来た…',
      rows: 4,
    },
    {
      key: 'dailyPatternWhen',
      title: '普段、感情が動きやすい時間帯は？',
      description: '一日の中で特徴的な時間帯を選んでください。',
      kind: 'select',
      options: DAILY_TIME_SLOTS,
    },
    {
      key: 'dailyPatternEmotion',
      title: 'その時間帯に感じやすい感情は？',
      description: '一番よく起きるものを選んでください。',
      kind: 'select',
      options: EMOTIONS,
    },
    {
      key: 'emotionalTrigger',
      title: '感情を動かしやすい「きっかけ」は？',
      description: '要因を一言で書いてください。',
      kind: 'input',
      placeholder: '例：仕事の締切／SNS／睡眠不足／人間関係…',
    },
    {
      key: 'emotionalTriggerWhy',
      title: 'そのきっかけが影響する理由は？',
      description: '背景やパターンがあれば。',
      kind: 'textarea',
      placeholder: '例：評価が気になる／比較してしまう／体力が落ちると不安が増える…',
      rows: 4,
    },
    {
      key: 'emotionalGoal',
      title: 'これから目指したい感情は？',
      description: 'どんな状態で過ごしたいですか？',
      kind: 'textarea',
      placeholder: '例：落ち着いて集中できる／夜に安心して眠れる／穏やかに話せる…',
      rows: 3,
    },
    {
      key: 'emotionalGoalTimeframe',
      title: 'その目標はいつ頃までに？',
      description: '時間感覚を選んでください。',
      kind: 'select',
      options: GOAL_TIMEFRAMES,
    },
  ];

  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = steps.length;

  // Notify progress (0..1, but keep < 1 to avoid triggering polyhedron dissolve)
  useEffect(() => {
    const progress = totalSteps > 0 ? currentStep / totalSteps : 0;
    onProgressChange?.(Math.min(progress, 0.999));
  }, [currentStep, totalSteps, onProgressChange]);

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

  const saveToLocalStorage = (data: OnboardingData) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  };

  const updateField = (field: keyof OnboardingData, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      saveToLocalStorage(formData);
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      saveToLocalStorage(formData);
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    const completedData = {
      ...formData,
      completedAt: new Date().toISOString(),
    };
    setFormData(completedData);
    saveToLocalStorage(completedData);
    if (onComplete) {
      onComplete(completedData);
    }
  };

  const canProceed = () => {
    const step = steps[currentStep];
    const value = String(formData[step.key] ?? '');
    return step.kind === 'select' ? value.length > 0 : value.trim().length > 0;
  };

  return (
    <div className="onboarding-form">
      <div className="onboarding-header">
        <h2 className="blend-text">はじめに</h2>
        <p className="onboarding-subtitle">
          いまのあなたに合わせて、AIRIAが整えます（所要2分・短文OK）
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
        {(() => {
          const step = steps[currentStep];
          return (
            <div className="question-step">
              <h3 className="question-title">{step.title}</h3>
              {step.description ? <p className="question-description">{step.description}</p> : null}

              <div className="form-group">
                {step.kind === 'select' ? (
                  <select
                    className="form-select"
                    value={String(formData[step.key] ?? '')}
                    onChange={(e) => updateField(step.key, e.target.value)}
                  >
                    {(step.options ?? []).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : step.kind === 'input' ? (
                  <input
                    type="text"
                    className="form-input"
                    placeholder={step.placeholder}
                    value={String(formData[step.key] ?? '')}
                    onChange={(e) => updateField(step.key, e.target.value)}
                  />
                ) : (
                  <textarea
                    className="form-textarea"
                    placeholder={step.placeholder}
                    value={String(formData[step.key] ?? '')}
                    onChange={(e) => updateField(step.key, e.target.value)}
                    rows={step.rows ?? 4}
                  />
                )}
              </div>
            </div>
          );
        })()}
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
            完了
          </button>
        )}
      </div>
    </div>
  );
};

export default OnboardingForm;
