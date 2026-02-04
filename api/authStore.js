import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const DEFAULT_PATH = path.join(process.cwd(), 'api', 'data', 'auth-store.json');
const STORE_PATH = process.env.AUTH_STORE_PATH ? path.resolve(process.env.AUTH_STORE_PATH) : DEFAULT_PATH;

let loaded = false;
let users = [];
let sessions = [];

function isPasswordAuthEnabled() {
  return String(process.env.AUTH_ALLOW_PASSWORD || '').toLowerCase() === 'true';
}

async function ensureDirExists(filePath) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

async function loadIfNeeded() {
  if (loaded) return;
  loaded = true;

  try {
    const raw = await fs.readFile(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    users = Array.isArray(parsed?.users) ? parsed.users : [];
    sessions = Array.isArray(parsed?.sessions) ? parsed.sessions : [];
  } catch {
    users = [];
    sessions = [];
  }

  cleanupExpiredSessionsSync();
}

async function persist() {
  await ensureDirExists(STORE_PATH);
  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    users,
    sessions,
  };
  await fs.writeFile(STORE_PATH, JSON.stringify(payload, null, 2), 'utf-8');
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function base64Url(buf) {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function sanitizeText(input, maxLen) {
  const str = String(input ?? '');
  const trimmed = str.replace(/\s+/g, ' ').trim();
  return trimmed.slice(0, maxLen);
}

function sanitizeHandle(input) {
  const raw = sanitizeText(input, 20).toLowerCase();
  const cleaned = raw.replace(/[^a-z0-9_]/g, '');
  if (cleaned.length < 3) return '';
  return cleaned;
}

function makeStableHandleFromIdentity(provider, subject) {
  const p = String(provider || '').toLowerCase();
  const s = String(subject || '');
  const hash = crypto.createHash('sha256').update(`${p}:${s}`).digest('hex').slice(0, 14);
  const base = `${p[0] || 'u'}_${hash}`;
  return sanitizeHandle(base) || `u_${hash.slice(0, 10)}`;
}

function normalizeEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!e || !e.includes('@')) return '';
  return e.slice(0, 254);
}

function normalizeProvider(provider) {
  const p = String(provider || '').trim().toLowerCase();
  if (p !== 'google' && p !== 'apple') throw new Error('Unsupported identity provider');
  return p;
}

function normalizeSubject(subject) {
  const s = String(subject || '').trim();
  if (!s) throw new Error('Identity subject is required');
  return s.slice(0, 200);
}

function hashPassword(password, salt) {
  const pwd = String(password ?? '');
  if (!pwd) throw new Error('password is required');
  const key = crypto.scryptSync(pwd, salt, 32);
  return base64Url(key);
}

function cleanupExpiredSessionsSync() {
  const now = Date.now();
  sessions = sessions.filter((s) => {
    const exp = Date.parse(String(s.expiresAt || ''));
    return Number.isFinite(exp) ? exp > now : false;
  });
}

export async function registerUser({ handle, password, displayName }) {
  await loadIfNeeded();

  if (!isPasswordAuthEnabled()) {
    throw new Error('Password registration is disabled');
  }

  const safeHandle = sanitizeHandle(handle);
  if (!safeHandle) throw new Error('handle must be 3-20 chars: a-z, 0-9, _');

  const existing = users.find((u) => String(u.handle).toLowerCase() === safeHandle);
  if (existing) throw new Error('handle is already taken');

  const pwd = String(password ?? '');
  if (pwd.length < 6) throw new Error('password must be at least 6 characters');

  const salt = base64Url(crypto.randomBytes(16));
  const passwordHash = hashPassword(pwd, salt);

  const now = new Date().toISOString();
  const user = {
    id: makeId('u'),
    handle: safeHandle,
    displayName: sanitizeText(displayName, 32) || safeHandle,
    bio: '',
    passwordSalt: salt,
    passwordHash,
    followingIds: [],
    createdAt: now,
    updatedAt: now,
  };

  users.unshift(user);
  await persist();
  return toPublicUser(user);
}

export async function authenticateUser({ handle, password }) {
  await loadIfNeeded();
  if (!isPasswordAuthEnabled()) return null;
  const safeHandle = sanitizeHandle(handle);
  if (!safeHandle) return null;

  const user = users.find((u) => String(u.handle).toLowerCase() === safeHandle);
  if (!user) return null;

  try {
    const computed = hashPassword(password, String(user.passwordSalt || ''));
    const ok = crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(String(user.passwordHash || '')));
    return ok ? toPublicUser(user) : null;
  } catch {
    return null;
  }
}

export async function createSession(userId, { ttlDays = 30 } = {}) {
  await loadIfNeeded();

  const user = users.find((u) => u.id === userId);
  if (!user) throw new Error('user not found');

  const now = Date.now();
  const token = base64Url(crypto.randomBytes(32));
  const expiresAt = new Date(now + ttlDays * 24 * 60 * 60 * 1000).toISOString();

  sessions.unshift({ token, userId, createdAt: new Date(now).toISOString(), expiresAt });
  cleanupExpiredSessionsSync();
  await persist();

  return { token, expiresAt };
}

