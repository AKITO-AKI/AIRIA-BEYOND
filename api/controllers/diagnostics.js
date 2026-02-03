import { getAllJobs } from '../jobStore.js';

function getComfyUiBaseUrl() {
  const raw = process.env.COMFYUI_BASE_URL || 'http://127.0.0.1:8188';
  return String(raw).replace(/\/$/, '');
}

async function quickFetch(url, timeoutMs = 800) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    return { ok: resp.ok, status: resp.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(t);
  }
}

export async function getImageDiagnostics(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const comfyBase = getComfyUiBaseUrl();
  const replicateAvailable = !!process.env.REPLICATE_API_TOKEN;

  const comfyProbe = await quickFetch(comfyBase, 900);

  const jobs = getAllJobs();
  const recentFailed = jobs
    .filter((j) => j.status === 'failed')
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 6)
    .map((j) => ({
      id: j.id,
      provider: j.provider,
      model: j.model,
      createdAt: j.createdAt,
      errorCode: j.errorCode,
      errorMessage: j.errorMessage || j.error,
      retryCount: j.retryCount,
      warnings: j.warnings || [],
    }));

  const recentWarnings = jobs
    .filter((j) => Array.isArray(j.warnings) && j.warnings.length > 0)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 6)
    .map((j) => ({
      id: j.id,
      provider: j.provider,
      createdAt: j.createdAt,
      warnings: j.warnings || [],
      effectiveProvider: j.effectiveProvider,
      fallbackUsed: j.fallbackUsed,
      fallbackReason: j.fallbackReason,
      generationError: j.generationError,
    }));

  return res.status(200).json({
    now: new Date().toISOString(),
    env: {
      nodeEnv: process.env.NODE_ENV || 'unknown',
      imageProviderPref: process.env.IMAGE_PROVIDER || null,
      comfyuiBaseUrl: comfyBase,
      comfyuiCheckpoint: process.env.COMFYUI_CHECKPOINT || null,
      comfyuiConfigured: !!(process.env.COMFYUI_BASE_URL || process.env.IMAGE_PROVIDER === 'comfyui' || process.env.IMAGE_PROVIDER === 'comfy'),
      replicateAvailable,
    },
    probes: {
      comfyui: {
        url: comfyBase,
        ok: !!comfyProbe.ok,
        status: comfyProbe.status,
        error: comfyProbe.error,
      },
    },
    recent: {
      failed: recentFailed,
      warnings: recentWarnings,
    },
  });
}
