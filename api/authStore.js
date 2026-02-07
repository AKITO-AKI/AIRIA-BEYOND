import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { isDbEnabled } from './db.js';
import * as dbStore from './authStoreDb.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = path.join(__dirname, 'data', 'auth-store.json');
const STORE_PATH = process.env.AUTH_STORE_PATH ? path.resolve(process.env.AUTH_STORE_PATH) : DEFAULT_PATH;

const scryptAsync = promisify(crypto.scrypt);

let loaded = false;
let users = [];
let sessions = [];

export function getAuthStorePath() {
  if (isDbEnabled()) return 'postgres:DATABASE_URL';
  return STORE_PATH;
}

export async function getAuthStoreDebugInfo() {
  if (isDbEnabled()) return dbStore.getAuthStoreDebugInfo();
  await loadIfNeeded();
  return {
    mode: 'file',
    storePath: STORE_PATH,
    loaded,
    userCount: Array.isArray(users) ? users.length : 0,
    sessionCount: Array.isArray(sessions) ? sessions.length : 0,
    now: new Date().toISOString(),
  };
}

function isPasswordAuthEnabled() {
  const allow = String(process.env.AUTH_ALLOW_PASSWORD || '').trim().toLowerCase();
  if (allow === 'true') return true;
  if (allow === 'false') return false;
  // Pre-release default: password auth is ON unless explicitly disabled.
  return true;
}

function isEmailRequired() {
  const v = String(process.env.AUTH_REQUIRE_EMAIL || '').trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes' || v === 'on') return true;
  if (v === 'false' || v === '0' || v === 'no' || v === 'off') return false;
  return false;
}

function getPasswordPepper() {
  return String(process.env.AUTH_PASSWORD_PEPPER || '');
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
    try {
      const parsed = JSON.parse(raw);
      users = Array.isArray(parsed?.users) ? parsed.users : [];
      sessions = Array.isArray(parsed?.sessions) ? parsed.sessions : [];
    } catch {
      // If the store is corrupted (e.g., partial write), back it up and start fresh.
      try {
        const dir = path.dirname(STORE_PATH);
        const base = path.basename(STORE_PATH, path.extname(STORE_PATH));
        const backup = path.join(dir, `${base}.corrupt_${Date.now()}.json`);
        await fs.copyFile(STORE_PATH, backup);
      } catch {
        // ignore
      }
      users = [];
      sessions = [];
    }
  } catch {
    // If the store doesn't exist yet (common on fresh deployments), attempt a one-time
    // migration from legacy/default paths. This helps when switching to a persistent
    // disk path via AUTH_STORE_PATH, or when older deployments depended on process.cwd().
    const migrated = await tryMigrateFromLegacyStores();
    if (!migrated) {
      users = [];
      sessions = [];
    }
  }

  cleanupExpiredSessionsSync();
}

async function tryMigrateFromLegacyStores() {
  // Prefer explicit previous default path migration.
  const migratedDefault = await tryMigrateFromDefaultStore();
  if (migratedDefault) return true;

  // Legacy: earlier versions used process.cwd() to compute the default path.
  // When systemd didn't set WorkingDirectory, this could have pointed at `/api/data/...`.
  const legacyCwdPath = path.join(process.cwd(), 'api', 'data', 'auth-store.json');
  if (legacyCwdPath === STORE_PATH || legacyCwdPath === DEFAULT_PATH) return false;

  try {
    const raw = await fs.readFile(legacyCwdPath, 'utf-8').catch(() => '');
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const migratedUsers = Array.isArray(parsed?.users) ? parsed.users : [];
    const migratedSessions = Array.isArray(parsed?.sessions) ? parsed.sessions : [];
    if (!migratedUsers.length && !migratedSessions.length) return false;

    users = migratedUsers;
    sessions = migratedSessions;
    cleanupExpiredSessionsSync();

    await persist();
    return true;
  } catch {
    return false;
  }
}

async function tryMigrateFromDefaultStore() {
  try {
    if (STORE_PATH === DEFAULT_PATH) return false;

    const raw = await fs.readFile(DEFAULT_PATH, 'utf-8').catch(() => '');
    if (!raw) return false;

    const parsed = JSON.parse(raw);
    const migratedUsers = Array.isArray(parsed?.users) ? parsed.users : [];
    const migratedSessions = Array.isArray(parsed?.sessions) ? parsed.sessions : [];
    if (!migratedUsers.length && !migratedSessions.length) return false;

    users = migratedUsers;
    sessions = migratedSessions;
    cleanupExpiredSessionsSync();

    await persist();
    return true;
  } catch {
    return false;
  }
}

let persistChain = Promise.resolve();

