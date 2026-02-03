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

type ChoiceOption = { value: string; title: string; desc?: string };

const START_MODE_CHOICES: Array<ChoiceOption & { value: OnboardingData['startMode'] }> = [
  { value: 'talk', title: '会話から', desc: 'やさしく整えてから、次へ' },
  { value: 'create', title: '創作から', desc: '早く作品に進みたい' },
];

// Keep onboarding lightweight: each step is 2–4 choices.
const RECENT_WHEN_CHOICES: ChoiceOption[] = [
  { value: '今日', title: '今日', desc: 'いちばん最近の出来事' },
  { value: '今週', title: '今週', desc: '数日の範囲' },
  { value: '今月', title: '今月', desc: '少し長め' },
  { value: '少し前', title: '少し前', desc: 'はっきりしない/覚えてない' },
];

const DAILY_WHEN_CHOICES: ChoiceOption[] = [
  { value: '朝', title: '朝', desc: 'スタートを整えたい' },
  { value: '昼', title: '昼', desc: '途中で乱れやすい' },
  { value: '夕方', title: '夕方', desc: '疲れが出やすい' },
  { value: '夜', title: '夜', desc: '余韻が残る/考えが巡る' },
];

// Keep to the most common four; downstream mapping supports more, but this is faster.
const EMOTION_CHOICES: ChoiceOption[] = [
  { value: '穏やか', title: '穏やか', desc: '静か/落ち着く' },
  { value: '嬉しい', title: '嬉しい', desc: '軽い高揚/前向き' },
  { value: '不安', title: '不安', desc: 'ざわつく/心配' },
  { value: '疲れ', title: '疲れ', desc: '消耗/休みたい' },
];

const RECENT_WHY_CHOICES: ChoiceOption[] = [
  { value: '達成/うまくいった', title: '達成', desc: 'うまくいった/進んだ' },
  { value: '不確実/心配', title: '心配', desc: '先が読めない/不確実' },
  { value: '人間関係', title: '人', desc: '誰かとのやり取り' },
  { value: '体力/睡眠', title: '体', desc: '寝不足/疲労/体調' },
];

const TRIGGER_CHOICES: ChoiceOption[] = [
  { value: '仕事/学業', title: '仕事', desc: '締切/評価/責任' },
  { value: '人間関係', title: '人間関係', desc: '距離感/言葉/空気' },
  { value: '体調/睡眠', title: '体調', desc: '疲れ/睡眠/コンディション' },
  { value: 'SNS/情報', title: '情報', desc: '比較/ニュース/刺激' },
];

const TRIGGER_WHY_CHOICES: ChoiceOption[] = [
  { value: '評価や期待が気になる', title: '評価', desc: '期待に応えたい/怖い' },
  { value: '比較してしまう', title: '比較', desc: '周りと比べて落ちる' },
  { value: '疲れると増幅する', title: '疲労', desc: '体力が落ちると不安が増える' },
  { value: '言語化できず溜まる', title: '未消化', desc: 'うまく言えず残る' },
];

// Include keywords used by onboardingMusic (集中/安心/眠) to keep downstream behavior strong.
const GOAL_CHOICES: ChoiceOption[] = [
  { value: '落ち着いて集中したい', title: '集中', desc: '静かに深く入りたい' },
  { value: '安心して眠りたい', title: '眠り', desc: '夜にほどけたい' },
  { value: '不安を小さくしたい', title: '安心', desc: 'ざわつきを鎮めたい' },
  { value: '気分を切り替えたい', title: '切替', desc: '短時間で整えたい' },
];

