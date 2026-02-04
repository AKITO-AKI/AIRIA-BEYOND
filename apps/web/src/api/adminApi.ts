const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '');

export const ADMIN_TOKEN_STORAGE_KEY = 'airia_admin_token_v1';

export type AuditEvent = {
  id: number;
  ts: string;
  type: string;
  severity?: string;
  actor?: { id: string; handle?: string; displayName?: string } | null;
  target?: { kind?: string; id?: string } | null;
  summary?: string;
  request?: { method?: string; path?: string; ip?: string; ua?: string } | null;
  data?: any;
};

export type AdminMetrics = {
  now: string;
  days: number;
  totals: {
    users: number;
    actions: number;
  };
  series: {
    newUsersPerDay: Array<{ day: string; value: number }>;
    totalUsersPerDay: Array<{ day: string; value: number }>;
    actionsPerDay: Array<{ day: string; value: number }>;
  };
};

export function getAdminToken(): string {
  try {
    return String(localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || '');
  } catch {
    return '';
  }
}

export function setAdminToken(token: string | null) {
  try {
    if (!token) localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    else localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
  } catch {
    // ignore
  }
}

async function readJsonSafe(response: Response) {
  return response.json().catch(() => null);
}

export async function listAuditEvents(params: { limit?: number; sinceId?: number; type?: string; actorId?: string }, token: string) {
  const url = new URL(`${API_BASE}/api/admin/audit`);
  if (params.limit !== undefined) url.searchParams.set('limit', String(params.limit));
  if (params.sinceId !== undefined) url.searchParams.set('sinceId', String(params.sinceId));
  if (params.type) url.searchParams.set('type', String(params.type));
  if (params.actorId) url.searchParams.set('actorId', String(params.actorId));

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await readJsonSafe(response);
  if (!response.ok) throw new Error(json?.message || json?.error || `Failed to load audit: ${response.status}`);
  return json as { events: AuditEvent[]; now: string };
}

export function getAuditStreamUrl(token: string) {
  const url = new URL(`${API_BASE}/api/admin/audit/stream`);
  // EventSource can't set Authorization header; server accepts token via query param for SSE.
  url.searchParams.set('token', token);
  return url.toString();
}

export async function getAdminMetrics(days: number, token: string) {
  const url = new URL(`${API_BASE}/api/admin/metrics`);
  url.searchParams.set('days', String(days || 30));
  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await readJsonSafe(response);
  if (!response.ok) throw new Error(json?.message || json?.error || `Failed to load metrics: ${response.status}`);
  return json as AdminMetrics;
}
