/**
 * LLM Service for generating intermediate representation
 * Prototype P2: OpenAI integration with fallback to rule-based generation
 */

import OpenAI from 'openai';
import { IntermediateRepresentationSchema } from './types.js';
import { trackUsage } from './lib/usage-tracker.js';
import { ollamaChatJson } from './lib/ollamaClient.js';

function hasOllamaConfigured() {
  return !!(process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST || process.env.OLLAMA_MODEL);
}

function getProviderPreference() {
  return String(process.env.LLM_PROVIDER ?? '').toLowerCase();
}

// System prompt for LLM
const SYSTEM_PROMPT = `あなたは音楽とアート療法の専門家です。セッションデータから感情と芸術的な中間表現を生成します。

出力は**必ず**以下のJSON形式で、それ以外は何も出力しないでください：

{
  "valence": <-1.0から+1.0の浮動小数点数。負=不快、正=快適>,
  "arousal": <0.0から1.0の浮動小数点数。低=穏やか、高=興奮>,
  "focus": <0.0から1.0の浮動小数点数。集中・注意レベル>,
  "motif_tags": [<3～5個の文字列。クラシック音楽や絵画の語彙>],
  "confidence": <0.0から1.0の浮動小数点数。分析の確信度>,
  "classical_profile": {
    "tempo": <テンポの文字列 (optional)>,
    "dynamics": <強弱の文字列 (optional)>,
    "harmony": <和声の文字列 (optional)>
  },
  "reasoning": <この分析結果を選んだ理由を簡潔に説明する文字列>
}

## motif_tagsの語彙例（クラシック音楽・絵画のテーマ）

### 光と影
- 光, 影, 薄明, 夕暮れ, 朝焼け, 黄金光, 月光

### 自然
- 水面, 霧, 雲, 森, 海, 山, 川, 風, 雨, 雪

### 感情
- 孤独, 荘厳, 静寂, 情熱, 憂鬱, 希望, 安らぎ, 緊張, 解放

### テクスチャ
- 流動, 凪, 嵐, 柔らか, 鋭い, 滑らか, 粗い

### 音楽的特性
- レガート, スタッカート, クレッシェンド, ディミヌエンド, ピアニッシモ, フォルティッシモ

## 例

入力: { mood: "穏やか", duration: 120 }
出力:
{
  "valence": 0.6,
  "arousal": 0.2,
  "focus": 0.7,
  "motif_tags": ["静寂", "水面", "薄明", "レガート"],
  "confidence": 0.85,
  "classical_profile": {
    "tempo": "Adagio",
    "dynamics": "piano",
    "harmony": "consonant"
  },
  "reasoning": "ユーザーの「穏やか」な気分から、快適で落ち着いた感情（高いvalence、低いarousal）を検出しました。静かな水面や薄明のモチーフで、内省的な雰囲気を表現します。"
}

入力: { mood: "不安", duration: 45, freeText: "今日は心配事が多い" }
出力:
{
  "valence": -0.4,
  "arousal": 0.6,
  "focus": 0.3,
  "motif_tags": ["緊張", "嵐", "暗雲", "不協和音"],
  "confidence": 0.75,
  "classical_profile": {
    "tempo": "Allegro agitato",
    "dynamics": "forte",
    "harmony": "dissonant"
  },
  "reasoning": "「不安」と「心配事」から、不快で活発な感情（低いvalence、高めのarousal）を分析しました。嵐や緊張のモチーフで、不安定な心理状態を音楽的に表現します。"
}`;

/**
 * Generate IR using OpenAI
 * @param {Object} input - Session input data
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<Object>} Intermediate representation
 */
export async function generateWithLLM(input, apiKey) {
  const openai = new OpenAI({ apiKey });

  // Build user message
  const userMessage = JSON.stringify({
    mood: input.mood,
    duration: input.duration,
    freeText: input.freeText,
    onboardingData: input.onboardingData,
  });

  console.log('[LLM] Calling OpenAI API for analysis');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  });

  // Track API usage
  if (completion.usage) {
    const inputCost = (completion.usage.prompt_tokens / 1_000_000) * 0.15;
    const outputCost = (completion.usage.completion_tokens / 1_000_000) * 0.60;
    const totalCost = inputCost + outputCost;
    
    trackUsage('openai', totalCost, 'gpt4o-mini-analysis', {
      model: 'gpt-4o-mini',
      promptTokens: completion.usage.prompt_tokens,
      completionTokens: completion.usage.completion_tokens,
      totalTokens: completion.usage.total_tokens
    });
  }

  const responseText = completion.choices[0]?.message?.content;
  
  if (!responseText) {
    throw new Error('Empty response from OpenAI');
  }

  console.log('[LLM] Raw response:', responseText);

  // Parse and validate JSON
  const parsed = JSON.parse(responseText);
  const validated = IntermediateRepresentationSchema.parse(parsed);

  console.log('[LLM] Successfully validated IR');

  return validated;
}