const GOAL_TIMEFRAME_CHOICES: ChoiceOption[] = [
  { value: '1週間以内', title: '1週間', desc: '短期で変えたい' },
  { value: '1ヶ月以内', title: '1ヶ月', desc: '少しずつ整える' },
  { value: '3ヶ月以内', title: '3ヶ月', desc: '習慣化したい' },
  { value: '長期的', title: '長期', desc: 'ゆっくり育てる' },
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
    kind: 'choices';
    options: ChoiceOption[];
  };

  const stepStartMode: Step = {
    key: 'startMode',
    title: 'はじめに：どちらから始めたい？',
    description: '迷ったら「会話から」でOK。後からいつでも変えられます。',
    kind: 'choices',
    options: START_MODE_CHOICES,
  };

  const stepRecentMomentWhen: Step = {
    key: 'recentMomentWhen',
    title: '最近の感情的な瞬間は「いつ」でしたか？',
    description: '時間の粒度はざっくりで大丈夫です。',
    kind: 'choices',
    options: RECENT_WHEN_CHOICES,
  };

  const stepRecentMomentEmotion: Step = {
    key: 'recentMomentEmotion',
    title: 'そのときの感情は？',
    description: '一番近いものを選んでください。',
    kind: 'choices',
    options: EMOTION_CHOICES,
  };

  const stepRecentMomentWhy: Step = {
    key: 'recentMomentWhy',
    title: 'なぜその感情が湧きましたか？',
    description: '一番近い理由を選んでください。',
    kind: 'choices',
    options: RECENT_WHY_CHOICES,
  };

  const stepDailyPatternWhen: Step = {
    key: 'dailyPatternWhen',
    title: '普段、感情が動きやすい時間帯は？',
    description: '一日の中で特徴的な時間帯を選んでください。',
    kind: 'choices',
    options: DAILY_WHEN_CHOICES,
  };

  const stepDailyPatternEmotion: Step = {
    key: 'dailyPatternEmotion',
    title: 'その時間帯に感じやすい感情は？',
    description: '一番よく起きるものを選んでください。',
    kind: 'choices',
    options: EMOTION_CHOICES,
  };

  const stepEmotionalTrigger: Step = {
    key: 'emotionalTrigger',
    title: '感情を動かしやすい「きっかけ」は？',
    description: '一番近いものを選んでください。',
    kind: 'choices',
    options: TRIGGER_CHOICES,
  };

  const stepEmotionalTriggerWhy: Step = {
    key: 'emotionalTriggerWhy',
    title: 'そのきっかけが影響する理由は？',
    description: '一番近いものを選んでください。',
    kind: 'choices',
    options: TRIGGER_WHY_CHOICES,
  };

  const stepEmotionalGoal: Step = {
    key: 'emotionalGoal',
    title: 'これから目指したい感情は？',
    description: 'どんな状態で過ごしたいですか？',
    kind: 'choices',
    options: GOAL_CHOICES,
  };

  const stepEmotionalGoalTimeframe: Step = {
    key: 'emotionalGoalTimeframe',
    title: 'その目標はいつ頃までに？',
    description: '時間感覚を選んでください。',
    kind: 'choices',
    options: GOAL_TIMEFRAME_CHOICES,
  };

  const steps: Step[] = React.useMemo(() => {
    // create: shortest path to get you into making something
    if (formData.startMode === 'create') {
      return [stepStartMode, stepRecentMomentEmotion, stepEmotionalGoal, stepEmotionalGoalTimeframe];
    }

    // talk (default): full introspection path
    return [
      stepStartMode,
      stepRecentMomentWhen,
      stepRecentMomentEmotion,
      stepRecentMomentWhy,
      stepDailyPatternWhen,
      stepDailyPatternEmotion,
      stepEmotionalTrigger,
      stepEmotionalTriggerWhy,
      stepEmotionalGoal,
      stepEmotionalGoalTimeframe,
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.startMode]);

  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = steps.length;

  useEffect(() => {
    if (currentStep > steps.length - 1) {
      setCurrentStep(Math.max(0, steps.length - 1));
    }
  }, [currentStep, steps.length]);

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

  const selectChoice = (field: keyof OnboardingData, value: string) => {
    const nextData = { ...formData, [field]: value } as OnboardingData;
    setFormData(nextData);
    saveToLocalStorage(nextData);
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
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
    // Be tolerant of short-path onboarding: fill key fields if empty.
    const normalized: OnboardingData = {
      ...formData,
      recentMomentWhen: formData.recentMomentWhen || '最近',
      dailyPatternWhen: formData.dailyPatternWhen || (formData.startMode === 'create' ? '夜' : ''),
      recentMomentEmotion: formData.recentMomentEmotion || formData.dailyPatternEmotion,
      dailyPatternEmotion: formData.dailyPatternEmotion || formData.recentMomentEmotion,
      recentMomentWhy: formData.recentMomentWhy || '未指定',
      emotionalTrigger: formData.emotionalTrigger || '未指定',
      emotionalTriggerWhy: formData.emotionalTriggerWhy || '未指定',
      emotionalGoal: formData.emotionalGoal || '落ち着いて集中したい',
      emotionalGoalTimeframe: formData.emotionalGoalTimeframe || '1ヶ月以内',
      completedAt: new Date().toISOString(),
    };
    const completedData = normalized;
    setFormData(completedData);
    saveToLocalStorage(completedData);
    if (onComplete) {
      onComplete(completedData);
    }
  };

  const canProceed = () => {
    const step = steps[currentStep];
    const value = String(formData[step.key] ?? '');
    return value.trim().length > 0;
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
                <div className="choice-grid" role="group" aria-label={step.title}>
                  {step.options.map((option) => {
                    const currentValue = String(formData[step.key] ?? '');
                    const selected = currentValue === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`choice-btn ${selected ? 'is-selected' : ''}`}
                        onClick={() =>
                          selectChoice(
                            step.key,
                            // Type safety: startMode is constrained, others are string.
                            option.value
                          )
                        }
                        aria-pressed={selected}
                      >
                        <div className="choice-title">{option.title}</div>
                        {option.desc ? <div className="choice-desc">{option.desc}</div> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      <div className="onboarding-actions" data-no-swipe="true" aria-label="オンボーディング操作">
        <div className="button-group">
          {currentStep > 0 && (
            <button 
              className="btn btn-secondary"
              onClick={handlePrevious}
              type="button"
            >
              ← 戻る
            </button>
          )}
          
          {currentStep < totalSteps - 1 ? (
            <button 
              className="btn btn-primary"
              onClick={handleNext}
              disabled={!canProceed()}
              type="button"
            >
              次へ →
            </button>
          ) : (
            <button 
              className="btn btn-success"
              onClick={handleSubmit}
              disabled={!canProceed()}
              type="button"
            >
              完了
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingForm;
