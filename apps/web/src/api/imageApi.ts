/**
 * Client API utilities for communicating with the backend
 */

import { authFetch } from './authApi';

/**
 * Analysis request/response types
 */
export interface AnalyzeRequest {
  mood: string;
  duration: number;
  onboardingData?: {
    emotionalProfile?: string;
    preferences?: Record<string, any>;
  };
  freeText?: string;
  timestamp?: string;
}

export interface AnalyzeResponse {
  jobId: string;
  status: string;
  message: string;
}

export interface IntermediateRepresentation {
  valence: number;
  arousal: number;
  focus: number;
  motif_tags: string[];
  confidence: number;
  classical_profile?: {
    tempo?: string;
    dynamics?: string;
    harmony?: string;
  };
}

export interface AnalysisJobStatus {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  provider: 'openai' | 'ollama' | 'rule-based' | string;
  input: AnalyzeRequest;
  result?: IntermediateRepresentation;
}

export interface GenerateImageRequest {
  mood: string;
  duration: number;
  motifTags?: string[];
  stylePreset?: string;
  seed?: number;
  valence?: number;
  arousal?: number;
  focus?: number;
  confidence?: number;

  // Optional art-direction inputs (from event refine)
  subject?: string;
  palette?: string;
  ambiguity?: number;
  density?: number;
  period?: string;
  instrumentation?: string[];

  // Optional: musical key (e.g., "D minor", "C Major", "F# minor") for color-direction mapping
  key?: string;

  // Optional: style reference image URL for ComfyUI IP-Adapter (advanced)
  styleReferenceImageUrl?: string;
}

export interface GenerateImageResponse {
  jobId: string;
  status: string;
  message: string;
  provider?: string;
}

export interface JobStatus {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  provider: string;
  model: string;
  input: {
    mood?: string;
    duration?: number;
    stylePreset?: string;
    seed?: number;
    motifTags?: string[];
    valence?: number;
    arousal?: number;
    focus?: number;
    confidence?: number;
  };
  inputSummary: {
    mood?: string;
    duration?: number;
    stylePreset?: string;
    seed?: number;
    density?: number;
  };
  result?: string;
  resultUrl?: string;

  // Optional diagnostics fields (server may attach these)
  warnings?: string[];
  fallbackUsed?: boolean;
  effectiveProvider?: string;
  fallbackReason?: string;
  generationError?: string;
}

export interface ApiError {
  error: string;
  message?: string;
}

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export interface RecommendationItem {
  composer: string;
  title: string;
  era?: string;
  why: string;
}

export interface ChatTurnRequest {
  messages: ChatMessage[];
  onboardingData?: AnalyzeRequest['onboardingData'];
}

export interface ChatTurnResponse {
  assistant_message: string;
  recommendations: RecommendationItem[];
  provider: 'openai' | 'rule-based';
  event_suggestion?: {
    shouldTrigger: boolean;
    reason: string;
  };
}

export interface RefineEventRequest {
  messages: ChatMessage[];
  onboardingData?: AnalyzeRequest['onboardingData'];
}

export interface RefinedEventResponse {
  provider: 'openai' | 'rule-based';
  brief: any;
  analysisLike: IntermediateRepresentation;
  image: GenerateImageRequest;
  music: {
    valence: number;
    arousal: number;
    focus: number;
    motif_tags: string[];
    duration: number;
    genre_palette?: string[];
    primary_genre?: string;
    instrumentation?: string[];
    timbre_arc?: any;
    theme?: any;
    personality_axes?: any;
    emotional_arc?: any;
    humanize?: any;

    // Advanced classical controls (optional)
    key?: string;
    tempo?: number;
    timeSignature?: string;
    form?: string;
    period?: string;
    motif_seed?: number[];
    rhythm_seed?: number[];
    section_plan?: any;
  };
}

export interface NameAlbumTitleRequest {
  mood: string;
  motifTags?: string[];
  character?: string;
  brief?: any;
  messages?: ChatMessage[];
}

export interface NameAlbumTitleResponse {
  title: string;
  provider: 'openai' | 'rule-based';
}

export interface MusicPreviewRequest {
  composer: string;
  title: string;
}

export interface MusicPreviewResponse {
  found: boolean;
  previewUrl: string | null;
  trackUrl: string | null;
  artistName: string | null;
  trackName: string | null;
  artworkUrl: string | null;
  source?: string;
}

// Detect API base URL from environment variable
const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '');

async function readJsonSafe(response: Response) {
  return response.json().catch(() => null);
}

function looksLikeNetworkError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return /failed to fetch/i.test(msg) || /networkerror/i.test(msg) || /load failed/i.test(msg) || /timeout/i.test(msg);
}

