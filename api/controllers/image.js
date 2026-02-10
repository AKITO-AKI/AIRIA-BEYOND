// This file has been removed as ComfyUI is no longer used and Hugging Face is now the only image provider.
/**
 * POST /api/image/generate
 *
 * Generate an image using ComfyUI.
 * Returns a job ID immediately, actual generation happens async.
 */
import { createJob, updateJob, incrementRetryCount, getJob } from '../jobStore.js';
import { checkRateLimit, checkConcurrency, releaseJob } from '../lib/rate-limit.js';
import { getClientIdentifier } from '../lib/client-id.js';
import { buildPrompt } from '../promptBuilder.js';
import { artDirectImagePrompt } from '../imagePromptDirector.js';
import { trackUsage } from '../lib/usage-tracker.js';
import { debugAiConsole, debugAiLog } from '../lib/aiDebug.js';
import {
  buildBasicComfyWorkflow,
  comfyuiGetObjectInfo,
  comfyuiUploadImageFromUrl,
  comfyuiSubmitPrompt,
  comfyuiWaitForImage,
  comfyuiFetchImageBytes,
  bytesToDataUrl,
} from '../lib/comfyuiClient.js';

// Timeout for image generation (120 seconds)
const GENERATION_TIMEOUT_MS = 120 * 1000;

// Retry configuration
const INITIAL_RETRY_DELAY_MS = 2000; // 2 seconds
const MAX_RETRY_DELAY_MS = 30000; // 30 seconds

// Error codes
const ERROR_CODES = {
  TIMEOUT: 'TIMEOUT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  API_ERROR: 'API_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MAX_RETRIES_EXCEEDED: 'MAX_RETRIES_EXCEEDED',
  FALLBACK_PLACEHOLDER: 'FALLBACK_PLACEHOLDER',
};

async function quickProbe(url, timeoutMs = 800) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    return { ok: true, status: resp.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(t);
  }
}

function toNumberOrUndefined(value) {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function toStringOrUndefined(value) {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value !== 'string') return undefined;
  const s = value.trim();
  return s ? s : undefined;
}

function toShortStringOrUndefined(value, maxLen = 80) {
  const s = toStringOrUndefined(value);
  if (!s) return undefined;
  return s.slice(0, maxLen);
}

function normalizeInstrumentation(raw) {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v).trim()).filter(Boolean).slice(0, 12);
  }
  if (typeof raw === 'string') {
    return raw.split(',').map((v) => v.trim()).filter(Boolean).slice(0, 12);
  }
  return undefined;
}

function normalizeMotifTags(raw) {
  let tags = [];
  if (Array.isArray(raw)) tags = raw;
  else if (typeof raw === 'string') tags = raw.split(',');

  return tags
    .map((t) => String(t).trim())
    .filter(Boolean)
    .slice(0, 24);
}

