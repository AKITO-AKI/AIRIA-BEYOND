import crypto from 'crypto';
import { dbQuery, isDbEnabled } from './db.js';

let schemaReady = false;

function base64Url(buf) {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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

function makeStableHandleFromEmail(email) {
  const e = normalizeEmail(email);
  if (!e) return '';
  const local = e.split('@')[0] || '';
  const candidate = sanitizeHandle(local.replace(/[.-]/g, '_'));
  if (candidate) return candidate;
  const hash = crypto.createHash('sha256').update(`email:${e}`).digest('hex').slice(0, 14);
  return sanitizeHandle(`e_${hash}`) || `e_${hash.slice(0, 10)}`;
}

function makeStableHandleFromIdentity(provider, subject) {
  const p = String(provider || '').toLowerCase();
  const s = String(subject || '');
  const hash = crypto.createHash('sha256').update(`${p}:${s}`).digest('hex').slice(0, 14);
  const base = `${p[0] || 'u'}_${hash}`;
  return sanitizeHandle(base) || `u_${hash.slice(0, 10)}`;
}

function hashPassword(password, salt) {
  const pwd = String(password ?? '');
  if (!pwd) throw new Error('password is required');
  const key = crypto.scryptSync(pwd, salt, 32);
  return base64Url(key);
}

function isPasswordAuthEnabled() {
  const allow = String(process.env.AUTH_ALLOW_PASSWORD || '').trim().toLowerCase();
  if (allow === 'true') return true;
  if (allow === 'false') return false;
  return true;
}

async function ensureSchema() {
  if (schemaReady) return;
  if (!isDbEnabled()) throw new Error('DATABASE_URL is not set');

  await dbQuery(
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      handle TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT '',
      email TEXT UNIQUE,
      password_salt TEXT,
      password_hash TEXT,
      following_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );`
  );

  await dbQuery(
    `CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    );`
  );

  await dbQuery(
    `CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);`
  );

  await dbQuery(
    `CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);`
  );

  await dbQuery(
    `CREATE TABLE IF NOT EXISTS identities (
      provider TEXT NOT NULL,
      subject TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (provider, subject)
    );`
  );

  schemaReady = true;
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    handle: String(row.handle),
    displayName: String(row.display_name || row.handle),
    bio: String(row.bio || ''),
    email: row.email ? String(row.email) : '',
    passwordSalt: row.password_salt ? String(row.password_salt) : '',
    passwordHash: row.password_hash ? String(row.password_hash) : '',
    followingIds: Array.isArray(row.following_ids) ? row.following_ids.map(String) : [],
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
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

export async function getAuthStoreDebugInfo() {
  await ensureSchema();
  const usersRes = await dbQuery('SELECT COUNT(*)::int AS c FROM users');
  const sessionsRes = await dbQuery('SELECT COUNT(*)::int AS c FROM sessions');
  return {
    mode: 'postgres',
    database: 'DATABASE_URL',
    userCount: Number(usersRes.rows?.[0]?.c || 0),
    sessionCount: Number(sessionsRes.rows?.[0]?.c || 0),
    now: new Date().toISOString(),
  };
}

export async function registerUser({ handle, email, password, displayName }) {
  await ensureSchema();

  if (!isPasswordAuthEnabled()) {
    throw new Error('Password registration is disabled');
  }

  const normalizedEmail = normalizeEmail(email);
  const requestedHandle = sanitizeHandle(handle);
  const derivedHandle = !requestedHandle && normalizedEmail ? makeStableHandleFromEmail(normalizedEmail) : '';
  const baseHandle = requestedHandle || derivedHandle;
  if (!baseHandle) throw new Error('handle or email is required');

  const pwd = String(password ?? '');
  if (pwd.length < 6) throw new Error('password must be at least 6 characters');

  const salt = base64Url(crypto.randomBytes(16));
  const passwordHash = hashPassword(pwd, salt);

  // Allocate unique handle.
  let finalHandle = baseHandle;
  let counter = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const exists = await dbQuery('SELECT 1 FROM users WHERE lower(handle)=lower($1) LIMIT 1', [finalHandle]);
    if (!exists.rowCount) break;
    counter += 1;
    const suffix = String(counter).slice(0, 3);
    finalHandle = sanitizeHandle(`${baseHandle.slice(0, 16)}${suffix}`) || baseHandle;
    if (counter > 999) throw new Error('unable to allocate handle');
  }

  if (normalizedEmail) {
    const emailTaken = await dbQuery('SELECT 1 FROM users WHERE lower(email)=lower($1) LIMIT 1', [normalizedEmail]);
    if (emailTaken.rowCount) throw new Error('email is already registered');
  }

  const now = new Date();
  const userId = makeId('u');

  await dbQuery(
    `INSERT INTO users (id, handle, display_name, bio, email, password_salt, password_hash, following_ids, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)`,
    [
      userId,
      finalHandle,
      sanitizeText(displayName, 32) || finalHandle,
      '',
      normalizedEmail || null,
      salt,
      passwordHash,
      JSON.stringify([]),
      now,
      now,
    ]
  );

  const res = await dbQuery('SELECT * FROM users WHERE id=$1', [userId]);
  return toPublicUser(rowToUser(res.rows[0]));
}

export async function authenticateUser({ handle, password }) {
  await ensureSchema();
  if (!isPasswordAuthEnabled()) return null;

  const safeHandle = sanitizeHandle(handle);
  if (!safeHandle) return null;

  const res = await dbQuery('SELECT * FROM users WHERE lower(handle)=lower($1) LIMIT 1', [safeHandle]);
  if (!res.rowCount) return null;
  const user = rowToUser(res.rows[0]);
  if (!user.passwordSalt || !user.passwordHash) return null;

  try {
    const computed = hashPassword(password, String(user.passwordSalt || ''));
    const ok = crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(String(user.passwordHash || '')));
    return ok ? toPublicUser(user) : null;
  } catch {
    return null;
  }
}

export async function authenticateUserByEmail({ email, password }) {
  await ensureSchema();
  if (!isPasswordAuthEnabled()) return null;

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const res = await dbQuery('SELECT * FROM users WHERE lower(email)=lower($1) LIMIT 1', [normalizedEmail]);
  if (!res.rowCount) return null;
  const user = rowToUser(res.rows[0]);
  if (!user.passwordSalt || !user.passwordHash) return null;

  try {
    const computed = hashPassword(password, String(user.passwordSalt || ''));
    const ok = crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(String(user.passwordHash || '')));
    return ok ? toPublicUser(user) : null;
  } catch {
    return null;
  }
}

export async function createSession(userId, { ttlDays = 30 } = {}) {
  await ensureSchema();

  const u = await dbQuery('SELECT 1 FROM users WHERE id=$1', [String(userId || '')]);
  if (!u.rowCount) throw new Error('user not found');

  const now = Date.now();
  const token = base64Url(crypto.randomBytes(32));
  const expiresAt = new Date(now + ttlDays * 24 * 60 * 60 * 1000);

  await dbQuery(
    'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES ($1,$2,$3,$4)',
    [token, userId, new Date(now), expiresAt]
  );

  return { token, expiresAt: expiresAt.toISOString() };
}

export async function deleteSession(token) {
  await ensureSchema();
  const t = String(token || '');
  if (!t) return;
  await dbQuery('DELETE FROM sessions WHERE token=$1', [t]);
}

export async function getUserBySessionToken(token) {
  await ensureSchema();
  const t = String(token || '');
  if (!t) return null;

  // Cleanup expired sessions opportunistically.
  await dbQuery('DELETE FROM sessions WHERE expires_at <= NOW()');

  const s = await dbQuery(
    `SELECT u.*
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token=$1
      LIMIT 1`,
    [t]
  );

  if (!s.rowCount) return null;
  return toPublicUser(rowToUser(s.rows[0]));
}

export async function getUserRecordById(userId) {
  await ensureSchema();
  const res = await dbQuery('SELECT * FROM users WHERE id=$1 LIMIT 1', [String(userId || '')]);
  if (!res.rowCount) return null;
  const u = rowToUser(res.rows[0]);
  // Match file-store shape used by controllers/UI.
  return {
    id: u.id,
    handle: u.handle,
    displayName: u.displayName,
    bio: u.bio,
    email: u.email,
    passwordSalt: u.passwordSalt,
    passwordHash: u.passwordHash,
    followingIds: u.followingIds,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

export async function findOrCreateUserForIdentity({ provider, subject, email, displayName } = {}) {
  await ensureSchema();

  const p = normalizeProvider(provider);
  const s = normalizeSubject(subject);
  const e = normalizeEmail(email);

  const existing = await dbQuery(
    `SELECT u.*
       FROM identities i
       JOIN users u ON u.id=i.user_id
      WHERE i.provider=$1 AND i.subject=$2
      LIMIT 1`,
    [p, s]
  );

  if (existing.rowCount) {
    // Best-effort update email/display_name
    const u = rowToUser(existing.rows[0]);
    const now = new Date();
    if (e) {
      await dbQuery('UPDATE users SET email=COALESCE(email,$1), updated_at=$2 WHERE id=$3', [e, now, u.id]);
      await dbQuery('UPDATE identities SET email=COALESCE(email,$1) WHERE provider=$2 AND subject=$3', [e, p, s]);
    }
    if (displayName) {
      await dbQuery('UPDATE users SET display_name=COALESCE(display_name,$1), updated_at=$2 WHERE id=$3', [sanitizeText(displayName, 32), now, u.id]);
    }
    return toPublicUser({ ...u, email: e || u.email, updatedAt: now.toISOString() });
  }

  const handle = makeStableHandleFromIdentity(p, s);

  // Allocate unique handle
  let finalHandle = handle;
  let counter = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const exists = await dbQuery('SELECT 1 FROM users WHERE lower(handle)=lower($1) LIMIT 1', [finalHandle]);
    if (!exists.rowCount) break;
    counter += 1;
    const suffix = String(counter).slice(0, 3);
    finalHandle = sanitizeHandle(`${handle.slice(0, 16)}${suffix}`) || handle;
  }

  const now = new Date();
  const userId = makeId('u');

  await dbQuery(
    `INSERT INTO users (id, handle, display_name, bio, email, following_ids, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)`,
    [userId, finalHandle, sanitizeText(displayName, 32) || finalHandle, '', e || null, JSON.stringify([]), now, now]
  );

  await dbQuery(
    `INSERT INTO identities (provider, subject, user_id, email, created_at)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (provider, subject) DO NOTHING`,
    [p, s, userId, e || null, now]
  );

  const res = await dbQuery('SELECT * FROM users WHERE id=$1', [userId]);
  return toPublicUser(rowToUser(res.rows[0]));
}

export async function getPublicUserById(userId) {
  const rec = await getUserRecordById(userId);
  return rec ? toPublicUser(rec) : null;
}

export async function updateMyProfile(userId, patch) {
  await ensureSchema();
  const id = String(userId || '');
  if (!id) throw new Error('user not found');

  const now = new Date();
  const displayName = patch?.displayName !== undefined ? sanitizeText(patch.displayName, 32) : undefined;
  const bio = patch?.bio !== undefined ? sanitizeText(patch.bio, 160) : undefined;

  const current = await dbQuery('SELECT * FROM users WHERE id=$1 LIMIT 1', [id]);
  if (!current.rowCount) throw new Error('user not found');

  await dbQuery(
    `UPDATE users
        SET display_name = COALESCE($1, display_name),
            bio = COALESCE($2, bio),
            updated_at = $3
      WHERE id=$4`,
    [displayName ?? null, bio ?? null, now, id]
  );

  const res = await dbQuery('SELECT * FROM users WHERE id=$1 LIMIT 1', [id]);
  return toPublicUser(rowToUser(res.rows[0]));
}

export async function toggleFollow(followerId, followeeId) {
  await ensureSchema();
  if (!followerId || !followeeId) throw new Error('invalid user id');
  if (followerId === followeeId) throw new Error('cannot follow yourself');

  const fRes = await dbQuery('SELECT id, following_ids FROM users WHERE id=$1', [String(followerId)]);
  const eRes = await dbQuery('SELECT 1 FROM users WHERE id=$1', [String(followeeId)]);
  if (!fRes.rowCount || !eRes.rowCount) throw new Error('user not found');

  const followingIds = Array.isArray(fRes.rows[0]?.following_ids) ? fRes.rows[0].following_ids.map(String) : [];
  const idx = followingIds.indexOf(String(followeeId));

  let isFollowing;
  if (idx >= 0) {
    followingIds.splice(idx, 1);
    isFollowing = false;
  } else {
    followingIds.unshift(String(followeeId));
    // uniq + limit
    const uniq = Array.from(new Set(followingIds)).slice(0, 5000);
    followingIds.length = 0;
    followingIds.push(...uniq);
    isFollowing = true;
  }

  await dbQuery('UPDATE users SET following_ids=$1::jsonb, updated_at=$2 WHERE id=$3', [JSON.stringify(followingIds), new Date(), String(followerId)]);

  return { isFollowing, followingIds: followingIds.slice() };
}

export async function getFollowingIds(userId) {
  await ensureSchema();
  const res = await dbQuery('SELECT following_ids FROM users WHERE id=$1', [String(userId || '')]);
  if (!res.rowCount) return [];
  const ids = res.rows[0]?.following_ids;
  return Array.isArray(ids) ? ids.map(String) : [];
}

export async function listPublicUsers({ limit = 50 } = {}) {
  await ensureSchema();
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  const res = await dbQuery('SELECT * FROM users ORDER BY created_at DESC LIMIT $1', [safeLimit]);
  return res.rows.map((r) => toPublicUser(rowToUser(r)));
}

export async function getAdminUserMetrics() {
  await ensureSchema();
  const totalRes = await dbQuery('SELECT COUNT(*)::int AS c FROM users');
  const listRes = await dbQuery('SELECT id, created_at FROM users');
  return {
    totalUsers: Number(totalRes.rows?.[0]?.c || 0),
    users: listRes.rows.map((u) => ({ id: String(u.id), createdAt: new Date(u.created_at).toISOString() })),
  };
}