function makeNetworkHelpMessage(action: string) {
  const base = API_BASE || '(empty)';
  const origin = (() => {
    try {
      return window.location.origin;
    } catch {
      return '(unknown)';
    }
  })();
  return [
    `${action} に失敗しました（通信エラー）`,
    `API: ${base}`,
    `Origin: ${origin}`,
    `原因候補: VITE_API_BASE_URL 未設定/誤り、APIサーバ停止、CORS未許可`,
  ].join('\n');
}

function assertApiBaseIsUsable(action: string) {
  if (!API_BASE) {
    throw new Error(
      `${action} に失敗しました（API設定が未完了です）。\n` +
        `VITE_API_BASE_URL をバックエンド（例: https://api.airia-beyond.com）に設定して再デプロイしてください。`
    );
  }

  try {
    const pageProtocol = window.location.protocol;
    if (pageProtocol === 'https:' && /^http:\/\//i.test(API_BASE)) {
      throw new Error(
        `${action} に失敗しました（Mixed Content）。\n` +
          `HTTPS のページから HTTP の API（${API_BASE}）へは接続できません。API を https:// にするか、VITE_API_BASE_URL をHTTPSのURLにしてください。`
      );
    }
  } catch {
    // ignore
  }
}

async function assertJsonResponse(response: Response, json: any, action: string) {
  const ct = String(response.headers.get('content-type') || '').toLowerCase();
  if (json == null) {
    if (response.ok && ct.includes('text/html')) {
      throw new Error(
        `${action} に失敗しました（API応答がHTMLでした）。VITE_API_BASE_URL がフロントに向いている可能性があります。`
      );
    }
    if (response.ok && !ct.includes('application/json')) {
      throw new Error(`${action} に失敗しました（API応答がJSONではありません）。API設定を確認してください。`);
    }
  }
}

function makeHttpErrorMessage(action: string, response: Response, json: any) {
  const msg = String(json?.message || json?.error || '').trim();
  if (response.status === 401 || response.status === 403) {
    return msg || `${action} に失敗しました（ログインが必要です）`;
  }
  if (response.status === 429) {
    return msg || `${action} に失敗しました（混み合っています）。少し待ってから再試行してください。`;
  }
  return msg || `${action} に失敗しました（HTTP ${response.status}）`;
}

/**
 * Generate an image using the external API
 */