export async function deleteSession(token) {
  await loadIfNeeded();
  const t = String(token || '');
  const before = sessions.length;
  sessions = sessions.filter((s) => s.token !== t);
  if (sessions.length !== before) await persist();
}

export async function getUserBySessionToken(token) {
  await loadIfNeeded();
  const t = String(token || '');
  if (!t) return null;

  cleanupExpiredSessionsSync();
  const session = sessions.find((s) => s.token === t);
  if (!session) return null;

  const user = users.find((u) => u.id === session.userId);
  if (!user) return null;

  return toPublicUser(user);
}

export async function getUserRecordById(userId) {
  await loadIfNeeded();
  return users.find((u) => u.id === userId) || null;
}

export async function findOrCreateUserForIdentity({ provider, subject, email, displayName } = {}) {
  await loadIfNeeded();

  const p = normalizeProvider(provider);
  const s = normalizeSubject(subject);
  const e = normalizeEmail(email);

  const match = users.find((u) =>
    Array.isArray(u.identities)
      ? u.identities.some((id) => id && id.provider === p && id.subject === s)
      : false
  );

  if (match) {
    // best-effort refresh of profile fields
    const nowIso = new Date().toISOString();
    if (e && !match.email) match.email = e;
    if (displayName && !match.displayName) match.displayName = sanitizeText(displayName, 32);
    if (Array.isArray(match.identities)) {
      const ident = match.identities.find((id) => id && id.provider === p && id.subject === s);
      if (ident && e && !ident.email) ident.email = e;
    }
    match.updatedAt = nowIso;
    await persist();
    return toPublicUser(match);
  }

  const now = new Date().toISOString();
  const handle = makeStableHandleFromIdentity(p, s);

  // Extremely unlikely, but ensure uniqueness.
  let finalHandle = handle;
  let counter = 0;
  while (users.some((u) => String(u.handle).toLowerCase() === finalHandle)) {
    counter += 1;
    const suffix = String(counter).slice(0, 3);
    finalHandle = sanitizeHandle(`${handle.slice(0, 16)}${suffix}`) || handle;
  }

  const user = {
    id: makeId('u'),
    handle: finalHandle,
    displayName: sanitizeText(displayName, 32) || finalHandle,
    bio: '',
    email: e,
    identities: [
      {
        provider: p,
        subject: s,
        email: e,
        createdAt: now,
      },
    ],
    followingIds: [],
    createdAt: now,
    updatedAt: now,
  };

  users.unshift(user);
  await persist();
  return toPublicUser(user);
}

export async function getPublicUserById(userId) {
  const rec = await getUserRecordById(userId);
  return rec ? toPublicUser(rec) : null;
}

export async function updateMyProfile(userId, patch) {
  await loadIfNeeded();
  const user = users.find((u) => u.id === userId);
  if (!user) throw new Error('user not found');

  if (patch && typeof patch === 'object') {
    if (patch.displayName !== undefined) {
      user.displayName = sanitizeText(patch.displayName, 32) || user.handle;
    }
    if (patch.bio !== undefined) {
      user.bio = sanitizeText(patch.bio, 160);
    }
  }

  user.updatedAt = new Date().toISOString();
  await persist();
  return toPublicUser(user);
}

export async function toggleFollow(followerId, followeeId) {
  await loadIfNeeded();

  if (!followerId || !followeeId) throw new Error('invalid user id');
  if (followerId === followeeId) throw new Error('cannot follow yourself');

  const follower = users.find((u) => u.id === followerId);
  const followee = users.find((u) => u.id === followeeId);
  if (!follower || !followee) throw new Error('user not found');

  follower.followingIds = Array.isArray(follower.followingIds) ? follower.followingIds : [];
  const idx = follower.followingIds.indexOf(followeeId);
  const nowIso = new Date().toISOString();

  let isFollowing;
  if (idx >= 0) {
    follower.followingIds.splice(idx, 1);
    isFollowing = false;
  } else {
    follower.followingIds.unshift(followeeId);
    follower.followingIds = Array.from(new Set(follower.followingIds)).slice(0, 5000);
    isFollowing = true;
  }

  follower.updatedAt = nowIso;
  await persist();

  return {
    isFollowing,
    followingIds: follower.followingIds.slice(),
  };
}

export async function getFollowingIds(userId) {
  const rec = await getUserRecordById(userId);
  const ids = rec?.followingIds;
  return Array.isArray(ids) ? ids.map(String) : [];
}

export async function listPublicUsers({ limit = 50 } = {}) {
  await loadIfNeeded();
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  return users.slice(0, safeLimit).map(toPublicUser);
}

export function toPublicUser(user) {
  if (!user) return null;
  return {
    id: String(user.id),
    handle: String(user.handle),
    displayName: String(user.displayName || user.handle),
    bio: String(user.bio || ''),
    createdAt: String(user.createdAt || ''),
    updatedAt: String(user.updatedAt || ''),
  };
}
