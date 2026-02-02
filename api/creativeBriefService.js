/**
 * Creative brief service
 * Turns conversation logs into a structured brief for:
 * - Music generation (classical + jazz available)
 * - Album art prompt (abstract / watercolor / oil painting)
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

function clamp01(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return 0.5;
  return Math.max(0, Math.min(1, x));
}

function clampValence(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return 0;
  return Math.max(-1, Math.min(1, x));
}

function pickStyleId(style) {
  const s = String(style ?? '').toLowerCase();
  if (s.includes('water')) return 'watercolor';
  if (s.includes('oil')) return 'oil-painting';
  if (s.includes('abstract')) return 'abstract-minimal';
  return 'oil-painting';
}

function fallbackBrief(messages) {
  const normalized = normalizeMessages(messages);
  const lastUser = [...normalized].reverse().find((m) => m.role === 'user')?.content ?? '';

  return {
    personality_axes: [
      { name: '静けさ', description: '一人の時間で回復する・内省が深い', weight: 0.6 },
      { name: '誠実さ', description: '感情を丁寧に扱い、言葉を選ぶ', weight: 0.4 },
    ],
    emotional_arc: {
      early: { valence: -0.1, arousal: 0.25, note: '静かに始まる' },
      middle: { valence: 0.1, arousal: 0.45, note: '少しだけ動く' },
      late: { valence: 0.2, arousal: 0.3, note: '余韻で落ち着く' },
    },
    theme: {
      title: '余白の中の灯り',
      keywords: ['光', '影', '余韻', '静寂', '水面'],
      summary: lastUser.slice(0, 160),
    },
    music: {
      genre_palette: ['classical', 'jazz'],
      primary_genre: 'classical',
      instrumentation: ['piano'],
      timbre_arc: {
        early: 'soft felt-piano, legato, sparse',
        middle: 'clearer attack, gentle motion',
        late: 'warm resonance, long reverb tail',
      },
    },
    image: {
      style: 'watercolor',
      ambiguity: 0.65,
      palette: ['ivory', 'pale gold', 'slate blue', 'smoke gray'],
      subjects: ['薄い月', '霧', '水面の反射'],
      composition: ['中心は空ける', '余白を多め', '筆致は柔らかい'],
    },
  };
}

function validateBrief(brief) {
  if (!brief || typeof brief !== 'object') throw new Error('Invalid brief');
  if (!Array.isArray(brief.personality_axes) || brief.personality_axes.length < 2) throw new Error('brief.personality_axes invalid');
  if (!brief.emotional_arc || !brief.emotional_arc.early || !brief.emotional_arc.middle || !brief.emotional_arc.late) throw new Error('brief.emotional_arc invalid');
  if (!brief.theme || !Array.isArray(brief.theme.keywords)) throw new Error('brief.theme invalid');
  if (!brief.music || !Array.isArray(brief.music.genre_palette)) throw new Error('brief.music invalid');

  // Must include classical + jazz availability
  const palette = brief.music.genre_palette.map((g) => String(g).toLowerCase());
  if (!palette.includes('classical') || !palette.includes('jazz')) {
    throw new Error('brief.music.genre_palette must include classical and jazz');
  }

  return true;
}

export function briefToGenerationInputs(brief) {
  const stylePreset = pickStyleId(brief?.image?.style);

  const early = brief.emotional_arc.early;
  const middle = brief.emotional_arc.middle;
  const late = brief.emotional_arc.late;

  // Aggregate to single IR-like values (used by existing pipeline)
  const valence = clampValence((clampValence(early.valence) + clampValence(middle.valence) + clampValence(late.valence)) / 3);
  const arousal = clamp01((clamp01(early.arousal) + clamp01(middle.arousal) + clamp01(late.arousal)) / 3);

  // More ambiguity => lower focus (more abstract)
  const ambiguity = clamp01(brief?.image?.ambiguity ?? 0.5);
  const focus = clamp01(1 - ambiguity);

  // Motif tags: keep 3-5, prefer Japanese keywords for existing translation rules
  const motifTagsRaw = Array.isArray(brief?.theme?.keywords) ? brief.theme.keywords : [];
  const motifTags = motifTagsRaw.map((t) => String(t)).filter(Boolean).slice(0, 5);
  while (motifTags.length < 3) motifTags.push('光');

  // Mood string for compatibility with existing endpoints
  const mood = valence < -0.2 ? '不安' : valence > 0.2 ? '嬉しい' : arousal < 0.35 ? '穏やか' : '疲れ';

  // Duration heuristic
  const duration = Math.round(75 + (arousal - 0.5) * 30);

  return {
    brief,
    analysisLike: {
      valence,
      arousal,
      focus,
      motif_tags: motifTags,
      confidence: 0.7,
    },
    image: {
      mood,
      duration,
      motifTags,
      stylePreset,
      valence,
      arousal,
      focus,
      subject: Array.isArray(brief?.image?.subjects) ? brief.image.subjects.join(', ') : undefined,
      palette: Array.isArray(brief?.image?.palette) ? brief.image.palette.join(', ') : undefined,
      ambiguity,
    },
    music: {
      valence,
      arousal,
      focus,
      motif_tags: motifTags,
      duration,
      genre_palette: brief.music.genre_palette,
      primary_genre: brief.music.primary_genre,
      instrumentation: brief.music.instrumentation,
      timbre_arc: brief.music.timbre_arc,
      theme: brief.theme,
      personality_axes: brief.personality_axes,
    },
  };
}

export async function generateCreativeBrief({ messages, onboardingData }) {
  const normalized = normalizeMessages(messages);

  const providerPref = String(process.env.LLM_PROVIDER ?? '').toLowerCase();
  const hasOllama = !!(process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST || process.env.OLLAMA_MODEL);

  if (providerPref !== 'openai' && (providerPref === 'ollama' || (!openai && hasOllama))) {
    const system = `あなたは作曲と絵画ディレクションの両方ができるクリエイティブディレクターです。

目的:
- 対話ログから「その人の軸（性格）」「感情の流れ（前中後）」「曲のテーマ」「曲の制約」「アルバム絵のプロンプト素材」を抽出して、JSONのcreative briefを作る。
- ユーザーは何も選択しない。対話が入力であり、あなたが精製して仕様へ落とす。

必須要件:
- music.genre_palette には必ず "classical" と "jazz" を含める（どちらも作れる状態）。
- personality_axes は2〜3件。
- emotional_arc は early/middle/late の3点で、valence(-1..1)とarousal(0..1)を持つ。
- image.style は abstract/watercolor/oil のいずれか。
- image.ambiguity は 0..1（1=かなり曖昧）。
- theme.keywords は3〜5件（日本語の短い単語を推奨: 光/影/霧/水面/風/記憶 など）。

出力はJSONのみ:
{
  "personality_axes": [{"name":"string","description":"string","weight":number}],
  "emotional_arc": {
    "early": {"valence": number, "arousal": number, "note":"string"},
    "middle": {"valence": number, "arousal": number, "note":"string"},
    "late": {"valence": number, "arousal": number, "note":"string"}
  },
  "theme": {"title":"string","keywords":["string"],"summary":"string"},
  "music": {
    "genre_palette": ["classical","jazz"],
    "primary_genre": "classical|jazz|hybrid",
    "instrumentation": ["string"],
    "timbre_arc": {"early":"string","middle":"string","late":"string"}
  },
  "image": {
    "style": "abstract|watercolor|oil",
    "ambiguity": number,
    "palette": ["string"],
    "subjects": ["string"],
    "composition": ["string"]
  }
}`;

    const userPayload = {
      onboardingData: onboardingData ?? null,
      messages: normalized.slice(-36),
    };

    try {
      const brief = await ollamaChatJson({
        system,
        user: JSON.stringify(userPayload),
        temperature: 0.6,
        maxTokens: 1500,
        debugTag: 'EventRefine',
      });

      // Normalize numeric ranges
      for (const key of ['early', 'middle', 'late']) {
        if (brief?.emotional_arc?.[key]) {
          brief.emotional_arc[key].valence = clampValence(brief.emotional_arc[key].valence);
          brief.emotional_arc[key].arousal = clamp01(brief.emotional_arc[key].arousal);
        }
      }
      if (brief?.image) {
        brief.image.ambiguity = clamp01(brief.image.ambiguity);
      }

      // Guarantee palette includes classical + jazz
      if (brief?.music?.genre_palette) {
        const palette = Array.isArray(brief.music.genre_palette) ? brief.music.genre_palette.map((g) => String(g).toLowerCase()) : [];
        if (!palette.includes('classical')) palette.unshift('classical');
        if (!palette.includes('jazz')) palette.push('jazz');
        brief.music.genre_palette = [...new Set(palette)];
      }

      validateBrief(brief);
      return { brief, provider: 'ollama' };
    } catch (error) {
      console.warn('[EventRefine] Ollama failed; using rule-based fallback.', {
        status: error?.status,
        message: error instanceof Error ? error.message : String(error),
      });
      const brief = fallbackBrief(normalized);
      validateBrief(brief);
      return { brief, provider: 'rule-based' };
    }
  }

  if (!openai) {
    const brief = fallbackBrief(normalized);
    validateBrief(brief);
    return { brief, provider: 'rule-based' };
  }

  const system = `あなたは作曲と絵画ディレクションの両方ができるクリエイティブディレクターです。

目的:
- 対話ログから「その人の軸（性格）」「感情の流れ（前中後）」「曲のテーマ」「曲の制約」「アルバム絵のプロンプト素材」を抽出して、JSONのcreative briefを作る。
- ユーザーは何も選択しない。対話が入力であり、あなたが精製して仕様へ落とす。

必須要件:
- music.genre_palette には必ず "classical" と "jazz" を含める（どちらも作れる状態）。
- personality_axes は2〜3件。
- emotional_arc は early/middle/late の3点で、valence(-1..1)とarousal(0..1)を持つ。
- image.style は abstract/watercolor/oil のいずれか。
- image.ambiguity は 0..1（1=かなり曖昧）。
- theme.keywords は3〜5件（日本語の短い単語を推奨: 光/影/霧/水面/風/記憶 など）。

出力はJSONのみ:
{
  "personality_axes": [{"name":"string","description":"string","weight":number}],
  "emotional_arc": {
    "early": {"valence": number, "arousal": number, "note":"string"},
    "middle": {"valence": number, "arousal": number, "note":"string"},
    "late": {"valence": number, "arousal": number, "note":"string"}
  },
  "theme": {"title":"string","keywords":["string"],"summary":"string"},
  "music": {
    "genre_palette": ["classical","jazz"],
    "primary_genre": "classical|jazz|hybrid",
    "instrumentation": ["string"],
    "timbre_arc": {"early":"string","middle":"string","late":"string"}
  },
  "image": {
    "style": "abstract|watercolor|oil",
    "ambiguity": number,
    "palette": ["string"],
    "subjects": ["string"],
    "composition": ["string"]
  }
}`;

  const userPayload = {
    onboardingData: onboardingData ?? null,
    messages: normalized.slice(-36),
  };

  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
      temperature: 0.6,
      response_format: { type: 'json_object' },
      max_tokens: 1500,
    });
  } catch (error) {
    const tag = isLikelyOpenAIQuotaOrRateError(error) ? 'quota/rate' : 'unknown';
    console.warn(`[EventRefine] OpenAI failed (${tag}); using rule-based fallback.`, {
      status: error?.status,
      code: error?.code,
      message: error instanceof Error ? error.message : String(error),
    });
    const brief = fallbackBrief(normalized);
    validateBrief(brief);
    return { brief, provider: 'rule-based' };
  }

  const content = completion?.choices?.[0]?.message?.content;
  if (!content) {
    const brief = fallbackBrief(normalized);
    validateBrief(brief);
    return { brief, provider: 'rule-based' };
  }

  let brief;
  try {
    brief = JSON.parse(content);
  } catch {
    brief = fallbackBrief(normalized);
  }

  // Normalize numeric ranges
  for (const key of ['early', 'middle', 'late']) {
    if (brief?.emotional_arc?.[key]) {
      brief.emotional_arc[key].valence = clampValence(brief.emotional_arc[key].valence);
      brief.emotional_arc[key].arousal = clamp01(brief.emotional_arc[key].arousal);
    }
  }
  if (brief?.image) {
    brief.image.ambiguity = clamp01(brief.image.ambiguity);
  }

  // Guarantee palette includes classical + jazz
  if (brief?.music?.genre_palette) {
    const palette = Array.isArray(brief.music.genre_palette) ? brief.music.genre_palette.map((g) => String(g).toLowerCase()) : [];
    if (!palette.includes('classical')) palette.unshift('classical');
    if (!palette.includes('jazz')) palette.push('jazz');
    brief.music.genre_palette = [...new Set(palette)];
  }

  validateBrief(brief);
  return { brief, provider: 'openai' };
}
