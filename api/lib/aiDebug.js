import fs from 'node:fs/promises';
import path from 'node:path';

function isEnabled() {
  const v = String(process.env.DEBUG_AI ?? '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function debugAiLog(tag, payload) {
  if (!isEnabled()) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeTag = String(tag || 'ai').replace(/[^a-zA-Z0-9_-]/g, '_');
  const dir = path.resolve(process.cwd(), '.debug', 'ai');

  const entry = {
    ts: new Date().toISOString(),
    tag: safeTag,
    payload,
  };

  // Fire-and-forget: don't block the request path on logging.
  void (async () => {
    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, `${stamp}_${safeTag}.json`), JSON.stringify(entry, null, 2), 'utf8');
    } catch {
      // ignore logging failures
    }
  })();
}

export function debugAiConsole(tag, payload) {
  if (!isEnabled()) return;
  console.log(`[DEBUG_AI] ${tag}`, payload);
}