async function writeFileAtomically(filePath, content) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const tmpPath = path.join(dir, `.${base}.tmp_${process.pid}_${Date.now()}_${Math.random().toString(16).slice(2)}`);
  await fs.writeFile(tmpPath, content, 'utf-8');
  try {
    await fs.rename(tmpPath, filePath);
  } catch (e) {
    // Windows can fail rename-over-existing; fall back to copy+unlink.
    await fs.copyFile(tmpPath, filePath);
    await fs.unlink(tmpPath).catch(() => null);
  }
}

async function persistOnce() {
  await ensureDirExists(STORE_PATH);
  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    users,
    sessions,
  };
  const content = JSON.stringify(payload, null, 2);
  await writeFileAtomically(STORE_PATH, content);
}

async function persist() {
  // Serialize persist to avoid race conditions/corrupted writes.
  // Keep the chain alive even if a previous persist failed.
  persistChain = persistChain.catch(() => null).then(() => persistOnce());
  return persistChain;
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

function makeStableHandleFromEmail(email) {
  const e = normalizeEmail(email);
  if (!e) return '';
  const local = e.split('@')[0] || '';
  const candidate = sanitizeHandle(local.replace(/[.-]/g, '_'));
  if (candidate) return candidate;
  const hash = crypto.createHash('sha256').update(`email:${e}`).digest('hex').slice(0, 14);
  return sanitizeHandle(`e_${hash}`) || `e_${hash.slice(0, 10)}`;
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

async function hashPassword(password, salt, { pepper = '' } = {}) {
  const pwd = String(password ?? '');
  if (!pwd) throw new Error('password is required');
  const s = String(salt ?? '');
  if (!s) throw new Error('password salt is required');
  const p = String(pepper ?? '');
  const material = p ? `${pwd}\u0000${p}` : pwd;
  const key = await scryptAsync(material, s, 32);
  return base64Url(Buffer.isBuffer(key) ? key : Buffer.from(key));
}

function safeEqual(a, b) {
  try {
    const ba = Buffer.from(String(a || ''));
    const bb = Buffer.from(String(b || ''));
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

async function verifyPasswordForUserRecord(user, password) {
  const salt = String(user?.passwordSalt || '');
  const stored = String(user?.passwordHash || '');
  if (!salt || !stored) return { ok: false, upgraded: false };

  const pepper = getPasswordPepper();

  if (pepper) {
    const computedPeppered = await hashPassword(password, salt, { pepper });
    if (safeEqual(computedPeppered, stored)) return { ok: true, upgraded: false };

    // Backward compatibility: legacy accounts created before pepper was configured.
    const computedLegacy = await hashPassword(password, salt, { pepper: '' });
    if (safeEqual(computedLegacy, stored)) {
      return { ok: true, upgraded: true };
    }

    return { ok: false, upgraded: false };
  }

  const computed = await hashPassword(password, salt, { pepper: '' });
  return { ok: safeEqual(computed, stored), upgraded: false };
}

function cleanupExpiredSessionsSync() {
  const now = Date.now();
  sessions = sessions.filter((s) => {
    const exp = Date.parse(String(s.expiresAt || ''));
    return Number.isFinite(exp) ? exp > now : false;
  });
}

export async function registerUser({ handle, email, password, displayName }) {
  if (isDbEnabled()) return dbStore.registerUser({ handle, email, password, displayName });
  await loadIfNeeded();

  if (!isPasswordAuthEnabled()) {
    throw new Error('Password registration is disabled');
  }

  const normalizedEmail = normalizeEmail(email);
  if (isEmailRequired() && !normalizedEmail) {
    throw new Error('email is required');
  }
  if (normalizedEmail) {
    const emailTaken = users.some((u) => normalizeEmail(u?.email) === normalizedEmail);
    if (emailTaken) throw new Error('email is already registered');
  }

  const requestedHandle = sanitizeHandle(handle);
  const derivedHandle = !requestedHandle && normalizedEmail ? makeStableHandleFromEmail(normalizedEmail) : '';
  const baseHandle = requestedHandle || derivedHandle;
  if (!baseHandle) throw new Error('handle or email is required');

  let finalHandle = baseHandle;
  let counter = 0;
  while (users.some((u) => String(u.handle).toLowerCase() === finalHandle)) {
    counter += 1;
    const suffix = String(counter).slice(0, 3);
    finalHandle = sanitizeHandle(`${baseHandle.slice(0, 16)}${suffix}`) || baseHandle;
    if (counter > 999) throw new Error('unable to allocate handle');
  }

  const pwd = String(password ?? '');
  if (pwd.length < 6) throw new Error('password must be at least 6 characters');

  const salt = base64Url(crypto.randomBytes(16));
  const passwordHash = await hashPassword(pwd, salt, { pepper: getPasswordPepper() });

  const now = new Date().toISOString();
  const user = {
    id: makeId('u'),
    handle: finalHandle,
    displayName: sanitizeText(displayName, 32) || finalHandle,
    bio: '',
    email: normalizedEmail,
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
  if (isDbEnabled()) return dbStore.authenticateUser({ handle, password });
  await loadIfNeeded();
  if (!isPasswordAuthEnabled()) return null;
  const safeHandle = sanitizeHandle(handle);
  if (!safeHandle) return null;

  const user = users.find((u) => String(u.handle).toLowerCase() === safeHandle);
  if (!user) return null;

  try {
    const result = await verifyPasswordForUserRecord(user, password);
    if (!result.ok) return null;

    if (result.upgraded) {
      const newSalt = base64Url(crypto.randomBytes(16));
      user.passwordSalt = newSalt;
      user.passwordHash = await hashPassword(password, newSalt, { pepper: getPasswordPepper() });
      user.updatedAt = new Date().toISOString();
      await persist();
    }

    return toPublicUser(user);
  } catch {
    return null;
  }
}

export async function authenticateUserByEmail({ email, password }) {
  if (isDbEnabled()) return dbStore.authenticateUserByEmail({ email, password });
  await loadIfNeeded();
  if (!isPasswordAuthEnabled()) return null;
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const user = users.find((u) => normalizeEmail(u?.email) === normalizedEmail);
  if (!user) return null;
  if (!user.passwordSalt || !user.passwordHash) return null;

  try {
    const result = await verifyPasswordForUserRecord(user, password);
    if (!result.ok) return null;

    if (result.upgraded) {
      const newSalt = base64Url(crypto.randomBytes(16));
      user.passwordSalt = newSalt;
      user.passwordHash = await hashPassword(password, newSalt, { pepper: getPasswordPepper() });
      user.updatedAt = new Date().toISOString();
      await persist();
    }

    return toPublicUser(user);
  } catch {
    return null;
  }
}

export async function createSession(userId, { ttlDays = 30 } = {}) {
  if (isDbEnabled()) return dbStore.createSession(userId, { ttlDays });
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
  if (isDbEnabled()) return dbStore.deleteSession(token);
  await loadIfNeeded();
  const t = String(token || '');
  const before = sessions.length;
  sessions = sessions.filter((s) => s.token !== t);
  if (sessions.length !== before) await persist();
}

export async function getUserBySessionToken(token) {
  if (isDbEnabled()) return dbStore.getUserBySessionToken(token);
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
  if (isDbEnabled()) return dbStore.getUserRecordById(userId);
  await loadIfNeeded();
  return users.find((u) => u.id === userId) || null;
}

export async function findOrCreateUserForIdentity({ provider, subject, email, displayName } = {}) {
  if (isDbEnabled()) return dbStore.findOrCreateUserForIdentity({ provider, subject, email, displayName });
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
  if (isDbEnabled()) return dbStore.getPublicUserById(userId);
  const rec = await getUserRecordById(userId);
  return rec ? toPublicUser(rec) : null;
}

export async function updateMyProfile(userId, patch) {
  if (isDbEnabled()) return dbStore.updateMyProfile(userId, patch);
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
  if (isDbEnabled()) return dbStore.toggleFollow(followerId, followeeId);
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
  if (isDbEnabled()) return dbStore.getFollowingIds(userId);
  const rec = await getUserRecordById(userId);
  const ids = rec?.followingIds;
  return Array.isArray(ids) ? ids.map(String) : [];
}

export async function listPublicUsers({ limit = 50 } = {}) {
  if (isDbEnabled()) return dbStore.listPublicUsers({ limit });
  await loadIfNeeded();
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  return users.slice(0, safeLimit).map(toPublicUser);
}

export async function getAdminUserMetrics() {
  if (isDbEnabled()) return dbStore.getAdminUserMetrics();
  await loadIfNeeded();
  return {
    totalUsers: users.length,
    users: users.map((u) => ({
      id: String(u?.id || ''),
      createdAt: String(u?.createdAt || ''),
    })),
  };
}

export async function listAdminUsers({ limit = 50, offset = 0, includeEmail = false } = {}) {
  if (isDbEnabled()) return dbStore.listAdminUsers({ limit, offset, includeEmail });
  await loadIfNeeded();
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 50));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const slice = users.slice(safeOffset, safeOffset + safeLimit);
  return {
    total: users.length,
    users: slice.map((u) => ({
      id: String(u?.id || ''),
      handle: String(u?.handle || ''),
      displayName: String(u?.displayName || u?.handle || ''),
      bio: String(u?.bio || ''),
      email: includeEmail ? String(u?.email || '') : undefined,
      createdAt: String(u?.createdAt || ''),
      updatedAt: String(u?.updatedAt || ''),
    })),
  };
}

export function toPublicUser(user) {
  if (isDbEnabled()) return dbStore.toPublicUser(user);
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