function escapeXml(input) {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function createPlaceholderCoverDataUrl({ title, mood, seed, note }) {
  const safeTitle = String(title ?? '').trim() || 'AIRIA';
  const safeMood = String(mood ?? '').trim() || 'mood';
  const s = String(seed ?? '0');
  const hue =
    Math.abs(
      s
        .split('')
        .reduce((acc, ch) => acc * 33 + ch.charCodeAt(0), 7)
    ) % 360;

  const subtitle = note ? String(note).slice(0, 60) : 'Placeholder cover';

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
    <text x="72" y="794" font-size="54" font-weight="720" letter-spacing="0.02em">${escapeXml(safeTitle).slice(0, 28)}</text>
    <text x="72" y="858" font-size="28" font-weight="600" opacity="0.9">${escapeXml(safeMood).slice(0, 24)}</text>
    <text x="72" y="916" font-size="18" opacity="0.8">${escapeXml(subtitle)}</text>
  </g>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function resolveImageProvider(requestedProvider) {
  const pref = String(requestedProvider ?? process.env.IMAGE_PROVIDER ?? '').toLowerCase();

  // ComfyUI-only mode: ignore Replicate even if requested.
  if (pref === 'placeholder') return 'placeholder';
  if (pref === 'comfyui' || pref === 'comfy') return 'comfyui';
  if (pref === 'replicate') return 'comfyui';
  if (pref === 'auto') return 'comfyui';

  return 'comfyui';
}

async function executeComfyUiGeneration(jobId, prompt, negativePrompt, seed, { styleReferenceImageUrl } = {}) {
  // Quality-biased defaults (env can still override).
  const steps = Number(process.env.COMFYUI_STEPS) || 30;
  const cfg = Number(process.env.COMFYUI_CFG) || 7.0;
  const width = Number(process.env.COMFYUI_WIDTH) || 1024;
  const height = Number(process.env.COMFYUI_HEIGHT) || 1024;
  const sampler_name = process.env.COMFYUI_SAMPLER || 'dpmpp_2m';
  const scheduler = process.env.COMFYUI_SCHEDULER || 'karras';
  const checkpoint = process.env.COMFYUI_CHECKPOINT;

  let objectInfo = null;
  try {
    objectInfo = await comfyuiGetObjectInfo({ ttlMs: 60_000 });
  } catch (e) {
    // Optional: workflow still runs in basic mode even if probing fails.
    debugAiConsole(`ComfyUI_${jobId}.object_info_failed`, {
      message: e instanceof Error ? e.message : String(e),
    });
  }

  let referenceImageName;
  const refUrl = String(styleReferenceImageUrl || process.env.COMFYUI_IPADAPTER_REFERENCE_URL || '').trim();
  if (refUrl) {
    try {
      const uploaded = await comfyuiUploadImageFromUrl({ imageUrl: refUrl, subfolder: 'airia' });
      referenceImageName = uploaded?.name || uploaded?.filename || uploaded?.image || undefined;
      debugAiConsole(`ComfyUI_${jobId}.reference_uploaded`, { refUrl, uploaded });
    } catch (e) {
      debugAiConsole(`ComfyUI_${jobId}.reference_upload_failed`, {
        refUrl,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  updateJob(jobId, {
    status: 'running',
    startedAt: new Date().toISOString(),
  });

  const workflow = buildBasicComfyWorkflow({
    prompt,
    negativePrompt,
    seed,
    width,
    height,
    steps,
    cfg,
    sampler_name,
    scheduler,
    ckpt_name: checkpoint,
    filenamePrefix: `AIRIA_${jobId}`,
    objectInfo,
    referenceImageName,
  });

  const promptId = await comfyuiSubmitPrompt({
    workflow,
    clientId: `airia_${jobId}`,
    debugTag: `ComfyUI_${jobId}`,
  });

  const { ref } = await comfyuiWaitForImage({
    promptId,
    debugTag: `ComfyUI_${jobId}`,
  });

  const { bytes, contentType } = await comfyuiFetchImageBytes(ref);
  const resultUrl = bytesToDataUrl(bytes, contentType);

  // Local usage, no paid cost.
  trackUsage('comfyui', 0, 'local-image-generation', {
    jobId,
    promptId,
    checkpoint: checkpoint || 'unknown',
    width,
    height,
    steps,
    cfg,
  });

  return { resultUrl, promptId };
}



/**
 * Check if error is transient and should be retried
 * @param {any} error - Error object
 * @returns {boolean} True if error is transient
 */
function isTransientError(error) {
  const errorMessage = error?.message || '';
  const errorStatus = error?.response?.status || error?.status;
  
  // Network errors
  if (errorMessage.includes('ECONNREFUSED') || 
      errorMessage.includes('ETIMEDOUT') ||
      errorMessage.includes('ENOTFOUND') ||
      errorMessage.includes('network')) {
    return true;
  }
  
  // Rate limit errors (429)
  if (errorStatus === 429) {
    return true;
  }
  
  return false;
}

/**
 * Calculate exponential backoff delay
 * @param {number} retryCount - Current retry count
 * @returns {number} Delay in milliseconds
 */
function getRetryDelay(retryCount) {
  const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
  return Math.min(delay, MAX_RETRY_DELAY_MS);
}

/**
 * Run an async operation with timeout
 * @param {Promise} promise - Promise to run
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} jobId - Job ID for logging
 * @returns {Promise} Result with timeout
 */
async function runWithTimeout(promise, timeoutMs, jobId) {
  let timeoutHandle;
  
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Generation timeout after ${timeoutMs / 1000}s`));
    }, timeoutMs);
  });
  
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    if (timeoutHandle) clearTimeout(timeoutHandle);
    return result;
  } catch (error) {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    throw error;
  }
}

/**
 * Generate image handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function generateImage(req, res) {
  // Only accept POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const providerRequestedRaw = req.body?.provider;
  let provider = resolveImageProvider(providerRequestedRaw);
  const providerWarnings = [];

  if (String(providerRequestedRaw || '').toLowerCase() === 'replicate') {
    providerWarnings.push('Replicate is disabled (ComfyUI-only deployment); using ComfyUI instead.');
  }

  // Get client identifier for rate limiting
  const clientId = getClientIdentifier(req);

  // Minimal input extraction for emergency placeholder responses (rate-limit/concurrency, etc.)
  const emergencyMood = typeof req.body?.mood === 'string' ? req.body.mood.trim() : '';
  const emergencyDuration = Math.max(1, Math.min(600, Number(req.body?.duration ?? 60) || 60));
  const emergencySeed = toNumberOrUndefined(req.body?.seed);

  // Check rate limit
  if (!checkRateLimit(clientId)) {
    const job = createJob({
      provider: 'placeholder',
      model: 'placeholder:svg',
      input: {
        mood: emergencyMood || 'mood',
        duration: emergencyDuration,
        seed: emergencySeed,
      },
      maxRetries: 0,
    });

    const resultUrl = createPlaceholderCoverDataUrl({
      title: 'AIRIA',
      mood: emergencyMood || 'mood',
      seed: emergencySeed ?? job.id,
      note: 'Rate limited — placeholder used',
    });

    updateJob(job.id, {
      status: 'succeeded',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      result: resultUrl,
      resultUrl,
      warnings: ['Rate limited; returned placeholder cover to keep the experience moving.'],
      fallbackUsed: true,
      effectiveProvider: 'placeholder',
      fallbackReason: ERROR_CODES.RATE_LIMIT,
    });

    return res.status(202).json({
      jobId: job.id,
      status: 'queued',
      message: 'Image generation started',
    });
  }

  // Check concurrency limit
  if (!checkConcurrency(clientId)) {
    const job = createJob({
      provider: 'placeholder',
      model: 'placeholder:svg',
      input: {
        mood: emergencyMood || 'mood',
        duration: emergencyDuration,
        seed: emergencySeed,
      },
      maxRetries: 0,
    });

    const resultUrl = createPlaceholderCoverDataUrl({
      title: 'AIRIA',
      mood: emergencyMood || 'mood',
      seed: emergencySeed ?? job.id,
      note: 'Too many concurrent jobs — placeholder used',
    });

    updateJob(job.id, {
      status: 'succeeded',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      result: resultUrl,
      resultUrl,
      warnings: ['Too many concurrent jobs; returned placeholder cover immediately.'],
      fallbackUsed: true,
      effectiveProvider: 'placeholder',
      fallbackReason: 'CONCURRENCY',
    });

    return res.status(202).json({
      jobId: job.id,
      status: 'queued',
      message: 'Image generation started',
    });
  }

  try {
    // Parse + sanitize request body
    const rawMood = req.body?.mood;
    let mood = typeof rawMood === 'string' ? rawMood.trim() : '';
    const duration = Math.max(1, Math.min(600, Number(req.body?.duration ?? 60) || 60));
    const motifTags = normalizeMotifTags(req.body?.motifTags);
    const stylePreset = typeof req.body?.stylePreset === 'string' ? req.body.stylePreset : undefined;
    const seed = toNumberOrUndefined(req.body?.seed);
    const valence = toNumberOrUndefined(req.body?.valence);
    const arousal = toNumberOrUndefined(req.body?.arousal);
    const focus = toNumberOrUndefined(req.body?.focus);
    const confidence = toNumberOrUndefined(req.body?.confidence);
    const ambiguity = toNumberOrUndefined(req.body?.ambiguity);
    const density = toNumberOrUndefined(req.body?.density);
    const subject = toStringOrUndefined(req.body?.subject);
    const palette = toStringOrUndefined(req.body?.palette);
    const period = toStringOrUndefined(req.body?.period);
    const instrumentation = normalizeInstrumentation(req.body?.instrumentation);
    const key = toShortStringOrUndefined(req.body?.key);
    const styleReferenceImageUrl = toStringOrUndefined(req.body?.styleReferenceImageUrl);

    // If mood is missing, do not hard-fail. Use placeholder so the user can still proceed.
    if (!mood) {
      providerWarnings.push('mood is missing; using placeholder cover to keep the flow running.');
      mood = 'mood';
      provider = 'placeholder';
    }

    // If ComfyUI is selected but unreachable, fall back immediately.
    if (provider === 'comfyui') {
      const base = String(process.env.COMFYUI_BASE_URL || 'http://127.0.0.1:8188').replace(/\/$/, '');
      const probe = await quickProbe(base, 900);
      if (!probe.ok) {
        providerWarnings.push(`ComfyUI not reachable (${probe.error || 'unknown'}); falling back to placeholder cover.`);
        provider = 'placeholder';
      }
    }

    // Build prompt from IR (P3 Enhanced) — never hard-fail due to malformed inputs.
    let prompt;
    let negativePrompt;
    try {
      const out = buildPrompt({
        mood,
        duration,
        motifTags,
        stylePreset,
        valence,
        arousal,
        focus,
        ambiguity,
        density,
        subject,
        palette,
        key,
        period,
        instrumentation,
      });
      prompt = out.prompt;
      negativePrompt = out.negativePrompt;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      providerWarnings.push(`Prompt builder failed; using safe fallback prompt. (${msg.slice(0, 120)})`);
      prompt = [
        `artistic album cover`,
        `mood: ${mood}`,
        motifTags.length ? `motifs: ${motifTags.join(', ')}` : null,
      ]
        .filter(Boolean)
        .join(', ');
      negativePrompt = 'text, watermark, logo, low quality, blurry';
    }

    // Optional Art Director layer: rewrite prompt into a cohesive, classical-jacket-focused description.
    // Safe defaults: disabled unless explicitly enabled via env.
    try {
      const directed = await artDirectImagePrompt({
        basePrompt: prompt,
        negativePrompt,
        context: {
          mood,
          valence,
          arousal,
          focus,
          period,
          stylePreset,
          motifTags,
          subjectHint: subject,
          paletteHint: palette,
          key,
          // These two are already embedded in base prompt, but passing them gives the director explicit levers.
          // (They are best-effort hints; if missing, the director still works.)
          keyColorDirection: undefined,
          instrumentationDirection: Array.isArray(instrumentation) ? instrumentation.join(', ') : undefined,
        },
      });

      if (directed?.prompt) {
        prompt = directed.prompt;
        negativePrompt = directed.negativePrompt || negativePrompt;
        providerWarnings.push(`ArtDirectorPrompt: ${directed.provider}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      providerWarnings.push(`ArtDirectorPrompt failed (fallback used): ${msg.slice(0, 120)}`);
    }

    debugAiConsole('image.generate.request', {
      provider,
      mood,
      duration,
      stylePreset,
      motifTagsCount: Array.isArray(motifTags) ? motifTags.length : 0,
    });

    // Create job with full input data
    const job = createJob({
      provider,
      model:
        provider === 'comfyui'
          ? `comfyui:${process.env.COMFYUI_CHECKPOINT || 'workflow'}`
          : 'placeholder:svg',
      input: {
        mood,
        duration,
        motifTags,
        stylePreset,
        seed,
        valence,
        arousal,
        focus,
        confidence,
        ambiguity,
        density,
        subject,
        palette,
        key,
        styleReferenceImageUrl,
        period,
        instrumentation,
        providerRequested: providerRequestedRaw,
        providerResolved: provider,
      },
      inputSummary: {
        mood,
        duration,
        stylePreset,
        seed,
        density,
      },
    });

    if (providerWarnings.length) {
      updateJob(job.id, {
        warnings: providerWarnings,
      });
    }

    debugAiLog('image_generate', {
      jobId: job.id,
      provider,
      model: job.model,
      prompt,
      negativePrompt,
      seed,
      input: job.input,
      inputSummary: job.inputSummary,
    });

    // Start async generation with retry logic
    (async () => {
      try {
        const finalSeed = seed ?? Math.floor(Math.random() * 1000000);
        let resultUrl;
        let extraMeta;

        try {
          if (provider === 'comfyui') {
            const out = await runWithTimeout(
              executeComfyUiGeneration(job.id, prompt, negativePrompt, finalSeed, { styleReferenceImageUrl }),
              GENERATION_TIMEOUT_MS,
              job.id
            );
            resultUrl = out.resultUrl;
            extraMeta = { comfyuiPromptId: out.promptId };
          } else {
            // placeholder provider
            resultUrl = createPlaceholderCoverDataUrl({
              title: mood,
              mood,
              seed: finalSeed,
              note: 'Image provider unavailable — placeholder used',
            });
            extraMeta = {
              fallbackUsed: true,
              effectiveProvider: 'placeholder',
              fallbackReason: 'provider_unavailable',
            };
          }
        } catch (error) {
          // Defense-in-depth: if image generation fails, still succeed with a placeholder.
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[Generation] Job ${job.id} image provider failed, using placeholder:`, errorMessage);

          const placeholder = createPlaceholderCoverDataUrl({
            title: mood,
            mood,
            seed: finalSeed,
            note: 'Image generation failed — placeholder used',
          });

          resultUrl = placeholder;
          extraMeta = {
            fallbackUsed: true,
            effectiveProvider: 'placeholder',
            fallbackReason: 'generation_failed',
            generationError: errorMessage,
            errorCode: getJob(job.id)?.errorCode || ERROR_CODES.FALLBACK_PLACEHOLDER,
          };
          updateJob(job.id, {
            warnings: [
              ...(getJob(job.id)?.warnings || []),
              `Image generation failed; placeholder used. (${errorMessage.slice(0, 120)})`,
            ],
          });
        }

        // Update job as succeeded
        updateJob(job.id, {
          status: 'succeeded',
          finishedAt: new Date().toISOString(),
          result: resultUrl,
          resultUrl: resultUrl,
          ...(extraMeta ? extraMeta : {}),
        });
        
        console.log(`[Generation] Job ${job.id} completed successfully`);
      } catch (error) {
        console.error(`[Generation] Job ${job.id} failed permanently:`, error);
        
        const jobData = getJob(job.id);
        const errorCode = jobData?.errorCode || ERROR_CODES.API_ERROR;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        updateJob(job.id, {
          status: 'failed',
          finishedAt: new Date().toISOString(),
          errorCode,
          errorMessage,
          error: errorMessage,
        });
      } finally {
        // Release concurrency slot
        releaseJob(clientId);
      }
    })();

    // Return job ID immediately
    return res.status(202).json({
      jobId: job.id,
      status: 'queued',
      message: 'Image generation started',
      provider,
    });
  } catch (error) {
    console.error('Request handling error:', error);
    releaseJob(clientId);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
