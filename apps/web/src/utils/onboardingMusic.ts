import type { OnboardingData } from '../components/OnboardingForm';

const ONBOARDING_STORAGE_KEY = 'airia_onboarding_data';

export function loadOnboardingData(): OnboardingData | null {
  try {
    const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as OnboardingData;
  } catch {
    return null;
  }
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function clampValence(n: number) {
  return Math.max(-1, Math.min(1, n));
}

function emotionToIR(emotion: string | undefined) {
  const e = String(emotion ?? '').trim();
  switch (e) {
    case '穏やか':
      return { valence: 0.15, arousal: 0.25 };
    case '嬉しい':
      return { valence: 0.65, arousal: 0.65 };
    case '不安':
      return { valence: -0.55, arousal: 0.65 };
    case '疲れ':
      return { valence: -0.2, arousal: 0.25 };
    case '怒り':
      return { valence: -0.65, arousal: 0.85 };
    case '悲しい':
      return { valence: -0.7, arousal: 0.35 };
    case '興奮':
      return { valence: 0.5, arousal: 0.9 };
    case '退屈':
      return { valence: -0.1, arousal: 0.15 };
    default:
      return { valence: 0, arousal: 0.45 };
  }
}

function pickMotifTags(data: OnboardingData): string[] {
  const tags = new Set<string>();

  const mood = data.recentMomentEmotion || data.dailyPatternEmotion;
  const e = String(mood ?? '').trim();

  // Baseline: these work well with existing prompt rules.
  tags.add('余韻');
  tags.add('光');

  if (e === '不安') {
    tags.add('霧');
    tags.add('揺れ');
  } else if (e === '穏やか') {
    tags.add('水面');
    tags.add('静寂');
  } else if (e === '疲れ') {
    tags.add('夜');
    tags.add('静寂');
  } else if (e === '嬉しい') {
    tags.add('風');
    tags.add('朝');
  } else if (e === '悲しい') {
    tags.add('影');
    tags.add('雨');
  } else if (e === '怒り') {
    tags.add('火');
    tags.add('鋭さ');
  } else if (e === '興奮') {
    tags.add('閃光');
    tags.add('躍動');
  } else if (e === '退屈') {
    tags.add('無音');
    tags.add('空');
  }

  const goal = String(data.emotionalGoal ?? '').trim();
  if (goal.includes('集中')) tags.add('集中');
  if (goal.includes('安心') || goal.includes('安')) tags.add('安心');
  if (goal.includes('眠')) tags.add('眠り');
  if (goal.includes('整')) tags.add('整う');

  const arr = [...tags];
  return arr.slice(0, 5);
}

export function onboardingToChatPayload(data: OnboardingData): {
  emotionalProfile: string;
  preferences: Record<string, any>;
} {
  const mood = data.recentMomentEmotion || data.dailyPatternEmotion || '未指定';
  const goal = String(data.emotionalGoal ?? '').trim();
  const trigger = String(data.emotionalTrigger ?? '').trim();

  const emotionalProfile = [
    `startMode:${data.startMode || '未指定'}`,
    `mood:${mood}`,
    goal ? `goal:${goal.slice(0, 80)}` : null,
    trigger ? `trigger:${trigger.slice(0, 60)}` : null,
  ]
    .filter(Boolean)
    .join(' / ');

  return {
    emotionalProfile,
    preferences: {
      ...data,
      startMode: data.startMode,
    },
  };
}

export function onboardingToMusicRequest(data: OnboardingData): {
  valence: number;
  arousal: number;
  focus: number;
  motif_tags: string[];
  confidence: number;
  duration: number;
} {
  const a = emotionToIR(data.recentMomentEmotion);
  const b = emotionToIR(data.dailyPatternEmotion);

  const valence = clampValence((a.valence + b.valence) / 2);
  const arousal = clamp01((a.arousal + b.arousal) / 2);

  // startMode hints whether we should keep structure clearer.
  const focus = clamp01(data.startMode === 'create' ? 0.78 : 0.68);

  const motif_tags = pickMotifTags(data);
  const confidence = 0.65;
  const duration = data.startMode === 'create' ? 210 : 180;

  return { valence, arousal, focus, motif_tags, confidence, duration };
}

export function createPlaceholderCoverDataUrl(opts: { title?: string; mood?: string; seed?: string | number }): string {
  const title = String(opts.title ?? '').trim() || 'AIRIA';
  const mood = String(opts.mood ?? '').trim() || 'mood';
  const seed = String(opts.seed ?? '0');
  const hue = Math.abs(
    seed.split('').reduce((acc, ch) => acc * 33 + ch.charCodeAt(0), 7)
  ) % 360;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue} 70% 52%)" stop-opacity="0.95"/>
      <stop offset="55%" stop-color="hsl(${(hue + 35) % 360} 65% 42%)" stop-opacity="0.92"/>
      <stop offset="100%" stop-color="hsl(${(hue + 120) % 360} 55% 28%)" stop-opacity="0.95"/>
    </linearGradient>
    <filter id="n">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 0.16"/>
      </feComponentTransfer>
    </filter>
  </defs>
  <rect width="1024" height="1024" fill="url(#g)"/>
  <rect width="1024" height="1024" filter="url(#n)" opacity="0.6"/>
  <circle cx="770" cy="300" r="240" fill="rgba(255,255,255,0.14)"/>
  <circle cx="820" cy="270" r="120" fill="rgba(0,0,0,0.10)"/>

  <g fill="rgba(255,255,255,0.92)" font-family="system-ui, -apple-system, Segoe UI, sans-serif">
    <text x="72" y="794" font-size="54" font-weight="720" letter-spacing="0.02em">${escapeXml(title).slice(0, 28)}</text>
    <text x="72" y="858" font-size="28" font-weight="600" opacity="0.9">${escapeXml(mood).slice(0, 24)}</text>
    <text x="72" y="916" font-size="18" opacity="0.8">Generated from onboarding</text>
  </g>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
