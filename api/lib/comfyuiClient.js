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

let cachedObjectInfo = null;
let cachedObjectInfoAt = 0;

export async function comfyuiGetObjectInfo({ ttlMs = 60_000 } = {}) {
  const now = Date.now();
  if (cachedObjectInfo && now - cachedObjectInfoAt < ttlMs) return cachedObjectInfo;

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/object_info`;
  const resp = await fetchWithTimeout(url, {}, Number(process.env.COMFYUI_HTTP_TIMEOUT_MS) || 12_000);
  const text = await resp.text();
  if (!resp.ok) {
    const err = new Error(`ComfyUI /object_info HTTP ${resp.status}: ${text.slice(0, 200)}`);
    err.status = resp.status;
    throw err;
  }

  const json = JSON.parse(text);
  cachedObjectInfo = json;
  cachedObjectInfoAt = now;
  return json;
}

function hasNode(objectInfo, classType) {
  if (!objectInfo || typeof objectInfo !== 'object') return false;
  return Object.prototype.hasOwnProperty.call(objectInfo, classType);
}

function getRequiredInputs(objectInfo, classType) {
  try {
    const node = objectInfo?.[classType];
    const required = node?.input?.required;
    return required && typeof required === 'object' ? required : null;
  } catch {
    return null;
  }
}

function pickInputKey(requiredInputs, candidates) {
  if (!requiredInputs) return '';
  const keys = Object.keys(requiredInputs);
  for (const c of candidates) {
    const exact = keys.find((k) => k === c);
    if (exact) return exact;
  }
  // fuzzy fallback
  for (const c of candidates) {
    const lower = String(c).toLowerCase();
    const fuzzy = keys.find((k) => String(k).toLowerCase().includes(lower));
    if (fuzzy) return fuzzy;
  }
  return '';
}

export async function comfyuiUploadImage({
  bytes,
  filename = 'reference.png',
  subfolder = '',
  overwrite = true,
  timeoutMs = Number(process.env.COMFYUI_HTTP_TIMEOUT_MS) || 20_000,
} = {}) {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/upload/image`;

  const form = new FormData();
  const blob = new Blob([bytes], { type: 'image/png' });
  form.append('image', blob, filename);
  if (subfolder) form.append('subfolder', subfolder);
  form.append('overwrite', overwrite ? 'true' : 'false');

  const resp = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      body: form,
    },
    timeoutMs
  );

  const text = await resp.text();
  if (!resp.ok) {
    const err = new Error(`ComfyUI /upload/image HTTP ${resp.status}: ${text.slice(0, 200)}`);
    err.status = resp.status;
    throw err;
  }

  return JSON.parse(text);
}

export async function comfyuiUploadImageFromUrl({
  imageUrl,
  filename,
  subfolder = 'airia',
  overwrite = true,
  timeoutMs = 20_000,
} = {}) {
  if (!imageUrl) throw new Error('imageUrl is required');
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(String(imageUrl), { signal: controller.signal });
    if (!resp.ok) throw new Error(`Reference image fetch HTTP ${resp.status}`);
    const ab = await resp.arrayBuffer();
    const ct = String(resp.headers.get('content-type') || '').toLowerCase();
    const inferredExt = ct.includes('jpeg') || ct.includes('jpg') ? 'jpg' : 'png';
    const name = filename || `ref_${Date.now()}.${inferredExt}`;
    return await comfyuiUploadImage({ bytes: new Uint8Array(ab), filename: name, subfolder, overwrite });
  } finally {
    clearTimeout(t);
  }
}

function envStr(name, fallback = '') {
  const v = String(process.env[name] ?? '').trim();
  return v || fallback;
}

function envNum(name, fallback) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) ? v : fallback;
}

function parseJsonEnv(name) {
  const raw = envStr(name);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clamp(n, min, max, fallback) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, x));
}

