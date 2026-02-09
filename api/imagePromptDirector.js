/**
 * Art Director Image Prompt Layer
 *
 * Purpose:
 * - Convert a tag-like/base SDXL prompt into a coherent, art-directed natural language prompt
 *   optimized for "classical music jacket" aesthetics.
 * - Keep outputs safe and deterministic enough to run in production.
 */

import OpenAI from 'openai';
import { parseJsonLoose } from './lib/json.js';
import { trackUsage } from './lib/usage-tracker.js';
import { ollamaChatJson } from './lib/ollamaClient.js';

function envStr(name, fallback = '') {
  const v = String(process.env[name] ?? '').trim();
  return v || fallback;
}

function envBool(name, fallback = false) {
  const v = String(process.env[name] ?? '').trim().toLowerCase();
  if (!v) return fallback;
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function clampInt(n, min, max, fallback) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(x)));
}

function hasOpenAIConfigured() {
  return !!envStr('OPENAI_API_KEY');
}

function hasOllamaConfigured() {
  return !!(process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST || process.env.OLLAMA_MODEL);
}

function getProviderPreference() {
  return String(process.env.IMAGE_PROMPT_LLM_PROVIDER ?? process.env.LLM_PROVIDER ?? '').toLowerCase();
}

function getModel() {
  return envStr('OPENAI_MODEL_IMAGE_PROMPT', 'gpt-4o-mini');
}

function getTemperature() {
  const t = Number(envStr('IMAGE_PROMPT_LLM_TEMPERATURE', '0.7'));
  if (!Number.isFinite(t)) return 0.7;
  return Math.max(0, Math.min(1, t));
}

