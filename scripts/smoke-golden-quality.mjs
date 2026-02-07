import { spawn } from 'node:child_process';
import { GOLDEN_CASES } from './golden-cases.mjs';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function envFlag(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw == null) return defaultValue;
  const v = String(raw).trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function envInt(name, fallback) {
  const raw = process.env[name];
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
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
    const msg =
      typeof json?.message === 'string'
        ? json.message
        : typeof json?.error === 'string'
          ? json.error
          : String(text || resp.status);
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

function validateRefine(refined) {
  assert(refined && typeof refined === 'object', 'refine: response must be an object');
  assert(refined.music && typeof refined.music === 'object', 'refine: missing music');
  assert(refined.image && typeof refined.image === 'object', 'refine: missing image');

  const density = refined?.image?.density;
  assert(typeof density === 'number' && Number.isFinite(density), 'refine: image.density missing');
  assert(density >= 0 && density <= 1, 'refine: image.density out of range (0..1)');

  const humanize = refined?.music?.humanize;
  assert(humanize && typeof humanize === 'object', 'refine: music.humanize missing');
  assert(typeof humanize.rubato === 'string' && humanize.rubato.length, 'refine: music.humanize.rubato missing');
  assert(
    typeof humanize.velocityCurve === 'string' && humanize.velocityCurve.length,
    'refine: music.humanize.velocityCurve missing'
  );
}

function validateMusicJob(job) {
  assert(job?.status === 'succeeded', `music: job did not succeed: ${job?.status}`);
  assert(typeof job?.midiData === 'string' && job.midiData.length > 100, 'music: midiData missing/too short');

  const r = job?.result;
  assert(r && typeof r === 'object', 'music: result missing');
  assert(typeof r.key === 'string' && r.key.trim(), 'music: key missing');
  assert(typeof r.form === 'string' && r.form.trim(), 'music: form missing');
  assert(typeof r.tempo === 'number' && Number.isFinite(r.tempo), 'music: tempo missing');
  assert(r.tempo >= 40 && r.tempo <= 220, `music: tempo out of range (40..220): ${r.tempo}`);
  assert(typeof r.timeSignature === 'string' && /^\d{1,2}\/\d{1,2}$/.test(r.timeSignature), 'music: timeSignature invalid');

  const sections = Array.isArray(r.sections) ? r.sections : null;
  assert(sections && sections.length >= 2 && sections.length <= 16, `music: sections length unexpected: ${sections?.length}`);

  const allowedCadences = new Set(['HC', 'PAC', 'DC', 'PICARDY']);
  let cadenceCount = 0;

  for (const s of sections) {
    assert(s && typeof s === 'object', 'music: section is not an object');
    assert(typeof s.name === 'string' && s.name.trim(), 'music: section.name missing');
    assert(typeof s.measures === 'number' && Number.isFinite(s.measures) && s.measures >= 1 && s.measures <= 128, 'music: section.measures invalid');
    assert(Array.isArray(s.chordProgression) && s.chordProgression.length >= 2, 'music: section.chordProgression missing');
    assert(s.melody && typeof s.melody === 'object', 'music: section.melody missing');
    assert(Array.isArray(s.melody.motifs) && s.melody.motifs.length >= 1, 'music: section.melody.motifs missing');
    assert(typeof s.dynamics === 'string' && s.dynamics.trim(), 'music: section.dynamics missing');
    assert(typeof s.texture === 'string' && s.texture.trim(), 'music: section.texture missing');

    if (typeof s.cadence === 'string' && allowedCadences.has(s.cadence)) cadenceCount++;
  }

  assert(cadenceCount >= 1, 'music: expected at least one cadence goal (HC|PAC|DC|PICARDY)');
}

function validateImageJob(job) {
  assert(job?.status === 'succeeded', `image: job did not succeed: ${job?.status}`);
  assert(typeof job?.resultUrl === 'string' && job.resultUrl.length > 20, 'image: resultUrl missing/too short');

  const d = job?.inputSummary?.density;
  if (d != null) {
    assert(typeof d === 'number' && Number.isFinite(d), 'image: inputSummary.density invalid');
    assert(d >= 0 && d <= 1, 'image: inputSummary.density out of range (0..1)');
  }
}

const port = Number(process.env.SMOKE_PORT || 3100);
const baseUrl = `http://localhost:${port}`;
const argv = process.argv.slice(2);

const requireRealProviders =
  argv.includes('--strict') ||
  argv.includes('--require-real-providers') ||
  envFlag('SMOKE_REQUIRE_REAL_PROVIDERS') ||
  envFlag('SMOKE_STRICT');

const maxCases = envInt('SMOKE_GOLDEN_MAX_CASES', argv.includes('--full') ? 999 : 5);
const timeoutMs = envInt('SMOKE_GOLDEN_TIMEOUT_MS', argv.includes('--full') ? 65000 : 45000);

console.log(`[smoke-golden-quality] starting server on ${baseUrl}`);
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
  console.log('[smoke-golden-quality] health ok:', {
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

  const cases = GOLDEN_CASES.slice(0, Math.max(0, maxCases));
  assert(cases.length >= 1, 'No golden cases to run');

  console.log(`[smoke-golden-quality] running ${cases.length}/${GOLDEN_CASES.length} cases (timeoutMs=${timeoutMs})`);

  for (const c of cases) {
    console.log(`\n[case] ${c.id}`);

    const refined = await fetchJson(`${baseUrl}/api/event/refine`, {
      method: 'POST',
      body: JSON.stringify({ messages: c.messages }),
    });
    validateRefine(refined);

    const musicReq = {
      ...refined.music,
      confidence: refined?.analysisLike?.confidence ?? 0.8,
    };

    const musicStart = await fetchJson(`${baseUrl}/api/music/generate`, {
      method: 'POST',
      body: JSON.stringify(musicReq),
    });
    assert(typeof musicStart?.jobId === 'string', 'music generate missing jobId');

    const musicJob = await poll(
      () => fetchJson(`${baseUrl}/api/music/${encodeURIComponent(musicStart.jobId)}`, { method: 'GET' }),
      { timeoutMs, intervalMs: 750 }
    );
    validateMusicJob(musicJob);

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

    const imageJob = await poll(
      () => fetchJson(`${baseUrl}/api/job/${encodeURIComponent(imageStart.jobId)}`, { method: 'GET' }),
      { timeoutMs, intervalMs: 750 }
    );
    validateImageJob(imageJob);

    if (requireRealProviders) {
      assert(
        imageJob?.effectiveProvider && imageJob.effectiveProvider !== 'placeholder',
        `Strict mode: expected real image provider, got ${imageJob?.effectiveProvider}`
      );
    }

    console.log('[case] ok:', {
      id: c.id,
      refineProvider: refined?.provider,
      musicProvider: musicJob?.effectiveProvider || musicJob?.provider,
      imageProvider: imageJob?.effectiveProvider || imageJob?.provider,
      tempo: musicJob?.result?.tempo,
      timeSignature: musicJob?.result?.timeSignature,
      sections: Array.isArray(musicJob?.result?.sections) ? musicJob.result.sections.length : 0,
      density: refined?.image?.density,
    });
  }

  console.log('\n[smoke-golden-quality] OK');
} finally {
  try {
    child.kill();
  } catch {
    // ignore
  }
}