/**
 * Generate IR using Ollama (local)
 * @param {Object} input - Session input data
 * @returns {Promise<Object>} Intermediate representation
 */
export async function generateWithOllama(input) {
  // Build user message
  const userMessage = JSON.stringify({
    mood: input.mood,
    duration: input.duration,
    freeText: input.freeText,
    onboardingData: input.onboardingData,
  });

  console.log('[LLM] Calling Ollama for analysis');

  const parsed = await ollamaChatJson({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
    // num_predict is applied by the client; keep generous but bounded
    maxTokens: 900,
    model: process.env.OLLAMA_MODEL_ANALYSIS || process.env.OLLAMA_MODEL,
    debugTag: 'Analysis',
  });

  const validated = IntermediateRepresentationSchema.parse(parsed);
  console.log('[LLM] Successfully validated IR (Ollama)');
  return validated;
}

/**
 * Rule-based fallback generation
 * Used when LLM is unavailable or fails validation
 * @param {Object} input - Session input data
 * @returns {Object} Intermediate representation
 */
export function generateWithRules(input) {
  console.log('[RuleBased] Generating IR using rules');

  // Mood mappings
  const moodMappings = {
    '穏やか': {
      valence: 0.6,
      arousal: 0.2,
      tags: ['静寂', '水面', '凪', 'レガート'],
    },
    '嬉しい': {
      valence: 0.8,
      arousal: 0.7,
      tags: ['光', '希望', '朝焼け', 'アレグロ'],
    },
    '不安': {
      valence: -0.4,
      arousal: 0.6,
      tags: ['緊張', '暗雲', '嵐', '不協和音'],
    },
    '疲れ': {
      valence: -0.2,
      arousal: 0.1,
      tags: ['憂鬱', '影', '夕暮れ', 'アダージョ'],
    },
  };

  const mapping = moodMappings[input.mood] || moodMappings['穏やか'];

  // Duration to focus mapping (longer = higher focus, capped at 0.9)
  const focus = Math.min(0.9, 0.3 + (input.duration / 180) * 0.6);

  return {
    valence: mapping.valence,
    arousal: mapping.arousal,
    focus: parseFloat(focus.toFixed(2)),
    motif_tags: mapping.tags,
    confidence: 0.5, // Medium confidence for rule-based
    classical_profile: {
      tempo: mapping.arousal > 0.5 ? 'Allegro' : 'Adagio',
      dynamics: mapping.arousal > 0.5 ? 'forte' : 'piano',
      harmony: mapping.valence > 0 ? 'consonant' : 'dissonant',
    },
  };
}

/**
 * Generate IR with LLM and fallback to rules on failure
 * @param {Object} input - Session input data
 * @param {boolean} forceFallback - Force rule-based generation
 * @returns {Promise<Object>} IR and provider info
 */
export async function generateIR(input, forceFallback = false) {
  const apiKey = process.env.OPENAI_API_KEY;
  const disableLLM = process.env.DISABLE_LLM_ANALYSIS;
  const providerPref = getProviderPreference();
  const hasOllama = hasOllamaConfigured();

  // Check if we should force fallback
  if (forceFallback || disableLLM || !apiKey) {
    // If OpenAI isn't available but Ollama is, prefer Ollama unless explicitly forced to rules.
    if (!forceFallback && !disableLLM && hasOllama && providerPref !== 'rule-based') {
      try {
        const ir = await generateWithOllama(input);
        return { ir, provider: 'ollama' };
      } catch (error) {
        console.error('[Analysis] Ollama failed, falling back to rules:', error);
      }
    }

    console.log('[Analysis] Using rule-based fallback (forced/disabled/no OpenAI key)');
    return { ir: generateWithRules(input), provider: 'rule-based' };
  }

  // Provider selection:
  // - If LLM_PROVIDER=ollama and configured -> Ollama first
  // - Else default to OpenAI (if configured) with fallback
  const shouldPreferOllama = providerPref === 'ollama' || (providerPref !== 'openai' && hasOllama);

  if (shouldPreferOllama && hasOllama) {
    try {
      const ir = await generateWithOllama(input);
      return { ir, provider: 'ollama' };
    } catch (error) {
      console.error('[Analysis] Ollama failed; trying OpenAI next:', error);
    }
  }

  try {
    // Try LLM first
    const ir = await generateWithLLM(input, apiKey);
    return { ir, provider: 'openai' };
  } catch (error) {
    console.error('[Analysis] LLM failed, falling back to rules:', error);
    
    // Retry once with stricter prompt if validation failed
    if (error instanceof Error && error.message.includes('validation')) {
      console.log('[Analysis] Retrying LLM with stricter validation');
      try {
        const ir = await generateWithLLM(input, apiKey);
        return { ir, provider: 'openai' };
      } catch (retryError) {
        console.error('[Analysis] LLM retry failed:', retryError);
      }
    }
    
    // Final fallback to rules
    return {
      ir: generateWithRules(input),
      provider: 'rule-based',
    };
  }
}
