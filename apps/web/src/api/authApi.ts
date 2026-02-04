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

function looksLikeNetworkError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return /failed to fetch/i.test(msg) || /networkerror/i.test(msg) || /load failed/i.test(msg) || /timeout/i.test(msg);
}

function makeNetworkHelpMessage(action: string) {
  const base = API_BASE || '(empty)';
  const origin = (() => {
    try {
      return window.location.origin;
    } catch {
      return '(unknown)';
    }
  })();
  return [
    `${action} に失敗しました（通信エラー）`,
    `API: ${base}`,
    `Origin: ${origin}`,
    `原因候補: VITE_API_BASE_URL 未設定/誤り、APIサーバ停止、CORS未許可（Render側 APP_PUBLIC_URL / APP_ALLOWED_ORIGINS）`,
  ].join('\n');
}

function assertApiBaseIsUsable(action: string) {
  // In production builds, API_BASE can become '' if VITE_API_BASE_URL is not set.
  if (!API_BASE) {
    throw new Error(
      `${action} に失敗しました（API設定が未完了です）。\n` +
        `VITE_API_BASE_URL をバックエンド（例: https://airia-beyond.onrender.com）に設定して再デプロイしてください。`
    );
  }

  try {
    const pageProtocol = window.location.protocol;
    if (pageProtocol === 'https:' && /^http:\/\//i.test(API_BASE)) {
      throw new Error(
        `${action} に失敗しました（Mixed Content）。\n` +
          `HTTPS のページから HTTP の API（${API_BASE}）へは接続できません。API を https:// にするか、VITE_API_BASE_URL をHTTPSのURLにしてください。`
      );
    }
  } catch {
    // ignore
  }
}

async function assertJsonResponse(response: Response, json: any, action: string) {
  const ct = String(response.headers.get('content-type') || '').toLowerCase();
  if (json == null) {
    // Common case: API_BASE points to the frontend (SPA redirect) and returns HTML.
    if (response.ok && ct.includes('text/html')) {
      throw new Error(
        `${action} に失敗しました（API応答がHTMLでした）。VITE_API_BASE_URL がフロントに向いている可能性があります。`
      );
    }
    if (response.ok && !ct.includes('application/json')) {
      throw new Error(`${action} に失敗しました（API応答がJSONではありません）。API設定を確認してください。`);
    }
  }
}

export async function register(input: { handle: string; password: string; displayName?: string }) {
  try {
    assertApiBaseIsUsable('新規登録');
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const json = await readJsonSafe(response);
    await assertJsonResponse(response, json, '新規登録');
    if (!response.ok) throw new Error(json?.message || `Failed to register: ${response.status}`);
    if (!json?.token || !json?.user) throw new Error('新規登録に失敗しました（API応答が不正です）');
    return json as { token: string; expiresAt: string; user: AuthUser };
  } catch (e) {
    if (looksLikeNetworkError(e)) throw new Error(makeNetworkHelpMessage('新規登録'));
    throw e;
  }
}

export async function registerWithEmail(input: { email: string; password: string; displayName?: string; handle?: string }) {
  try {
    assertApiBaseIsUsable('新規登録');
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const json = await readJsonSafe(response);
    await assertJsonResponse(response, json, '新規登録');
    if (!response.ok) throw new Error(json?.message || `Failed to register: ${response.status}`);
    if (!json?.token || !json?.user) throw new Error('新規登録に失敗しました（API応答が不正です）');
    return json as { token: string; expiresAt: string; user: AuthUser };
  } catch (e) {
    if (looksLikeNetworkError(e)) throw new Error(makeNetworkHelpMessage('新規登録'));
    throw e;
  }
}

export async function login(input: { handle: string; password: string }) {
  try {
    assertApiBaseIsUsable('ログイン');
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const json = await readJsonSafe(response);
    await assertJsonResponse(response, json, 'ログイン');
    if (!response.ok) throw new Error(json?.message || `Failed to login: ${response.status}`);
    if (!json?.token || !json?.user) throw new Error('ログインに失敗しました（API応答が不正です）');
    return json as { token: string; expiresAt: string; user: AuthUser };
  } catch (e) {
    if (looksLikeNetworkError(e)) throw new Error(makeNetworkHelpMessage('ログイン'));
    throw e;
  }
}

export async function loginWithEmail(input: { email: string; password: string }) {
  try {
    assertApiBaseIsUsable('ログイン');
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const json = await readJsonSafe(response);
    await assertJsonResponse(response, json, 'ログイン');
    if (!response.ok) throw new Error(json?.message || `Failed to login: ${response.status}`);
    if (!json?.token || !json?.user) throw new Error('ログインに失敗しました（API応答が不正です）');
    return json as { token: string; expiresAt: string; user: AuthUser };
  } catch (e) {
    if (looksLikeNetworkError(e)) throw new Error(makeNetworkHelpMessage('ログイン'));
    throw e;
  }
}

export async function oauthLogin(provider: 'google' | 'apple', input: { idToken: string; user?: any }) {
  try {
    assertApiBaseIsUsable('ログイン');
    const response = await fetch(`${API_BASE}/api/auth/oauth/${encodeURIComponent(provider)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const json = await readJsonSafe(response);
    await assertJsonResponse(response, json, 'OAuthログイン');
    if (!response.ok) throw new Error(json?.message || `Failed to login: ${response.status}`);
    if (!json?.token || !json?.user) throw new Error('ログインに失敗しました（API応答が不正です）');
    return json as { token: string; expiresAt: string; user: AuthUser };
  } catch (e) {
    if (looksLikeNetworkError(e)) throw new Error(makeNetworkHelpMessage('ログイン'));
    throw e;
  }
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

export async function authConfig() {
  try {
    assertApiBaseIsUsable('認証設定の取得');
    const response = await fetch(`${API_BASE}/api/auth/config`);
    const json = await readJsonSafe(response);
    await assertJsonResponse(response, json, '認証設定の取得');
    if (!response.ok) throw new Error(json?.message || `Failed to load auth config: ${response.status}`);
    return json as { passwordEnabled: boolean; oauth: { enabled?: boolean; google: boolean; apple: boolean } };
  } catch (e) {
    if (looksLikeNetworkError(e)) throw new Error(makeNetworkHelpMessage('認証設定の取得'));
    throw e;
  }
}
