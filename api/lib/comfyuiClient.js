import { debugAiConsole, debugAiLog } from './aiDebug.js';

function getBaseUrl() {
  const raw = process.env.COMFYUI_BASE_URL || 'http://127.0.0.1:8188';
  return String(raw).replace(/\/$/, '');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isAbortError(err) {
  return err instanceof DOMException ? err.name === 'AbortError' : false;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 20_000) {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    return resp;
  } catch (err) {
    if (isAbortError(err)) {
      const e = new Error(`ComfyUI request timeout after ${Math.round(timeoutMs / 1000)}s: ${url}`);
      e.code = 'COMFYUI_HTTP_TIMEOUT';
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export function buildBasicComfyWorkflow({
  prompt,
  negativePrompt,
  seed,
  width = 1024,
  height = 1024,
  steps = 25,
  cfg = 7.5,
  sampler_name = 'euler',
  scheduler = 'normal',
  ckpt_name,
  filenamePrefix = 'AIRIA',
}) {
  const checkpoint = ckpt_name || process.env.COMFYUI_CHECKPOINT || 'sdxl_base_1.0.safetensors';

  // This workflow only uses built-in ComfyUI nodes.
  // NOTE: ckpt_name must exist in ComfyUI's models/checkpoints.
  return {
    '3': {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: checkpoint },
    },
    '4': {
      class_type: 'CLIPTextEncode',
      inputs: { text: String(prompt || ''), clip: ['3', 1] },
    },
    '5': {
      class_type: 'CLIPTextEncode',
      inputs: { text: String(negativePrompt || ''), clip: ['3', 1] },
    },
    '6': {
      class_type: 'EmptyLatentImage',
      inputs: { width, height, batch_size: 1 },
    },
    '7': {
      class_type: 'KSampler',
      inputs: {
        seed: Number(seed) || 0,
        steps,
        cfg,
        sampler_name,
        scheduler,
        denoise: 1,
        model: ['3', 0],
        positive: ['4', 0],
        negative: ['5', 0],
        latent_image: ['6', 0],
      },
    },
    '8': {
      class_type: 'VAEDecode',
      inputs: { samples: ['7', 0], vae: ['3', 2] },
    },
    '9': {
      class_type: 'SaveImage',
      inputs: { filename_prefix: filenamePrefix, images: ['8', 0] },
    },
  };
}

export async function comfyuiSubmitPrompt({ workflow, clientId, debugTag }) {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/prompt`;

  const body = {
    prompt: workflow,
    client_id: clientId || 'airia',
  };

  debugAiConsole(`${debugTag || 'ComfyUI'}.prompt`, { url, clientId: body.client_id });
  debugAiLog(`${debugTag || 'ComfyUI'}_prompt`, { url, body });

  const resp = await fetchWithTimeout(
    url,
    {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    },
    Number(process.env.COMFYUI_HTTP_TIMEOUT_MS) || 20_000
  );

  const text = await resp.text();
  if (!resp.ok) {
    const err = new Error(`ComfyUI /prompt HTTP ${resp.status}: ${text.slice(0, 200)}`);
    err.status = resp.status;
    throw err;
  }

  const json = JSON.parse(text);
  const promptId = json?.prompt_id;
  if (!promptId) throw new Error('ComfyUI did not return prompt_id');
  return promptId;
}

export async function comfyuiGetHistory(promptId) {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/history/${encodeURIComponent(promptId)}`;

  const resp = await fetchWithTimeout(url, {}, Number(process.env.COMFYUI_HTTP_TIMEOUT_MS) || 12_000);
  const text = await resp.text();
  if (!resp.ok) {
    const err = new Error(`ComfyUI /history HTTP ${resp.status}: ${text.slice(0, 200)}`);
    err.status = resp.status;
    throw err;
  }

  return JSON.parse(text);
}

export function comfyuiExtractFirstImageRef(history, promptId) {
  const root = history?.[promptId];
  const outputs = root?.outputs;
  if (!outputs || typeof outputs !== 'object') return null;

  for (const node of Object.values(outputs)) {
    const images = node?.images;
    if (Array.isArray(images) && images.length > 0) {
      const img = images[0];
      if (img?.filename) {
        return {
          filename: img.filename,
          subfolder: img.subfolder || '',
          type: img.type || 'output',
        };
      }
    }
  }

  return null;
}

export async function comfyuiWaitForImage({
  promptId,
  timeoutMs = Number(process.env.COMFYUI_TIMEOUT_MS) || 180_000,
  pollIntervalMs = Number(process.env.COMFYUI_POLL_INTERVAL_MS) || 750,
  debugTag,
}) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const history = await comfyuiGetHistory(promptId);
    const ref = comfyuiExtractFirstImageRef(history, promptId);
    if (ref) {
      debugAiConsole(`${debugTag || 'ComfyUI'}.ready`, { promptId, ref });
      debugAiLog(`${debugTag || 'ComfyUI'}_ready`, { promptId, ref, history });
      return { ref, history };
    }
    await sleep(pollIntervalMs);
  }

  throw new Error(`ComfyUI generation timeout after ${Math.round(timeoutMs / 1000)}s`);
}

export async function comfyuiFetchImageBytes({ filename, subfolder, type }) {
  const baseUrl = getBaseUrl();
  const params = new URLSearchParams();
  params.set('filename', filename);
  if (subfolder) params.set('subfolder', subfolder);
  if (type) params.set('type', type);

  const url = `${baseUrl}/view?${params.toString()}`;
  const resp = await fetchWithTimeout(url, {}, Number(process.env.COMFYUI_HTTP_TIMEOUT_MS) || 20_000);
  if (!resp.ok) {
    const text = await resp.text();
    const err = new Error(`ComfyUI /view HTTP ${resp.status}: ${text.slice(0, 200)}`);
    err.status = resp.status;
    throw err;
  }

  const ct = resp.headers.get('content-type') || 'image/png';
  const ab = await resp.arrayBuffer();
  return { bytes: Buffer.from(ab), contentType: ct };
}

export function bytesToDataUrl(bytes, contentType = 'image/png') {
  const b64 = Buffer.from(bytes).toString('base64');
  return `data:${contentType};base64,${b64}`;
}
