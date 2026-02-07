import { Worker } from 'node:worker_threads';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

function parseArgs(argv) {
  const out = { modulePath: '', timeoutMs: 5000 };
  const args = argv.slice(2);
  out.modulePath = args[0] || '';
  for (const a of args.slice(1)) {
    const m = String(a).match(/^--timeout(?:=|\s+)(\d+)$/);
    if (m) out.timeoutMs = Number(m[1]);
  }
  return out;
}

const { modulePath, timeoutMs } = parseArgs(process.argv);
if (!modulePath) {
  console.error('Usage: node scripts/smoke-require.mjs <modulePath> [--timeout=5000]');
  process.exit(2);
}

const abs = path.isAbsolute(modulePath)
  ? modulePath
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', modulePath);

const workerCode = `
  import { parentPort, workerData } from 'node:worker_threads';
  (async () => {
    try {
      const url = workerData.moduleUrl;
      await import(url);
      parentPort.postMessage({ ok: true });
    } catch (e) {
      parentPort.postMessage({ ok: false, error: e && e.message ? e.message : String(e) });
    }
  })();
`;

// Use file URL for consistent ESM import behavior across platforms.
const moduleUrl = pathToFileURL(abs).toString();

const worker = new Worker(workerCode, {
  eval: true,
  type: 'module',
  workerData: { moduleUrl },
});

let done = false;
const timer = setTimeout(() => {
  if (done) return;
  done = true;
  worker.terminate();
  console.error(`Timeout after ${timeoutMs}ms while requiring: ${modulePath}`);
  process.exit(124);
}, Math.max(1, Number(timeoutMs) || 5000));

worker.on('message', (msg) => {
  if (done) return;
  done = true;
  clearTimeout(timer);
  if (msg && msg.ok) {
    console.log(`OK: required ${modulePath}`);
    process.exit(0);
  }
  console.error(`FAILED: require ${modulePath}: ${msg && msg.error ? msg.error : 'unknown error'}`);
  process.exit(1);
});

worker.on('error', (err) => {
  if (done) return;
  done = true;
  clearTimeout(timer);
  console.error(`Worker error: ${err && err.message ? err.message : String(err)}`);
  process.exit(1);
});
