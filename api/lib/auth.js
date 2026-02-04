import { getUserBySessionToken } from '../authStore.js';

function getBearerToken(req) {
  const header = req.headers?.authorization;
  if (!header || typeof header !== 'string') return '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

export async function attachAuthUser(req, _res, next) {
  try {
    const token = getBearerToken(req);
    if (token) {
      const user = await getUserBySessionToken(token);
      if (user) req.user = user;
    }
  } catch {
    // ignore
  }
  next();
}

export async function requireAuth(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authorization Bearer token is required',
    });
  }

  const user = await getUserBySessionToken(token);
  if (!user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired session',
    });
  }

  req.user = user;
  next();
}