function baseNegative(extra) {
  const core = [
    'text',
    'typography',
    'letters',
    'words',
    'watermark',
    'logo',
    'signature',
    'frame with text',
    'poster layout',
    'modern UI',
    'screenshot',
    'low quality',
    'blurry',
    'jpeg artifacts',
    'oversaturated',
    'bad anatomy',
    'extra fingers',
  ];

  const add = String(extra || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return Array.from(new Set([...core, ...add])).join(', ');
}

function sanitizeText(s, maxLen) {
  const out = String(s || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
  return out.slice(0, maxLen);
}

function sanitizeOutput(obj, fallback) {
  const prompt = sanitizeText(obj?.prompt ?? fallback?.prompt ?? '', 1600);
  const negativePrompt = sanitizeText(obj?.negativePrompt ?? obj?.negative_prompt ?? fallback?.negativePrompt ?? '', 900);

  if (!prompt) return null;

  return {
    prompt,
    negativePrompt: baseNegative(negativePrompt),
    providerMeta: {
      composition: Array.isArray(obj?.composition) ? obj.composition.slice(0, 6).map((x) => sanitizeText(x, 80)).filter(Boolean) : undefined,
      lighting: Array.isArray(obj?.lighting) ? obj.lighting.slice(0, 6).map((x) => sanitizeText(x, 80)).filter(Boolean) : undefined,
      texture: Array.isArray(obj?.texture) ? obj.texture.slice(0, 6).map((x) => sanitizeText(x, 80)).filter(Boolean) : undefined,
      palette: Array.isArray(obj?.palette) ? obj.palette.slice(0, 8).map((x) => sanitizeText(x, 40)).filter(Boolean) : undefined,
    },
  };
}

function buildFallback({ basePrompt, negativePrompt, context }) {
  const vibe = [
    'classical music album cover',
    'museum-grade fine art',
    'minimal typography-free cover design',
    'rule of thirds composition, generous negative space',
    'chiaroscuro lighting, cinematic soft falloff',
    'oil paint texture, visible brushstrokes, canvas grain',
  ];

  if (context?.period) vibe.unshift(`art direction: ${context.period}`);
  if (context?.keyColorDirection) vibe.push(`dominant colors: ${context.keyColorDirection}`);
  if (context?.instrumentationDirection) vibe.push(`materials: ${context.instrumentationDirection}`);

  const prompt = [
    sanitizeText(basePrompt, 900),
    vibe.join(', '),
  ]
    .filter(Boolean)
    .join(', ');

  return {
    prompt,
    negativePrompt: baseNegative(negativePrompt),
    providerMeta: { provider: 'rule-based' },
  };
}

const SYSTEM_PROMPT = `You are an elite art director specializing in classical music album covers.

Goal:
- Rewrite the given base prompt into a coherent, art-directed SDXL prompt that produces a premium "classical jacket" image.
- Do NOT output any text/typography to be rendered on the cover.

Hard constraints:
- NO words, letters, logos, signatures, watermarks, or UI elements in the image.
- Favor elegant negative space, refined composition, and timeless fine-art aesthetics.
- Specify composition, lighting, texture/materials, and dominant color palette.
- Keep the subject metaphorical and album-cover-appropriate.

Output JSON ONLY (no markdown, no prose):
{
  "prompt": "string",
  "negativePrompt": "string",
  "composition": ["string"],
  "lighting": ["string"],
  "texture": ["string"],
  "palette": ["string"]
}`;

export async function artDirectImagePrompt({
  basePrompt,
  negativePrompt,
  context,
  timeoutMs = 12_000,
} = {}) {
  const safeBasePrompt = sanitizeText(basePrompt, 1200);
  const safeNeg = sanitizeText(negativePrompt, 500);

  const fallback = buildFallback({ basePrompt: safeBasePrompt, negativePrompt: safeNeg, context });

  if (!envBool('IMAGE_ART_DIRECTOR_ENABLED', false)) {
    return { ...fallback, provider: 'disabled' };
  }

  const prefer = getProviderPreference();
  const canOpenAI = hasOpenAIConfigured();
  const canOllama = hasOllamaConfigured();

  const useOllama = (prefer === 'ollama' && canOllama) || (!canOpenAI && canOllama);
  const useOpenAI = !useOllama && canOpenAI;

  if (!useOpenAI && !useOllama) {
    return { ...fallback, provider: 'unconfigured' };
  }

  const payload = {
    base_prompt: safeBasePrompt,
    base_negative: safeNeg,
    intent: {
      format: 'square album cover 1:1',
      genre: 'classical',
      period: context?.period || undefined,
      mood: context?.mood || undefined,
      valence: typeof context?.valence === 'number' ? context.valence : undefined,
      arousal: typeof context?.arousal === 'number' ? context.arousal : undefined,
      focus: typeof context?.focus === 'number' ? context.focus : undefined,
    },
    synesthesia: {
      key_color_direction: context?.keyColorDirection || undefined,
      instrumentation_direction: context?.instrumentationDirection || undefined,
      palette_hint: context?.paletteHint || undefined,
    },
    subject_hint: context?.subjectHint || undefined,
    motif_tags: Array.isArray(context?.motifTags) ? context.motifTags.slice(0, 12) : undefined,
    style_preset: context?.stylePreset || undefined,
  };

  const maxTokens = clampInt(envStr('IMAGE_PROMPT_LLM_MAX_TOKENS', '800'), 200, 1400, 800);

  try {
    if (useOllama) {
      const { json, raw } = await ollamaChatJson({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(payload) },
        ],
        timeoutMs,
        debugTag: 'ImagePromptDirector',
      });

      const parsed = json ?? parseJsonLoose(raw);
      const sanitized = sanitizeOutput(parsed, fallback);
      if (!sanitized) return { ...fallback, provider: 'ollama-fallback' };
      return { ...sanitized, provider: 'ollama' };
    }

    const openai = new OpenAI({ apiKey: envStr('OPENAI_API_KEY') });
    const completion = await openai.chat.completions.create({
      model: getModel(),
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(payload) },
      ],
      temperature: getTemperature(),
      response_format: { type: 'json_object' },
      max_tokens: maxTokens,
    });

    if (completion?.usage) {
      // Approx pricing: unknown across models; record tokens and zero-cost if you prefer.
      trackUsage('openai', 0, 'image-prompt-director', {
        model: getModel(),
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens,
      });
    }

    const content = completion?.choices?.[0]?.message?.content;
    const parsed = parseJsonLoose(content);
    const sanitized = sanitizeOutput(parsed, fallback);
    if (!sanitized) return { ...fallback, provider: 'openai-fallback' };
    return { ...sanitized, provider: 'openai' };
  } catch (e) {
    return { ...fallback, provider: 'error', error: e instanceof Error ? e.message : String(e) };
  }
}
