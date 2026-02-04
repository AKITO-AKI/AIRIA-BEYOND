const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '');

export const AUTH_TOKEN_STORAGE_KEY = 'airia_auth_token_v1';

export interface AuthUser {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  createdAt: string;
  updatedAt: string;
  followingIds: string[];
}

export function getAuthToken(): string {
  try {
    return String(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || '');
  } catch {
    return '';
  }
}

export function setAuthToken(token: string | null) {
  try {
    if (!token) localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    else localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  } catch {
    // ignore
  }
}

export async function authFetch(input: string, init: RequestInit = {}) {
  const token = getAuthToken();
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

async function readJsonSafe(response: Response) {
  return response.json().catch(() => null);
}

export async function register(input: { handle: string; password: string; displayName?: string }) {
  const response = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await readJsonSafe(response);
  if (!response.ok) throw new Error(json?.message || `Failed to register: ${response.status}`);
  return json as { token: string; expiresAt: string; user: AuthUser };
}

export async function registerWithEmail(input: { email: string; password: string; displayName?: string; handle?: string }) {
  const response = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await readJsonSafe(response);
  if (!response.ok) throw new Error(json?.message || `Failed to register: ${response.status}`);
  return json as { token: string; expiresAt: string; user: AuthUser };
}

export async function login(input: { handle: string; password: string }) {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await readJsonSafe(response);
  if (!response.ok) throw new Error(json?.message || `Failed to login: ${response.status}`);
  return json as { token: string; expiresAt: string; user: AuthUser };
}

export async function loginWithEmail(input: { email: string; password: string }) {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await readJsonSafe(response);
  if (!response.ok) throw new Error(json?.message || `Failed to login: ${response.status}`);
  return json as { token: string; expiresAt: string; user: AuthUser };
}

export async function oauthLogin(provider: 'google' | 'apple', input: { idToken: string; user?: any }) {
  const response = await fetch(`${API_BASE}/api/auth/oauth/${encodeURIComponent(provider)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await readJsonSafe(response);
  if (!response.ok) throw new Error(json?.message || `Failed to login: ${response.status}`);
  return json as { token: string; expiresAt: string; user: AuthUser };
}

export async function me() {
  const response = await authFetch(`${API_BASE}/api/auth/me`);
  const json = await readJsonSafe(response);
  if (!response.ok) throw new Error(json?.message || `Failed to load me: ${response.status}`);
  return json as { user: AuthUser | null };
}

export async function logout() {
  const response = await authFetch(`${API_BASE}/api/auth/logout`, { method: 'POST' });
  const json = await readJsonSafe(response);
  if (!response.ok) throw new Error(json?.message || `Failed to logout: ${response.status}`);
  return json as { ok: true };
}

export async function updateProfile(input: { displayName?: string; bio?: string }) {
  const response = await authFetch(`${API_BASE}/api/auth/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await readJsonSafe(response);
  if (!response.ok) throw new Error(json?.message || `Failed to update profile: ${response.status}`);
  return json as { user: AuthUser };
}