export async function generateImage(
  request: GenerateImageRequest
): Promise<GenerateImageResponse> {
  try {
    assertApiBaseIsUsable('画像生成');
    const response = await fetch(`${API_BASE}/api/image/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const json = await readJsonSafe(response);
    await assertJsonResponse(response, json, '画像生成');
    if (!response.ok) throw new Error(makeHttpErrorMessage('画像生成', response, json));
    return json as GenerateImageResponse;
  } catch (e) {
    if (looksLikeNetworkError(e)) throw new Error(makeNetworkHelpMessage('画像生成'));
    throw e;
  }
}

/**
 * Get job status
 */
export async function getJobStatus(jobId: string, signal?: AbortSignal): Promise<JobStatus> {
  try {
    assertApiBaseIsUsable('生成状況の取得');
    const response = await fetch(`${API_BASE}/api/job/${jobId}`, { signal });
    const json = await readJsonSafe(response);
    await assertJsonResponse(response, json, '生成状況の取得');
    if (!response.ok) throw new Error(makeHttpErrorMessage('生成状況の取得', response, json));
    return json as JobStatus;
  } catch (e) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (looksLikeNetworkError(e)) throw new Error(makeNetworkHelpMessage('生成状況の取得'));
    throw e;
  }
}

/**
 * Poll job status until completion
 * @param jobId Job ID to poll
 * @param onUpdate Callback for status updates
 * @param maxAttempts Maximum number of polling attempts (default: 60)
 * @param intervalMs Polling interval in milliseconds (default: 2000)
 */
export async function pollJobStatus(
  jobId: string,
  onUpdate?: (status: JobStatus) => void,
  maxAttempts: number = 60,
  intervalMs: number = 2000,
  signal?: AbortSignal
): Promise<JobStatus> {
  let lastError: unknown = null;
  for (let i = 0; i < maxAttempts; i++) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    let status: JobStatus;
    try {
      status = await getJobStatus(jobId, signal);
    } catch (e) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      lastError = e;
      await new Promise((resolve) => setTimeout(resolve, Math.min(intervalMs * 2, 5000)));
      continue;
    }
    
    if (onUpdate) {
      onUpdate(status);
    }

    if (status.status === 'succeeded' || status.status === 'failed') {
      return status;
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error('生成状況の確認がタイムアウトしました。通信環境を確認して、あとで再開してください。');
}

/**
 * Retry a failed job by creating a new generation with the same input
 */
export async function retryJob(failedJobId: string): Promise<GenerateImageResponse> {
  // Get the failed job to extract input parameters
  const failedJob = await getJobStatus(failedJobId);
  
  if (!failedJob.input) {
    throw new Error('Cannot retry: job input not available');
  }
  
  // Create a new generation with the same input
  return generateImage({
    mood: failedJob.input.mood || '',
    duration: failedJob.input.duration || 60,
    motifTags: failedJob.input.motifTags,
    stylePreset: failedJob.input.stylePreset,
    seed: failedJob.input.seed,
    valence: failedJob.input.valence,
    arousal: failedJob.input.arousal,
    focus: failedJob.input.focus,
    confidence: failedJob.input.confidence,
  });
}

/**
 * Analyze session data to generate intermediate representation
 */
export async function analyzeSession(request: AnalyzeRequest): Promise<AnalyzeResponse> {
  try {
    assertApiBaseIsUsable('分析');
    const response = await fetch(`${API_BASE}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const json = await readJsonSafe(response);
    await assertJsonResponse(response, json, '分析');
    if (!response.ok) throw new Error(makeHttpErrorMessage('分析', response, json));
    return json as AnalyzeResponse;
  } catch (e) {
    if (looksLikeNetworkError(e)) throw new Error(makeNetworkHelpMessage('分析'));
    throw e;
  }
}

/**
 * Daily conversation + recommendation
 */
export async function chatTurn(request: ChatTurnRequest): Promise<ChatTurnResponse> {
  try {
    assertApiBaseIsUsable('会話');
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const json = await readJsonSafe(response);
    await assertJsonResponse(response, json, '会話');
    if (!response.ok) throw new Error(makeHttpErrorMessage('会話', response, json));
    return json as ChatTurnResponse;
  } catch (e) {
    if (looksLikeNetworkError(e)) throw new Error(makeNetworkHelpMessage('会話'));
    throw e;
  }
}

/**
 * Refine a generation event from conversation logs
 */
export async function refineGenerationEvent(request: RefineEventRequest): Promise<RefinedEventResponse> {
  try {
    assertApiBaseIsUsable('イベントの整形');
    const response = await fetch(`${API_BASE}/api/event/refine`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const json = await readJsonSafe(response);
    await assertJsonResponse(response, json, 'イベントの整形');
    if (!response.ok) throw new Error(makeHttpErrorMessage('イベントの整形', response, json));
    return json as RefinedEventResponse;
  } catch (e) {
    if (looksLikeNetworkError(e)) throw new Error(makeNetworkHelpMessage('イベントの整形'));
    throw e;
  }
}

/**
 * Name an album title (user can leave blank and let LLM propose).
 */
export async function nameAlbumTitle(request: NameAlbumTitleRequest): Promise<NameAlbumTitleResponse> {
  try {
    assertApiBaseIsUsable('タイトル提案');
    const response = await fetch(`${API_BASE}/api/album/name`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const json = await readJsonSafe(response);
    await assertJsonResponse(response, json, 'タイトル提案');
    if (!response.ok) throw new Error(makeHttpErrorMessage('タイトル提案', response, json));
    return json as NameAlbumTitleResponse;
  } catch (e) {
    if (looksLikeNetworkError(e)) throw new Error(makeNetworkHelpMessage('タイトル提案'));
    throw e;
  }
}

/**
 * Resolve a legal short preview URL for a recommended track.
 */
export async function getMusicPreview(request: MusicPreviewRequest): Promise<MusicPreviewResponse> {
  try {
    assertApiBaseIsUsable('プレビュー取得');
    const response = await fetch(`${API_BASE}/api/music/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const json = await readJsonSafe(response);
    await assertJsonResponse(response, json, 'プレビュー取得');
    if (!response.ok) throw new Error(makeHttpErrorMessage('プレビュー取得', response, json));
    return json as MusicPreviewResponse;
  } catch (e) {
    if (looksLikeNetworkError(e)) throw new Error(makeNetworkHelpMessage('プレビュー取得'));
    throw e;
  }
}

/**
 * Get analysis job status
 */
export async function getAnalysisJobStatus(jobId: string, signal?: AbortSignal): Promise<AnalysisJobStatus> {
  try {
    assertApiBaseIsUsable('分析状況の取得');
    const response = await fetch(`${API_BASE}/api/analyze/${jobId}`, { signal });
    const json = await readJsonSafe(response);
    await assertJsonResponse(response, json, '分析状況の取得');
    if (!response.ok) throw new Error(makeHttpErrorMessage('分析状況の取得', response, json));
    return json as AnalysisJobStatus;
  } catch (e) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (looksLikeNetworkError(e)) throw new Error(makeNetworkHelpMessage('分析状況の取得'));
    throw e;
  }
}

/**
 * Poll analysis job status until completion
 */
export async function pollAnalysisJobStatus(
  jobId: string,
  onUpdate?: (status: AnalysisJobStatus) => void,
  maxAttempts: number = 90,
  intervalMs: number = 1000,
  signal?: AbortSignal
): Promise<AnalysisJobStatus> {
  let lastError: unknown = null;
  for (let i = 0; i < maxAttempts; i++) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    let status: AnalysisJobStatus;
    try {
      status = await getAnalysisJobStatus(jobId, signal);
    } catch (e) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      lastError = e;
      await new Promise((resolve) => setTimeout(resolve, Math.min(intervalMs * 2, 5000)));
      continue;
    }
    
    if (onUpdate) {
      onUpdate(status);
    }

    if (status.status === 'succeeded' || status.status === 'failed') {
      return status;
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error('分析状況の確認がタイムアウトしました。通信環境を確認して、あとで再開してください。');
}

/**
 * Music generation types (P4)
 */
export interface GenerateMusicRequest {
  valence: number;
  arousal: number;
  focus: number;
  motif_tags: string[];
  confidence: number;
  duration?: number;
  seed?: number;

  // Optional narrative/performance inputs (from event refine)
  emotional_arc?: any;
  humanize?: any;

  // Advanced controls (optional)
  key?: string;
  tempo?: number;
  timeSignature?: string;
  form?: string;
  period?: string;
  instrumentation?: string[];
  motif_seed?: number[];
  rhythm_seed?: number[];
  section_plan?: any;
}

export interface GenerateMusicResponse {
  jobId: string;
  status: string;
  message: string;
}

export interface MusicStructure {
  key: string;
  tempo: number;
  timeSignature: string;
  form: string;
  sections: any[];
  instrumentation: string;
  character: string;

  // Optional artistic depth fields
  leitmotifs?: any[];
  humanize?: any;
}

export interface MusicJobStatus {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  provider: 'openai' | 'ollama' | 'rule-based' | 'emergency' | string;
  input: GenerateMusicRequest;
  inputSummary?: {
    duration?: number;
    period?: string;
    form?: string;
    key?: string;
    tempo?: number;
    timeSignature?: string;
    motifTagsCount?: number;
    instrumentationCount?: number;
    humanize?: any;
  };
  result?: MusicStructure;
  midiData?: string;

  // Optional diagnostics fields (server may attach these)
  warnings?: string[];
  fallbackUsed?: boolean;
  effectiveProvider?: string;
  fallbackReason?: string;
  generationError?: string;
}

/**
 * Generate music using the API
 */
export async function generateMusic(
  request: GenerateMusicRequest
): Promise<GenerateMusicResponse> {
  try {
    assertApiBaseIsUsable('音楽生成');
    const response = await authFetch(`${API_BASE}/api/music/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const json = await readJsonSafe(response);
    await assertJsonResponse(response, json, '音楽生成');
    if (!response.ok) throw new Error(makeHttpErrorMessage('音楽生成', response, json));
    return json as GenerateMusicResponse;
  } catch (e) {
    if (looksLikeNetworkError(e)) throw new Error(makeNetworkHelpMessage('音楽生成'));
    throw e;
  }
}

/**
 * Get music generation job status
 */
export async function getMusicJobStatus(jobId: string, signal?: AbortSignal): Promise<MusicJobStatus> {
  try {
    assertApiBaseIsUsable('音楽生成状況の取得');
    const response = await authFetch(`${API_BASE}/api/music/${jobId}`, { signal });
    const json = await readJsonSafe(response);
    await assertJsonResponse(response, json, '音楽生成状況の取得');
    if (!response.ok) throw new Error(makeHttpErrorMessage('音楽生成状況の取得', response, json));
    return json as MusicJobStatus;
  } catch (e) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (looksLikeNetworkError(e)) throw new Error(makeNetworkHelpMessage('音楽生成状況の取得'));
    throw e;
  }
}

/**
 * Poll music job status until completion
 */
export async function pollMusicJobStatus(
  jobId: string,
  onUpdate?: (status: MusicJobStatus) => void,
  maxAttempts: number = 60,
  intervalMs: number = 2000,
  signal?: AbortSignal
): Promise<MusicJobStatus> {
  let lastError: unknown = null;
  for (let i = 0; i < maxAttempts; i++) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    let status: MusicJobStatus;
    try {
      status = await getMusicJobStatus(jobId, signal);
    } catch (e) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      lastError = e;
      await new Promise((resolve) => setTimeout(resolve, Math.min(intervalMs * 2, 5000)));
      continue;
    }
    
    if (onUpdate) {
      onUpdate(status);
    }

    if (status.status === 'succeeded' || status.status === 'failed') {
      return status;
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error('音楽生成状況の確認がタイムアウトしました。通信環境を確認して、あとで再開してください。');
}
