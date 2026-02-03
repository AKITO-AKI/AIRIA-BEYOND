export type PendingChatGenerationV1 = {
  v: 1;
  kind: 'chat';
  startedAt: number;
  imageJobId: string;
  musicJobId: string;
  refined: any;
  sessionMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  sessionRecommendations?: Array<{ composer: string; title: string; era?: string; why: string }>;
  causalLogId?: string | null;
};

export type PendingOnboardingGenerationV1 = {
  v: 1;
  kind: 'onboarding';
  startedAt: number;
  musicJobId: string;
  request: {
    valence: number;
    arousal: number;
    focus: number;
    motif_tags: string[];
    confidence: number;
    duration: number;
    seed?: number;
  };
  mood: string;
  title: string;
  coverDataUrl: string;
};

const KEY_CHAT = 'airia_pending_chat_generation_v1';
const KEY_ONBOARDING = 'airia_pending_onboarding_generation_v1';

export function loadPendingChatGeneration(): PendingChatGenerationV1 | null {
  try {
    const raw = localStorage.getItem(KEY_CHAT);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== 1 || parsed.kind !== 'chat') return null;
    if (!parsed.imageJobId || !parsed.musicJobId) return null;
    return parsed as PendingChatGenerationV1;
  } catch {
    return null;
  }
}

export function savePendingChatGeneration(value: PendingChatGenerationV1) {
  try {
    localStorage.setItem(KEY_CHAT, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function clearPendingChatGeneration() {
  try {
    localStorage.removeItem(KEY_CHAT);
  } catch {
    // ignore
  }
}

export function loadPendingOnboardingGeneration(): PendingOnboardingGenerationV1 | null {
  try {
    const raw = localStorage.getItem(KEY_ONBOARDING);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== 1 || parsed.kind !== 'onboarding') return null;
    if (!parsed.musicJobId || !parsed.request || !parsed.coverDataUrl) return null;
    return parsed as PendingOnboardingGenerationV1;
  } catch {
    return null;
  }
}

export function savePendingOnboardingGeneration(value: PendingOnboardingGenerationV1) {
  try {
    localStorage.setItem(KEY_ONBOARDING, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function clearPendingOnboardingGeneration() {
  try {
    localStorage.removeItem(KEY_ONBOARDING);
  } catch {
    // ignore
  }
}
