import { spawn } from 'node:child_process';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function hasCadence(sections) {
  if (!Array.isArray(sections)) return false;
  const allowed = new Set(['HC', 'PAC', 'DC', 'PICARDY']);
  return sections.some((s) => allowed.has(String(s?.cadence || '').toUpperCase()));
}

function envFlag(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw == null) return defaultValue;
  const v = String(raw).trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

async function fetchJson(url, options = {}) {
  const resp = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await resp.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!resp.ok) {
    const msg = typeof json?.message === 'string' ? json.message : typeof json?.error === 'string' ? json.error : String(text || resp.status);
    const err = new Error(`HTTP ${resp.status}: ${msg}`);
    err.status = resp.status;
    err.body = json;
    throw err;
  }
  return json;
}

async function waitForHealthy(baseUrl, timeoutMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const h = await fetchJson(`${baseUrl}/api/health`, { method: 'GET' });
      if (h?.status === 'healthy') return h;
    } catch {
      // ignore
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for health at ${baseUrl}/api/health`);
}

async function poll(getFn, { timeoutMs = 30000, intervalMs = 500 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = await getFn();
    if (v?.status === 'succeeded' || v?.status === 'failed') return v;
    await sleep(intervalMs);
  }
  throw new Error('Polling timeout');
}

const port = Number(process.env.SMOKE_PORT || 3099);
const baseUrl = `http://localhost:${port}`;
const argv = process.argv.slice(2);
const requireRealProviders =
  argv.includes('--strict') ||
  argv.includes('--require-real-providers') ||
  envFlag('SMOKE_REQUIRE_REAL_PROVIDERS') ||
  envFlag('SMOKE_STRICT');

console.log(`[smoke-e2e-http] starting server on ${baseUrl}`);
const child = spawn(process.execPath, ['server.js'], {
  env: {
    ...process.env,
    PORT: String(port),
    NODE_ENV: process.env.NODE_ENV || 'development',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

child.stdout.on('data', (d) => process.stdout.write(String(d)));
child.stderr.on('data', (d) => process.stderr.write(String(d)));

try {
  const health = await waitForHealthy(baseUrl);
  console.log('[smoke-e2e-http] health ok:', {
    openai: health?.services?.openai?.configured,
    ollama: health?.services?.ollama?.configured,
    replicate: health?.services?.replicate?.configured,
    comfyui: health?.services?.comfyui?.configured,
  });

  if (requireRealProviders) {
    const musicOk = !!(health?.services?.openai?.configured || health?.services?.ollama?.configured);
    const imageOk = !!(health?.services?.replicate?.configured || health?.services?.comfyui?.configured);
    assert(musicOk, 'Strict mode: OpenAI or Ollama must be configured for music');
    assert(imageOk, 'Strict mode: Replicate or ComfyUI must be configured for images');
  }

  const messages = [
    { role: 'user', content: '静かながらも希望が差す、冬の夜明けのような音楽を作りたい。' },
    { role: 'assistant', content: 'わかりました。感情の流れとモチーフを整理します。' },
    { role: 'user', content: 'モチーフは「孤独」「希望」「静寂」。クラシック寄りで。' },
  ];

  let refined;
  try {
    refined = await fetchJson(`${baseUrl}/api/event/refine`, {
      method: 'POST',
      body: JSON.stringify({ messages }),
    });
    assert(refined?.music && refined?.image, 'refine response missing music/image');
    assert(typeof refined?.image?.density === 'number', 'refine response missing image.density');
    assert(refined.image.density >= 0 && refined.image.density <= 1, 'refine image.density out of range');
    assert(refined?.music?.humanize && typeof refined.music.humanize === 'object', 'refine response missing music.humanize');
    assert(typeof refined.music.humanize.rubato === 'string', 'refine music.humanize.rubato missing');
    assert(typeof refined.music.humanize.velocityCurve === 'string', 'refine music.humanize.velocityCurve missing');
    console.log('[smoke-e2e-http] refine ok:', {
      provider: refined.provider,
      musicPeriod: refined?.music?.period,
      imagePeriod: refined?.image?.period,
      imageInstrumentation: refined?.image?.instrumentation,
      imageDensity: refined?.image?.density,
      musicHumanize: refined?.music?.humanize,
    });
  } catch (e) {
    console.warn('[smoke-e2e-http] refine failed, continuing with defaults:', e?.message || e);
    refined = {
      provider: 'rule-based',
      analysisLike: { valence: -0.4, arousal: 0.55, focus: 0.75, confidence: 0.8, motif_tags: ['孤独', '希望', '静寂'] },
      music: {
        valence: -0.4,
        arousal: 0.55,
        focus: 0.75,
        motif_tags: ['孤独', '希望', '静寂'],
        duration: 120,
        period: 'romantic',
        form: 'sonata',
        instrumentation: ['piano', 'strings'],
        emotional_arc: {
          early: { valence: -0.55, arousal: 0.45, focus: 0.7 },
          middle: { valence: -0.25, arousal: 0.7, focus: 0.8 },
          late: { valence: 0.15, arousal: 0.55, focus: 0.75 },
        },
        humanize: { rubato: 'subtle', velocityCurve: 'phrase', peakBoost: 0.22, phraseEndSoftness: 0.35 },
      },
      image: {
        mood: '冬の夜明けの静かな希望',
        duration: 120,
        motifTags: ['孤独', '希望', '静寂'],
        stylePreset: 'oil-painting',
        period: 'romantic',
        instrumentation: ['piano', 'strings'],
        ambiguity: 0.65,
        density: 0.55,
        subject: '都会の電車とスマホ',
        palette: 'umber, ultramarine, soft gold',
      },
    };
  }

  const musicReq = {
    ...refined.music,
    confidence: refined?.analysisLike?.confidence ?? 0.8,
  };

  const musicStart = await fetchJson(`${baseUrl}/api/music/generate`, {
    method: 'POST',
    body: JSON.stringify(musicReq),
  });
  assert(typeof musicStart?.jobId === 'string', 'music generate missing jobId');
  console.log('[smoke-e2e-http] music started:', musicStart.jobId);

  const musicJob = await poll(
    () => fetchJson(`${baseUrl}/api/music/${encodeURIComponent(musicStart.jobId)}`, { method: 'GET' }),
    { timeoutMs: 65000, intervalMs: 750 }
  );

  assert(musicJob.status === 'succeeded', `music job did not succeed: ${musicJob.status}`);
  assert(typeof musicJob?.midiData === 'string' && musicJob.midiData.length > 100, 'music midiData missing/too short');

  // Quality-loop invariants (should hold even under fallback)
  assert(musicJob?.result && typeof musicJob.result === 'object', 'music result missing');
  assert(isFiniteNumber(musicJob.result.tempo), 'music tempo missing');
  assert(musicJob.result.tempo >= 40 && musicJob.result.tempo <= 220, 'music tempo out of range');
  assert(typeof musicJob.result.timeSignature === 'string', 'music timeSignature missing');
  assert(/^\d+\/\d+$/.test(musicJob.result.timeSignature), 'music timeSignature invalid');
  assert(Array.isArray(musicJob.result.sections), 'music sections missing');
  assert(musicJob.result.sections.length >= 2 && musicJob.result.sections.length <= 16, 'music sections length out of range');
  assert(hasCadence(musicJob.result.sections), 'music cadence missing (expected at least 1 section cadence)');

  const hasLeit = Array.isArray(musicJob?.result?.leitmotifs) && musicJob.result.leitmotifs.length > 0;
  const hasHum = !!musicJob?.result?.humanize;
  console.log('[smoke-e2e-http] music ok:', {
    provider: musicJob.provider,
    key: musicJob?.result?.key,
    tempo: musicJob?.result?.tempo,
    sections: Array.isArray(musicJob?.result?.sections) ? musicJob.result.sections.length : 0,
    leitmotifs: hasLeit,
    humanize: hasHum,
    midiLen: musicJob.midiData.length,
  });

  if (requireRealProviders) {
    assert(
      musicJob?.effectiveProvider && musicJob.effectiveProvider !== 'rule-based' && musicJob.effectiveProvider !== 'emergency',
      `Strict mode: expected real music provider, got ${musicJob?.effectiveProvider}`
    );
  }

  const imageStart = await fetchJson(`${baseUrl}/api/image/generate`, {
    method: 'POST',
    body: JSON.stringify(refined.image),
  });
  assert(typeof imageStart?.jobId === 'string', 'image generate missing jobId');
  console.log('[smoke-e2e-http] image started:', imageStart.jobId);

  const imageJob = await poll(
    () => fetchJson(`${baseUrl}/api/job/${encodeURIComponent(imageStart.jobId)}`, { method: 'GET' }),
    { timeoutMs: 65000, intervalMs: 750 }
  );

  assert(imageJob.status === 'succeeded', `image job did not succeed: ${imageJob.status}`);
  assert(typeof imageJob?.resultUrl === 'string' && imageJob.resultUrl.length > 20, 'image resultUrl missing/too short');

  if (imageJob?.inputSummary && typeof imageJob.inputSummary === 'object' && 'density' in imageJob.inputSummary) {
    assert(isFiniteNumber(imageJob.inputSummary.density), 'image inputSummary.density must be a number');
    assert(imageJob.inputSummary.density >= 0 && imageJob.inputSummary.density <= 1, 'image inputSummary.density out of range');
  }
  console.log('[smoke-e2e-http] image ok:', {
    provider: imageJob.provider,
    effectiveProvider: imageJob.effectiveProvider,
    resultUrlPrefix: String(imageJob.resultUrl).slice(0, 32),
  });

  if (requireRealProviders) {
    assert(
      imageJob?.effectiveProvider && imageJob.effectiveProvider !== 'placeholder',
      `Strict mode: expected real image provider, got ${imageJob?.effectiveProvider}`
    );
  }

  console.log('[smoke-e2e-http] OK');
} finally {
  // Ensure the child process is terminated.
  try {
    child.kill();
  } catch {
    // ignore
  }
}
