import { checkRateLimit } from '../lib/rate-limit.js';
import { verifyAppleIdToken, verifyGoogleIdToken } from '../lib/oidc.js';
import { appendAuditEventFromReq } from '../lib/auditLog.js';
import {
  authenticateUser,
  authenticateUserByEmail,
  createSession,
  deleteSession,
  findOrCreateUserForIdentity,
  getPublicUserById,
  getUserRecordById,
  getUserBySessionToken,
  registerUser,
  updateMyProfile,
} from '../authStore.js';

function isPasswordAuthEnabled() {
  const allow = String(process.env.AUTH_ALLOW_PASSWORD || '').trim().toLowerCase();
  if (allow === 'true') return true;
  if (allow === 'false') return false;
  // Default to enabled for pre-release unless explicitly disabled.
  return true;
}

function isOAuthDisabled() {
  const v = String(process.env.AUTH_DISABLE_OAUTH || '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

function getClientIdentifier(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || 'unknown';
}

function getBearerToken(req) {
  const header = req.headers?.authorization;
  if (!header || typeof header !== 'string') return '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

export async function registerHandler(req, res) {
  if (!isPasswordAuthEnabled()) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Password registration is disabled. Please sign in with Google/Apple.',
    });
  }
  const clientId = getClientIdentifier(req);
  if (!checkRateLimit(clientId)) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please wait a minute and try again.',
    });
  }

  try {
    const { handle, email, password, displayName } = req.body || {};
    const user = await registerUser({ handle, email, password, displayName });
    const session = await createSession(user.id);
    const rec = await getUserRecordById(user.id);
    appendAuditEventFromReq(req, {
      type: 'auth.register',
      target: { kind: 'user', id: user.id },
      summary: `registered @${user.handle}`,
      data: { provider: 'password' },
    });
    return res.status(201).json({
      token: session.token,
      expiresAt: session.expiresAt,
      user: { ...user, followingIds: Array.isArray(rec?.followingIds) ? rec.followingIds : [] },
    });
  } catch (error) {
    return res.status(400).json({
      error: 'Bad request',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function loginHandler(req, res) {
  if (!isPasswordAuthEnabled()) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Password login is disabled. Please sign in with Google/Apple.',
    });
  }
  const clientId = getClientIdentifier(req);
  if (!checkRateLimit(clientId)) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please wait a minute and try again.',
    });
  }

  try {
    const { handle, email, password } = req.body || {};
    const handleOrEmail = String(handle || '').trim();
    const explicitEmail = String(email || '').trim();
    const looksLikeEmail = (explicitEmail || handleOrEmail).includes('@');
    const user = looksLikeEmail
      ? await authenticateUserByEmail({ email: explicitEmail || handleOrEmail, password })
      : await authenticateUser({ handle: handleOrEmail, password });
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
    }
    const session = await createSession(user.id);
    const rec = await getUserRecordById(user.id);
    appendAuditEventFromReq(req, {
      type: 'auth.login',
      target: { kind: 'user', id: user.id },
      summary: `login @${user.handle}`,
      data: { provider: 'password' },
    });
    return res.json({
      token: session.token,
      expiresAt: session.expiresAt,
      user: { ...user, followingIds: Array.isArray(rec?.followingIds) ? rec.followingIds : [] },
    });
  } catch (error) {
    return res.status(400).json({
      error: 'Bad request',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function meHandler(req, res) {
  try {
    const token = getBearerToken(req);
    if (!token) return res.json({ user: null });
    const user = await getUserBySessionToken(token);
    if (!user) return res.json({ user: null });
    const rec = await getUserRecordById(user.id);
    return res.json({
      user: { ...user, followingIds: Array.isArray(rec?.followingIds) ? rec.followingIds : [] },
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function logoutHandler(req, res) {
  try {
    const token = getBearerToken(req);
    if (token) {
      const user = await getUserBySessionToken(token);
      await deleteSession(token);
      if (user) {
        appendAuditEventFromReq(req, {
          type: 'auth.logout',
          target: { kind: 'user', id: user.id },
          summary: `logout @${user.handle}`,
        });
      }
    }
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function updateProfileHandler(req, res) {
  try {
    const token = getBearerToken(req);
    const me = token ? await getUserBySessionToken(token) : null;
    if (!me) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired session',
      });
    }

    const user = await updateMyProfile(me.id, req.body || {});
    const rec = await getUserRecordById(me.id);
    appendAuditEventFromReq(req, {
      type: 'auth.profile.update',
      target: { kind: 'user', id: me.id },
      summary: `profile updated @${me.handle}`,
      data: { fields: Object.keys(req.body || {}).slice(0, 10) },
    });
    return res.json({ user: { ...user, followingIds: Array.isArray(rec?.followingIds) ? rec.followingIds : [] } });
  } catch (error) {
    return res.status(400).json({
      error: 'Bad request',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function publicUserHandler(req, res) {
  try {
    const user = await getPublicUserById(String(req.params.id || ''));
    if (!user) return res.status(404).json({ error: 'Not found' });
    return res.json({ user });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function authConfigHandler(req, res) {
  try {
    const googleConfigured = !isOAuthDisabled() && Boolean(String(process.env.GOOGLE_CLIENT_ID || '').trim());
    const appleConfigured = !isOAuthDisabled() && Boolean(String(process.env.APPLE_CLIENT_ID || '').trim());
    return res.json({
      passwordEnabled: isPasswordAuthEnabled(),
      oauth: { google: googleConfigured, apple: appleConfigured },
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function oauthGoogleHandler(req, res) {
  if (isOAuthDisabled()) {
    return res.status(404).json({
      error: 'Not found',
      message: 'OAuth login is disabled',
    });
  }
  const clientId = getClientIdentifier(req);
  if (!checkRateLimit(clientId)) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please wait a minute and try again.',
    });
  }

  try {
    const { idToken } = req.body || {};
    const claims = await verifyGoogleIdToken(idToken);
    const user = await findOrCreateUserForIdentity({
      provider: claims.provider,
      subject: claims.subject,
      email: claims.email,
      displayName: claims.displayName,
    });
    const session = await createSession(user.id);
    const rec = await getUserRecordById(user.id);
    appendAuditEventFromReq(req, {
      type: 'auth.login',
      target: { kind: 'user', id: user.id },
      summary: `login @${user.handle}`,
      data: { provider: 'google', email: claims.email ? String(claims.email).slice(0, 254) : '' },
      actor: { id: user.id, handle: user.handle, displayName: user.displayName },
    });
    return res.json({
      token: session.token,
      expiresAt: session.expiresAt,
      user: { ...user, followingIds: Array.isArray(rec?.followingIds) ? rec.followingIds : [] },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes('not configured') ? 500 : 401;
    return res.status(status).json({
      error: status === 500 ? 'Server misconfigured' : 'Unauthorized',
      message,
    });
  }
}

export async function oauthAppleHandler(req, res) {
  if (isOAuthDisabled()) {
    return res.status(404).json({
      error: 'Not found',
      message: 'OAuth login is disabled',
    });
  }
  const clientId = getClientIdentifier(req);
  if (!checkRateLimit(clientId)) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please wait a minute and try again.',
    });
  }

  try {
    const { idToken, user: appleUser } = req.body || {};
    const claims = await verifyAppleIdToken(idToken);
    const first = String(appleUser?.name?.firstName || '').trim();
    const last = String(appleUser?.name?.lastName || '').trim();
    const appleName = `${first} ${last}`.trim();
    const displayName = claims.displayName || appleName || '';

    const user = await findOrCreateUserForIdentity({
      provider: claims.provider,
      subject: claims.subject,
      email: claims.email,
      displayName,
    });
    const session = await createSession(user.id);
    const rec = await getUserRecordById(user.id);
    appendAuditEventFromReq(req, {
      type: 'auth.login',
      target: { kind: 'user', id: user.id },
      summary: `login @${user.handle}`,
      data: { provider: 'apple', email: claims.email ? String(claims.email).slice(0, 254) : '' },
      actor: { id: user.id, handle: user.handle, displayName: user.displayName },
    });
    return res.json({
      token: session.token,
      expiresAt: session.expiresAt,
      user: { ...user, followingIds: Array.isArray(rec?.followingIds) ? rec.followingIds : [] },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes('not configured') ? 500 : 401;
    return res.status(status).json({
      error: status === 500 ? 'Server misconfigured' : 'Unauthorized',
      message,
    });
  }
}
