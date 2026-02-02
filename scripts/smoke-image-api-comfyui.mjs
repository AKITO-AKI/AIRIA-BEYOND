import fs from 'node:fs/promises';
import path from 'node:path';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function stripTrailingSlash(url) {
  return String(url || '').replace(/\/+$/, '');
}

function parseDataUrl(dataUrl) {
  const m = /^data:([^;]+);base64,(.+)$/i.exec(String(dataUrl || ''));
  if (!m) return null;
  const contentType = m[1];
  const b64 = m[2];
  return { contentType, bytes: Buffer.from(b64, 'base64') };
}

async function main() {
  const apiBase = stripTrailingSlash(process.env.API_BASE_URL || 'http://127.0.0.1:3000');
  const outDir = process.env.SMOKE_OUTPUT_DIR
    ? path.resolve(process.env.SMOKE_OUTPUT_DIR)
    : path.resolve(process.cwd(), '.debug', 'smoke');

  const body = {
    mood: process.env.SMOKE_MOOD || '穏やか',
    duration: Number(process.env.SMOKE_DURATION || 60),
    motifTags: (process.env.SMOKE_MOTIFS ? process.env.SMOKE_MOTIFS.split(',') : ['静寂', '水面', '薄明']).map((s) => s.trim()).filter(Boolean),
    stylePreset: process.env.SMOKE_STYLE_PRESET || 'oil-painting',
    seed: process.env.SMOKE_SEED ? Number(process.env.SMOKE_SEED) : undefined,
    provider: 'comfyui',
  };

  console.log('[smoke] POST /api/image/generate (comfyui)', { apiBase, body: { ...body, motifTags: body.motifTags?.length } });

  let resp;
  try {
    resp = await fetch(`${apiBase}/api/image/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const code = e?.cause?.code || e?.code;
    if (code === 'ECONNREFUSED') {
      console.error('[smoke] API server is not reachable. Start it first: npm run dev:api');
      console.error('[smoke] If you changed the port/host, set API_BASE_URL.');
    }
    throw e;
  }

  const text = await resp.text();
  if (!resp.ok) {
    console.error('[smoke] generate failed:', resp.status, text);
    process.exit(1);
  }

  const json = JSON.parse(text);
  const jobId = json?.jobId;
  if (!jobId) {
    console.error('[smoke] missing jobId:', json);
    process.exit(1);
  }

  console.log('[smoke] jobId:', jobId);

  const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 240_000);
  const pollMs = Number(process.env.SMOKE_POLL_MS || 1000);
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const st = await fetch(`${apiBase}/api/job/${encodeURIComponent(jobId)}`);
    const stText = await st.text();
    if (!st.ok) {
      console.error('[smoke] status failed:', st.status, stText);
      process.exit(1);
    }

    const job = JSON.parse(stText);
    if (job.status === 'succeeded') {
      const resultUrl = job.resultUrl || job.result;
      if (!resultUrl) {
        console.error('[smoke] succeeded but no resultUrl/result');
        process.exit(1);
      }

      const parsed = parseDataUrl(resultUrl);
      if (!parsed) {
        console.warn('[smoke] result is not a data URL; saving raw to txt');
        await fs.mkdir(outDir, { recursive: true });
        await fs.writeFile(path.join(outDir, `${jobId}.txt`), String(resultUrl), 'utf8');
        console.log('[smoke] wrote:', path.join(outDir, `${jobId}.txt`));
        return;
      }

      const ext = parsed.contentType.includes('png') ? 'png' : parsed.contentType.includes('jpeg') ? 'jpg' : 'bin';
      await fs.mkdir(outDir, { recursive: true });
      const outPath = path.join(outDir, `${jobId}.${ext}`);
      await fs.writeFile(outPath, parsed.bytes);

      console.log('[smoke] OK:', {
        provider: job.provider,
        model: job.model,
        contentType: parsed.contentType,
        bytes: parsed.bytes.length,
        outPath,
      });
      return;
    }

    if (job.status === 'failed') {
      console.error('[smoke] job failed:', {
        errorCode: job.errorCode,
        errorMessage: job.errorMessage,
        error: job.error,
      });
      process.exit(1);
    }

    process.stdout.write(`.[${job.status}]`);
    await sleep(pollMs);
  }

  console.error(`\n[smoke] timeout after ${Math.round(timeoutMs / 1000)}s`);
  process.exit(1);
}

main().catch((e) => {
  console.error('[smoke] fatal:', e);
  process.exit(1);
});
