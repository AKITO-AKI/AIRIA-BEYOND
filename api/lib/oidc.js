import { createRemoteJWKSet, jwtVerify } from 'jose';

const googleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const appleJwks = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

function requireEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function normalizeMaybeString(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

export async function verifyGoogleIdToken(idToken) {
  const token = normalizeMaybeString(idToken);
  if (!token) throw new Error('idToken is required');

  const audience = requireEnv('GOOGLE_CLIENT_ID');
  const { payload } = await jwtVerify(token, googleJwks, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience,
  });

  const sub = normalizeMaybeString(payload.sub);
  if (!sub) throw new Error('Invalid Google token (missing sub)');

  return {
    provider: 'google',
    subject: sub,
    email: normalizeMaybeString(payload.email),
    emailVerified: Boolean(payload.email_verified),
    displayName: normalizeMaybeString(payload.name),
    pictureUrl: normalizeMaybeString(payload.picture),
  };
}

export async function verifyAppleIdToken(idToken) {
  const token = normalizeMaybeString(idToken);
  if (!token) throw new Error('idToken is required');

  const audience = requireEnv('APPLE_CLIENT_ID');
  const { payload } = await jwtVerify(token, appleJwks, {
    issuer: 'https://appleid.apple.com',
    audience,
  });

  const sub = normalizeMaybeString(payload.sub);
  if (!sub) throw new Error('Invalid Apple token (missing sub)');

  return {
    provider: 'apple',
    subject: sub,
    email: normalizeMaybeString(payload.email),
    emailVerified: String(payload.email_verified || '').toLowerCase() === 'true' || payload.email_verified === true,
    displayName: normalizeMaybeString(payload.name),
  };
}
