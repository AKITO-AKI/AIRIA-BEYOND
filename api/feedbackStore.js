/**
 * Feedback Store
 * - In-memory list for runtime
 * - Best-effort append-to-file for persistence (when filesystem is writable)
 */

import fs from 'fs';
import path from 'path';

const feedback = [];
const FEEDBACK_MAX = 2000;

function ensureDataDir() {
  try {
    const dir = path.join(process.cwd(), 'data');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  } catch {
    return null;
  }
}

function appendToFile(record) {
  try {
    const dir = ensureDataDir();
    if (!dir) return;
    const filePath = path.join(dir, 'feedback.jsonl');
    fs.appendFileSync(filePath, `${JSON.stringify(record)}\n`, 'utf8');
  } catch {
    // ignore (runtime may be read-only)
  }
}

export function createFeedbackEntry(input) {
  const entry = {
    id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ...input,
  };

  feedback.unshift(entry);
  if (feedback.length > FEEDBACK_MAX) feedback.length = FEEDBACK_MAX;
  appendToFile(entry);
  return entry;
}

export function listFeedback({ limit = 100 } = {}) {
  return feedback.slice(0, Math.max(1, Math.min(500, Number(limit) || 100)));
}
