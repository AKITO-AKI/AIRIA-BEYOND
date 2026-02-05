/**
 * Conversation + recommendation service
 * - Default: daily conversation + classical recommendation
 * - Occasionally: suggests a generation event (album creation)
 */

import OpenAI from 'openai';
import { ollamaChatJson } from './lib/ollamaClient.js';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function isLikelyOpenAIQuotaOrRateError(error) {
  const status = error?.status;
  const code = error?.code;
  const message = String(error?.message ?? '');
  return (
    status === 429 ||
    code === 'insufficient_quota' ||
    /exceeded your current quota|insufficient_quota|quota/i.test(message)
  );
}

const CURATED_RECS = [
  {
    composer: 'J.S. Bach',
    title: 'Goldberg Variations, BWV 988 (Aria)',
    era: 'Baroque',
    why: '静けさの中に秩序があり、思考を整えたい時に合います。',
  },
  {
    composer: 'Claude Debussy',
    title: 'Clair de Lune (Suite bergamasque)',
    era: 'Impressionism',
    why: '余韻が長く、感情をやわらかくほどくのに向きます。',
  },
  {
    composer: 'Erik Satie',
    title: 'Gymnopédie No.1',
    era: 'Modern',
    why: '言葉にならない疲れや曖昧さをそのまま受け止めてくれます。',
  },
  {
    composer: 'Frédéric Chopin',
    title: 'Nocturne Op.9 No.2',
    era: 'Romantic',
    why: '内省と甘さのバランスがよく、夜の対話に合います。',
  },
  {
    composer: 'Miles Davis',
    title: 'Blue in Green (Kind of Blue)',
    era: 'Jazz',
    why: '静かな緊張感があり、感情の輪郭を少しだけ明確にしてくれます。',
  },
];

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m && typeof m === 'object')
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content ?? '').slice(0, 4000),
    }))
    .filter((m) => m.content.trim().length > 0);
}

