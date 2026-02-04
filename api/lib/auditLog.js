import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

let nextId = 1;

/** @type {Array<any>} */
let events = [];

/** @type {Set<import('express').Response>} */
const subscribers = new Set();

const MAX_EVENTS = Math.max(100, Math.min(20000, Number(process.env.AUDIT_LOG_MAX || 2000)));
const PERSIST_ENABLED = String(process.env.AUDIT_LOG_PERSIST ?? 'true').toLowerCase() !== 'false';
const DEFAULT_PATH = path.join(process.cwd(), 'api', 'data', 'audit-log.json');
const STORE_PATH = process.env.AUDIT_LOG_PATH ? path.resolve(process.env.AUDIT_LOG_PATH) : DEFAULT_PATH;

let persistTimer = null;
let persistInFlight = false;
let dirty = false;

function ensureDirExistsSync(filePath) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  } catch {
    // ignore
  }
}

function loadFromDiskSync() {
  if (!PERSIST_ENABLED) return;
  try {
    if (!fs.existsSync(STORE_PATH)) return;
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    const loadedEvents = Array.isArray(parsed?.events) ? parsed.events : [];
    const loadedNextId = Number(parsed?.nextId || 1);
    events = loadedEvents.slice(0, MAX_EVENTS);
    nextId = Number.isFinite(loadedNextId) && loadedNextId > 0 ? loadedNextId : Math.max(1, (events[0]?.id || 0) + 1);
  } catch {
    // ignore (start fresh)
  }
}

async function persistToDisk() {
  if (!PERSIST_ENABLED) return;
  if (!dirty) return;
  if (persistInFlight) return;
  persistInFlight = true;
  dirty = false;

  try {
    await fsp.mkdir(path.dirname(STORE_PATH), { recursive: true });
    const payload = {
      version: 1,
      updatedAt: nowIso(),
      nextId,
      events: events.slice(0, MAX_EVENTS),
    };
    const tmp = `${STORE_PATH}.tmp`;
    await fsp.writeFile(tmp, JSON.stringify(payload, null, 2), 'utf-8');
    await fsp.rename(tmp, STORE_PATH);
  } catch {
    // ignore
  } finally {
    persistInFlight = false;
  }
}

function schedulePersist() {
  if (!PERSIST_ENABLED) return;
  dirty = true;
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistToDisk();
  }, 250);
}

function nowIso() {
  return new Date().toISOString();
}

function safeStr(input, maxLen) {
  const s = String(input ?? '');
  if (!maxLen) return s;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

export function buildActorFromReq(req) {
  const u = req?.user;
  if (!u) return null;
  return {
    id: safeStr(u.id, 120),
    handle: safeStr(u.handle, 40),
    displayName: safeStr(u.displayName, 80),
  };
}

export function appendAuditEvent(input = {}) {
  // Ensure dir exists early to reduce chances of first write failing.
  if (PERSIST_ENABLED) ensureDirExistsSync(STORE_PATH);

  const evt = {
    id: nextId++,
    ts: nowIso(),
    type: safeStr(input.type, 120) || 'event',
    severity: safeStr(input.severity, 16) || 'info',
    actor: input.actor ?? null,
    target: input.target ?? null,
    summary: safeStr(input.summary, 240) || '',
    request: input.request ?? null,
    data: input.data ?? null,
  };

  events.unshift(evt);
  if (events.length > MAX_EVENTS) events = events.slice(0, MAX_EVENTS);

  schedulePersist();

  // Fan-out to SSE subscribers (best-effort)
  const payload = `event: audit\ndata: ${JSON.stringify(evt)}\n\n`;
  for (const res of subscribers) {
    try {
      res.write(payload);
    } catch {
      // ignore
    }
  }

  return evt;
}

export function appendAuditEventFromReq(req, input = {}) {
  const ip = (() => {
    const forwarded = req?.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
    return safeStr(req?.headers?.['x-real-ip'], 80) || safeStr(req?.ip, 80) || '';
  })();

  const request = {
    method: safeStr(req?.method, 12),
    path: safeStr(req?.originalUrl || req?.url || '', 2048),
    ip,
    ua: safeStr(req?.headers?.['user-agent'], 240),
  };

  return appendAuditEvent({
    ...input,
    actor: input.actor ?? buildActorFromReq(req),
    request,
  });
}

export function listAuditEvents({ limit = 200, sinceId = null, type = '', actorId = '' } = {}) {
  const safeLimit = Math.max(1, Math.min(2000, Number(limit) || 200));
  const since = sinceId !== null && sinceId !== undefined && String(sinceId).trim() !== '' ? Number(sinceId) : null;
  const typeStr = String(type || '').trim().toLowerCase();
  const actorStr = String(actorId || '').trim();

  let out = events;

  if (Number.isFinite(since) && since > 0) {
    out = out.filter((e) => Number(e?.id || 0) > since);
  }

  if (typeStr) {
    out = out.filter((e) => String(e?.type || '').toLowerCase().includes(typeStr));
  }

  if (actorStr) {
    out = out.filter((e) => String(e?.actor?.id || '') === actorStr || String(e?.actor?.handle || '') === actorStr);
  }

  return out.slice(0, safeLimit);
}

export function subscribeAuditSse(req, res) {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  // CORS is handled by app-level cors middleware

  // Initial hello + recent snapshot
  res.write(`event: hello\ndata: ${JSON.stringify({ ts: nowIso(), max: MAX_EVENTS })}\n\n`);

  subscribers.add(res);

  const heartbeat = setInterval(() => {
    try {
      res.write(`event: ping\ndata: ${JSON.stringify({ ts: nowIso() })}\n\n`);
    } catch {
      // ignore
    }
  }, 20000);

  const cleanup = () => {
    clearInterval(heartbeat);
    subscribers.delete(res);
    try {
      res.end();
    } catch {
      // ignore
    }
  };

  req.on('close', cleanup);
  req.on('end', cleanup);

  return cleanup;
}

// Load persisted history at module init.
loadFromDiskSync();
