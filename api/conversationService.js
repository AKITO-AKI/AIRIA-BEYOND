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

export function shouldTriggerGenerationEvent(messages) {
  const normalized = normalizeMessages(messages);
  const userCount = normalized.filter((m) => m.role === 'user').length;
  const lastUser = [...normalized].reverse().find((m) => m.role === 'user')?.content ?? '';

  // Explicit user intent takes priority
  if (/曲|作曲|生成イベント|アルバム|作って|つくって|生成して/.test(lastUser)) {
    return { shouldTrigger: true, reason: 'ユーザーが生成イベントを明示的に希望しました。' };
  }

  // Suggest event roughly once per ~20 user turns.
  // Keep deterministic behavior (stable demos) but with a clear cadence.
  if (userCount < 20) {
    const remaining = 20 - userCount;
    return {
      shouldTrigger: false,
      reason: `もう少し会話を続けよう（生成イベントの提案まで目安あと${remaining}回）。`,
    };
  }

  const dayKey = new Date().toISOString().slice(0, 10);
  const seed = hashString(`${dayKey}|${userCount}|${lastUser.slice(0, 80)}`);
  const hit = seed % 20 === 0; // ~5%

  return hit
    ? { shouldTrigger: true, reason: 'ここまでの対話を素材に、象徴アルバムを作るタイミングです。' }
    : { shouldTrigger: false, reason: 'もう少しだけ会話を続けて、素材を増やします。' };
}

function fallbackRespond(messages) {
  const normalized = normalizeMessages(messages);
  const lastUser = [...normalized].reverse().find((m) => m.role === 'user')?.content ?? '';

  const recs = CURATED_RECS.slice(0, 3);
  const prompt = lastUser.trim()
    ? `今の話の中心は「${lastUser.slice(0, 40)}…」ですね。もう少しだけ具体にすると、どの場面（朝/夜・移動中/家・一人/誰かと）で聴きたいですか？`
    : '今日はどんな感じで過ごしていましたか？短くても大丈夫です。';

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

export async function respondAndRecommend({ messages, onboardingData }) {
  const normalized = normalizeMessages(messages);

  const providerPref = getProviderPreference();
  if (providerPref !== 'openai' && (providerPref === 'ollama' || (!openai && hasOllamaConfigured()))) {
    const system = `あなたは「レコメンド＋日常会話特化LLM」です。

目的:
- 普段はユーザーの話し相手になり、会話の流れに自然に溶け込む形で“いま聴きたそうな曲”を提案する。
- 基本はクラシック中心。ただしユーザーの話題が夜・静けさ・余韻・都市的な孤独などの場合、ジャズを1曲混ぜても良い。

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
      return { ...fallbackRespond(normalized), provider: 'rule-based' };
    }
  }

  if (!openai) {
    return { ...fallbackRespond(normalized), provider: 'rule-based' };
  }

  const system = `あなたは「レコメンド＋日常会話特化LLM」です。

目的:
- 普段はユーザーの話し相手になり、会話の流れに自然に溶け込む形で“いま聴きたそうな曲”を提案する。
- 基本はクラシック中心。ただしユーザーの話題が夜・静けさ・余韻・都市的な孤独などの場合、ジャズを1曲混ぜても良い。

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
    return { ...fallbackRespond(normalized), provider: 'rule-based' };
  }

  const content = completion?.choices?.[0]?.message?.content;
  if (!content) {
    return { ...fallbackRespond(normalized), provider: 'rule-based' };
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { ...fallbackRespond(normalized), provider: 'rule-based' };
  }

  return {
    assistant_message: String(parsed.assistant_message ?? ''),
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 4) : [],
    provider: 'openai',
  };
}