function getWorkflowOptionsFromEnv() {
  const loras = parseJsonEnv('COMFYUI_LORAS');
  const parsedLoras = Array.isArray(loras)
    ? loras
        .map((l) => {
          if (!l || typeof l !== 'object') return null;
          const name = String(l.name ?? l.lora_name ?? '').trim();
          if (!name) return null;
          return {
            name,
            strength_model: clamp(l.strength_model ?? l.strengthModel, 0, 1.2, 0.7),
            strength_clip: clamp(l.strength_clip ?? l.strengthClip, 0, 1.2, 0.7),
          };
        })
        .filter(Boolean)
        .slice(0, 4)
    : [];

  const hiresEnabled = String(envStr('COMFYUI_HIRES_ENABLED', '')).toLowerCase();
  const enableHires = hiresEnabled === '1' || hiresEnabled === 'true' || hiresEnabled === 'yes' || hiresEnabled === 'on';

  const refinerCkpt = envStr('COMFYUI_REFINER_CHECKPOINT', '');

  const ipEnabledRaw = envStr('COMFYUI_IPADAPTER_ENABLED', '').toLowerCase();
  const ipEnabled = ipEnabledRaw === '1' || ipEnabledRaw === 'true' || ipEnabledRaw === 'yes' || ipEnabledRaw === 'on';
  const ipModel = envStr('COMFYUI_IPADAPTER_MODEL', '');
  const clipVision = envStr('COMFYUI_CLIP_VISION_MODEL', '');

  return {
    loras: parsedLoras,
    hires: enableHires
      ? {
          scale: clamp(envNum('COMFYUI_HIRES_SCALE', 1.5), 1.1, 2.0, 1.5),
          denoise: clamp(envNum('COMFYUI_HIRES_DENOISE', 0.35), 0.05, 0.75, 0.35),
          steps: Math.round(clamp(envNum('COMFYUI_HIRES_STEPS', 12), 4, 40, 12)),
        }
      : null,
    refiner: refinerCkpt
      ? {
          ckpt_name: refinerCkpt,
          denoise: clamp(envNum('COMFYUI_REFINER_DENOISE', 0.22), 0.05, 0.6, 0.22),
          steps: Math.round(clamp(envNum('COMFYUI_REFINER_STEPS', 12), 4, 40, 12)),
        }
      : null,
    ipadapter: ipEnabled && ipModel && clipVision
      ? {
          model: ipModel,
          clipVision,
          weight: clamp(envNum('COMFYUI_IPADAPTER_WEIGHT', 0.65), 0, 1.2, 0.65),
          startAt: clamp(envNum('COMFYUI_IPADAPTER_START_AT', 0.0), 0, 1, 0.0),
          endAt: clamp(envNum('COMFYUI_IPADAPTER_END_AT', 1.0), 0, 1, 1.0),
        }
      : null,
  };
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
  objectInfo,
  referenceImageName,
}) {
  const checkpoint = ckpt_name || process.env.COMFYUI_CHECKPOINT || 'sdxl_base_1.0.safetensors';

  const options = getWorkflowOptionsFromEnv();
  const canLora = hasNode(objectInfo, 'LoraLoader');
  const canLatentUpscale = hasNode(objectInfo, 'LatentUpscale');
  const canLoadImage = hasNode(objectInfo, 'LoadImage');

  // NOTE: Refiner and hi-res fix are optional and only used when:
  // - enabled via env, AND
  // - the required nodes exist in the running ComfyUI instance.
  const useLoras = canLora && Array.isArray(options.loras) && options.loras.length > 0;
  const useHires = canLatentUpscale && options.hires;
  const useRefiner = options.refiner && typeof options.refiner.ckpt_name === 'string' && options.refiner.ckpt_name;

  // IP-Adapter (custom nodes) are optional and require:
  // - COMFYUI_IPADAPTER_* env configured, AND
  // - referenceImageName provided, AND
  // - nodes exist in the running ComfyUI.
  const ip = options.ipadapter;
  const canIPApply = hasNode(objectInfo, 'IPAdapterApply') || hasNode(objectInfo, 'IPAdapterApplyUnified');
  const canIPModel = hasNode(objectInfo, 'IPAdapterModelLoader') || hasNode(objectInfo, 'IPAdapterUnifiedLoader');
  const canClipVision = hasNode(objectInfo, 'CLIPVisionLoader');
  const useIPAdapter = Boolean(ip && referenceImageName && canLoadImage && canIPApply && canIPModel && canClipVision);

  // This workflow only uses built-in ComfyUI nodes.
  // NOTE: ckpt_name must exist in ComfyUI's models/checkpoints.

  const wf = {
    '3': {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: checkpoint },
    },
  };

  // Optional LoRA chain
  let modelNode = ['3', 0];
  let clipNode = ['3', 1];
  if (useLoras) {
    // Chain LoRAs: output becomes next input.
    let lastModel = ['3', 0];
    let lastClip = ['3', 1];
    let nodeId = 10;
    for (const l of options.loras) {
      wf[String(nodeId)] = {
        class_type: 'LoraLoader',
        inputs: {
          model: lastModel,
          clip: lastClip,
          lora_name: l.name,
          strength_model: l.strength_model,
          strength_clip: l.strength_clip,
        },
      };
      lastModel = [String(nodeId), 0];
      lastClip = [String(nodeId), 1];
      nodeId += 1;
    }
    modelNode = lastModel;
    clipNode = lastClip;
  }

  // Optional IP-Adapter: apply style reference to the model before sampling.
  if (useIPAdapter) {
    const loadImageRequired = getRequiredInputs(objectInfo, 'LoadImage');
    const imageKey = pickInputKey(loadImageRequired, ['image', 'filename']);

    const clipVisionRequired = getRequiredInputs(objectInfo, 'CLIPVisionLoader');
    const clipVisionKey = pickInputKey(clipVisionRequired, ['clip_name', 'clip_vision', 'name']);

    const ipModelClass = hasNode(objectInfo, 'IPAdapterModelLoader') ? 'IPAdapterModelLoader' : 'IPAdapterUnifiedLoader';
    const ipModelRequired = getRequiredInputs(objectInfo, ipModelClass);
    const ipModelKey = pickInputKey(ipModelRequired, ['ipadapter_file', 'ipadapter_name', 'model_name', 'ipadapter']);

    const ipApplyClass = hasNode(objectInfo, 'IPAdapterApply') ? 'IPAdapterApply' : 'IPAdapterApplyUnified';
    const ipApplyRequired = getRequiredInputs(objectInfo, ipApplyClass);
    const weightKey = pickInputKey(ipApplyRequired, ['weight', 'strength']);
    const startKey = pickInputKey(ipApplyRequired, ['start_at', 'start', 'startAt']);
    const endKey = pickInputKey(ipApplyRequired, ['end_at', 'end', 'endAt']);
    const ipKey = pickInputKey(ipApplyRequired, ['ipadapter', 'ip_adapter']);
    const clipKey = pickInputKey(ipApplyRequired, ['clip_vision', 'clipVision']);
    const imgKey = pickInputKey(ipApplyRequired, ['image', 'img']);

    wf['30'] = {
      class_type: 'LoadImage',
      inputs: {
        [imageKey || 'image']: referenceImageName,
      },
    };
    wf['31'] = {
      class_type: 'CLIPVisionLoader',
      inputs: {
        [clipVisionKey || 'clip_name']: ip.clipVision,
      },
    };
    wf['32'] = {
      class_type: ipModelClass,
      inputs: {
        [ipModelKey || 'ipadapter_file']: ip.model,
      },
    };
    wf['33'] = {
      class_type: ipApplyClass,
      inputs: {
        model: modelNode,
        ...(ipKey ? { [ipKey]: ['32', 0] } : { ipadapter: ['32', 0] }),
        ...(clipKey ? { [clipKey]: ['31', 0] } : { clip_vision: ['31', 0] }),
        ...(imgKey ? { [imgKey]: ['30', 0] } : { image: ['30', 0] }),
        ...(weightKey ? { [weightKey]: ip.weight } : { weight: ip.weight }),
        ...(startKey ? { [startKey]: ip.startAt } : {}),
        ...(endKey ? { [endKey]: ip.endAt } : {}),
      },
    };
    modelNode = ['33', 0];
  }

  wf['4'] = {
    class_type: 'CLIPTextEncode',
    inputs: { text: String(prompt || ''), clip: clipNode },
  };
  wf['5'] = {
    class_type: 'CLIPTextEncode',
    inputs: { text: String(negativePrompt || ''), clip: clipNode },
  };
  wf['6'] = {
    class_type: 'EmptyLatentImage',
    inputs: { width, height, batch_size: 1 },
  };

  wf['7'] = {
    class_type: 'KSampler',
    inputs: {
      seed: Number(seed) || 0,
      steps,
      cfg,
      sampler_name,
      scheduler,
      denoise: 1,
      model: modelNode,
      positive: ['4', 0],
      negative: ['5', 0],
      latent_image: ['6', 0],
    },
  };

  // Optional hi-res fix: latent upscale + second sampler pass.
  // This improves perceived detail and reduces "muddy" low-res artifacts.
  let finalLatent = ['7', 0];
  if (useHires) {
    const scale = options.hires.scale;
    const upW = Math.round(width * scale);
    const upH = Math.round(height * scale);

    wf['11'] = {
      class_type: 'LatentUpscale',
      inputs: {
        samples: ['7', 0],
        upscale_method: envStr('COMFYUI_HIRES_UPSCALE_METHOD', 'nearest-exact'),
        width: upW,
        height: upH,
        crop: 'disabled',
      },
    };

    wf['12'] = {
      class_type: 'KSampler',
      inputs: {
        seed: Number(seed) || 0,
        steps: options.hires.steps,
        cfg,
        sampler_name,
        scheduler,
        denoise: options.hires.denoise,
        model: modelNode,
        positive: ['4', 0],
        negative: ['5', 0],
        latent_image: ['11', 0],
      },
    };
    finalLatent = ['12', 0];
  }

  // Optional refiner pass (SDXL refiner checkpoint), applied at low denoise.
  // NOTE: This requires the refiner checkpoint to exist on the ComfyUI host.
  let decodeLatent = finalLatent;
  let vaeNode = ['3', 2];
  if (useRefiner) {
    wf['13'] = {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: options.refiner.ckpt_name },
    };
    wf['14'] = {
      class_type: 'CLIPTextEncode',
      inputs: { text: String(prompt || ''), clip: ['13', 1] },
    };
    wf['15'] = {
      class_type: 'CLIPTextEncode',
      inputs: { text: String(negativePrompt || ''), clip: ['13', 1] },
    };
    wf['16'] = {
      class_type: 'KSampler',
      inputs: {
        seed: Number(seed) || 0,
        steps: options.refiner.steps,
        cfg,
        sampler_name,
        scheduler,
        denoise: options.refiner.denoise,
        model: ['13', 0],
        positive: ['14', 0],
        negative: ['15', 0],
        latent_image: finalLatent,
      },
    };
    decodeLatent = ['16', 0];
    vaeNode = ['13', 2];
  }

  wf['8'] = {
    class_type: 'VAEDecode',
    inputs: { samples: decodeLatent, vae: vaeNode },
  };
  wf['9'] = {
    class_type: 'SaveImage',
    inputs: { filename_prefix: filenamePrefix, images: ['8', 0] },
  };

  return wf;
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