function hashString(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getOnboardingStartMode(onboardingData) {
  try {
    const startMode = onboardingData?.preferences?.startMode;
    return startMode === 'create' || startMode === 'talk' ? startMode : null;
  } catch {
    return null;
  }
}

export function shouldTriggerGenerationEvent(messages, onboardingData) {
  const normalized = normalizeMessages(messages);
  const userCount = normalized.filter((m) => m.role === 'user').length;
  const lastUser = [...normalized].reverse().find((m) => m.role === 'user')?.content ?? '';
  const startMode = getOnboardingStartMode(onboardingData);

  // Explicit user intent takes priority
  if (/曲|作曲|生成イベント|アルバム|作って|つくって|生成して/.test(lastUser)) {
    return { shouldTrigger: true, reason: 'ユーザーが生成イベントを明示的に希望しました。' };
  }

  // Onboarding preference: if the user chose "create", suggest early.
  if (startMode === 'create' && userCount >= 1) {
    return { shouldTrigger: true, reason: 'プロフィールでは「創作から」。まずは1曲つくって流れを作ろう。' };
  }

  // Suggest more often: every ~6 user turns (deterministic cadence).
  // This makes "creating" feel like a core loop rather than a rare surprise.
  const cadence = 6;

  if (userCount < cadence) {
    const remaining = cadence - userCount;
    return {
      shouldTrigger: false,
      reason: `もう少しだけ素材を集めよう（生成イベントまで目安あと${remaining}回）。`,
    };
  }

  // Deterministic cadence: suggest on 6, 12, 18...
  const hit = userCount % cadence === 0;
  return hit
    ? { shouldTrigger: true, reason: 'ここまでの対話を素材に、象徴アルバムを作るタイミングです。' }
    : { shouldTrigger: false, reason: '少しだけ続けて、言葉の解像度を上げよう。' };
}

function extractOnboardingHints(onboardingData) {
  const prefs = onboardingData?.preferences;
  if (!prefs || typeof prefs !== 'object') return null;

  const parts = [];
  const startMode = prefs?.startMode;
  if (startMode === 'create') parts.push('創作から始めたい');
  if (startMode === 'talk') parts.push('会話から整えたい');

  const goal = prefs?.emotionalGoal;
  if (typeof goal === 'string' && goal.trim()) parts.push(`目標: ${goal.trim()}`);

  const recentEmotion = prefs?.recentMomentEmotion;
  if (typeof recentEmotion === 'string' && recentEmotion.trim()) parts.push(`最近: ${recentEmotion.trim()}`);

  const dailyEmotion = prefs?.dailyPatternEmotion;
  if (typeof dailyEmotion === 'string' && dailyEmotion.trim()) parts.push(`普段: ${dailyEmotion.trim()}`);

  return parts.length ? parts.join(' / ') : null;
}

function fallbackRespond(messages, onboardingData) {
  const normalized = normalizeMessages(messages);
  const lastUser = [...normalized].reverse().find((m) => m.role === 'user')?.content ?? '';
  const lastAssistant = [...normalized].reverse().find((m) => m.role === 'assistant')?.content ?? '';
  const hints = extractOnboardingHints(onboardingData);

  const recs = CURATED_RECS.slice(0, 3);

  const followups = [
    'その話、もう少しだけ続きが聞きたい。今いちばん強い感情はどれに近い？（落ち着き/不安/疲れ/高揚）',
    'その出来事って、体の感覚だとどんな感じ？（胸が重い/頭が冴える/眠い/そわそわ）',
    'もし音にすると、どっちが近い？（静かに包む/少し背中を押す/胸を締める/透明に整える）',
    '今の気分、どの場面で整えたい？（朝の準備/移動中/仕事前後/夜の一人時間）',
  ];

  // Avoid repeating the old fixed phrase if it appeared recently.
  const avoidSceneQuestion = /どの場面.*聴きたい/.test(lastAssistant);
  const candidates = avoidSceneQuestion ? followups.filter((q) => !q.includes('どの場面')) : followups;
  const idx = hashString(`${lastUser}|${lastAssistant.slice(0, 60)}|${hints ?? ''}`) % candidates.length;
  const picked = candidates[idx] ?? candidates[0];

  const opener = lastUser.trim()
    ? `うん、受け取った。${lastUser.slice(0, 60)}${lastUser.length > 60 ? '…' : ''}`
    : '今日はどんな感じで過ごしていましたか？短くても大丈夫です。';

  const hintLine = hints ? `\n（プロフィール: ${hints}）` : '';
  const prompt = lastUser.trim() ? `${opener}${hintLine}\n${picked}` : opener;

  return {
    assistant_message: prompt,
    recommendations: recs,
  };
}

function getProviderPreference() {
  return String(process.env.LLM_PROVIDER ?? '').toLowerCase();
}

function hasOllamaConfigured() {
  return !!(process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST || process.env.OLLAMA_MODEL);
}

function getRecentAssistantUtterances(normalizedMessages, limit = 6) {
  const xs = [];
  for (let i = normalizedMessages.length - 1; i >= 0 && xs.length < limit; i -= 1) {
    const m = normalizedMessages[i];
    if (m?.role === 'assistant' && typeof m.content === 'string' && m.content.trim()) {
      xs.push(m.content.trim().slice(0, 400));
    }
  }
  return xs;
}

function detectFacetSignals(text) {
  const t = String(text ?? '');
  const hasEmotion = /嬉しい|楽しい|安心|落ち着|穏やか|寂しい|孤独|不安|怖|緊張|イライラ|怒|悲し|しんど|疲れ|つら|虚無|焦|やる気|元気|憂鬱/.test(t);
  const hasBody = /胸|喉|胃|腹|頭|肩|首|背中|心臓|息|呼吸|眠|睡眠|だる|重い|痛|手足|冷え|熱い|震え|こわば/.test(t);
  const hasSituation = /仕事|学校|家族|友達|恋人|部活|SNS|面接|会議|締切|通勤|移動|朝|昼|夜|昨日|今日|今週|最近/.test(t);
  const hasDesired = /どうしたい|なりたい|したい|したくない|避けたい|整えたい|落ち着きたい|元気になりたい|眠りたい|集中したい|切り替えたい/.test(t);
  const hasRequest = /おすすめ|曲|聴きたい|提案|紹介|今すぐ|作って|つくって|生成/.test(t);
  return { hasEmotion, hasBody, hasSituation, hasDesired, hasRequest };
}

function pickNextQuestionFacet({ hasEmotion, hasBody, hasSituation, hasDesired, hasRequest }) {
  // If the user explicitly requests recommendations/generation, don't force a question.
  if (hasRequest) return null;
  // Ask the most helpful single question first.
  if (!hasSituation) return 'situation';
  if (!hasEmotion) return 'emotion';
  if (!hasBody) return 'body';
  if (!hasDesired) return 'desired';
  return null;
}

export async function respondAndRecommend({ messages, onboardingData }) {
  const normalized = normalizeMessages(messages);
  const lastUser = [...normalized].reverse().find((m) => m.role === 'user')?.content ?? '';
  const facetSignals = detectFacetSignals(lastUser);
  const preferredQuestionFacet = pickNextQuestionFacet(facetSignals);
  const recentAssistant = getRecentAssistantUtterances(normalized, 4);

  const providerPref = getProviderPreference();
  if (providerPref !== 'openai' && (providerPref === 'ollama' || (!openai && hasOllamaConfigured()))) {
    const system = `あなたは「レコメンド＋日常会話特化LLM」です。

目的:
- 普段はユーザーの話し相手になり、会話のキャッチボールを滑らかにしながら、自然に“いまの状態”を引き出す。
- その上で、会話の流れに自然に溶け込む形で“いま聴きたそうな曲”を提案する。
- 基本はクラシック中心。ただしユーザーの話題が夜・静けさ・余韻・都市的な孤独などの場合、ジャズを1曲混ぜても良い。

会話の型（重要）:
- assistant_message は基本的に「共感/要約（1〜2文）」→「次の一問（1つだけ）」→「必要なら短い提案」の順。
- 次の一問は“質問を1つだけ”。選択肢（例: A/B/C）を添えて答えやすくする。
- 同じ質問を繰り返さない（直近のアシスタント発話と被る質問は避ける）。
- ユーザーが『おすすめして』『曲を出して』等を明示した場合は、質問を無理に挟まず提案してよい。

制約:
- 出力は必ずJSONのみ。
- recommendations は 2〜4件。
- why は日本語で短く、会話に接続して説明。

出力JSON:
{
  "assistant_message": "string",
  "recommendations": [
    {"composer":"string","title":"string","era":"string","why":"string"}
  ]
}`;

    const userPayload = {
      onboardingData: onboardingData ?? null,
      messages: normalized.slice(-24),
      dialogueGuidance: {
        preferredQuestionFacet,
        facetSignals,
        avoidRepeating: recentAssistant,
      },
    };

    try {
      const parsed = await ollamaChatJson({
        system,
        user: JSON.stringify(userPayload),
        temperature: 0.7,
        maxTokens: 800,
        model: process.env.OLLAMA_MODEL_CHAT || process.env.OLLAMA_MODEL,
        debugTag: 'Chat',
      });

      return {
        assistant_message: String(parsed?.assistant_message ?? ''),
        recommendations: Array.isArray(parsed?.recommendations) ? parsed.recommendations.slice(0, 4) : [],
        provider: 'ollama',
      };
    } catch (error) {
      console.warn('[Chat] Ollama failed; using rule-based fallback.', {
        status: error?.status,
        message: error instanceof Error ? error.message : String(error),
      });
      return { ...fallbackRespond(normalized, onboardingData), provider: 'rule-based' };
    }
  }

  if (!openai) {
    return { ...fallbackRespond(normalized, onboardingData), provider: 'rule-based' };
  }

  const system = `あなたは「レコメンド＋日常会話特化LLM」です。

目的:
- 普段はユーザーの話し相手になり、会話のキャッチボールを滑らかにしながら、自然に“いまの状態”を引き出す。
- その上で、会話の流れに自然に溶け込む形で“いま聴きたそうな曲”を提案する。
- 基本はクラシック中心。ただしユーザーの話題が夜・静けさ・余韻・都市的な孤独などの場合、ジャズを1曲混ぜても良い。

会話の型（重要）:
- assistant_message は基本的に「共感/要約（1〜2文）」→「次の一問（1つだけ）」→「必要なら短い提案」の順。
- 次の一問は“質問を1つだけ”。選択肢（例: A/B/C）を添えて答えやすくする。
- 同じ質問を繰り返さない（直近のアシスタント発話と被る質問は避ける）。
- ユーザーが『おすすめして』『曲を出して』等を明示した場合は、質問を無理に挟まず提案してよい。

制約:
- 出力は必ずJSONのみ。
- recommendations は 2〜4件。
- why は日本語で短く、会話に接続して説明。

出力JSON:
{
  "assistant_message": "string",
  "recommendations": [
    {"composer":"string","title":"string","era":"string","why":"string"}
  ]
}`;

  const userPayload = {
    onboardingData: onboardingData ?? null,
    messages: normalized.slice(-24),
    dialogueGuidance: {
      preferredQuestionFacet,
      facetSignals,
      avoidRepeating: recentAssistant,
    },
  };

  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });
  } catch (error) {
    const tag = isLikelyOpenAIQuotaOrRateError(error) ? 'quota/rate' : 'unknown';
    console.warn(`[Chat] OpenAI failed (${tag}); using rule-based fallback.`, {
      status: error?.status,
      code: error?.code,
      message: error instanceof Error ? error.message : String(error),
    });
    return { ...fallbackRespond(normalized, onboardingData), provider: 'rule-based' };
  }

  const content = completion?.choices?.[0]?.message?.content;
  if (!content) {
    return { ...fallbackRespond(normalized, onboardingData), provider: 'rule-based' };
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { ...fallbackRespond(normalized, onboardingData), provider: 'rule-based' };
  }

  return {
    assistant_message: String(parsed.assistant_message ?? ''),
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 4) : [],
    provider: 'openai',
  };
}
