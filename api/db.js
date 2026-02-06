import pg from 'pg';

let pool;

function buildPool() {
  const connectionString = String(process.env.DATABASE_URL || '').trim();
  if (!connectionString) return null;

  // Neon requires SSL. In serverless/proxy environments, rejectUnauthorized can fail.
  // Neon recommends setting ssl: { rejectUnauthorized: false } for many Node setups.
  return new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: Number(process.env.DB_POOL_MAX || 5),
  });
}

export function getPool() {
  if (pool !== undefined) return pool;
  pool = buildPool();
  return pool;
}

export function isDbEnabled() {
  return Boolean(String(process.env.DATABASE_URL || '').trim());
}

export function getDbDebugInfo() {
  const raw = String(process.env.DATABASE_URL || '').trim();
  if (!raw) {
    return { enabled: false };
  }
  try {
    const u = new URL(raw);
    const sslmode = u.searchParams.get('sslmode');
    return {
      enabled: true,
      host: u.hostname || undefined,
      database: (u.pathname || '').replace(/^\//, '') || undefined,
      sslmode: sslmode || undefined,
    };
  } catch (e) {
    return {
      enabled: true,
      parseError: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function dbQuery(text, params) {
  const p = getPool();
  if (!p) throw new Error('DATABASE_URL is not set');
  return p.query(text, params);
}
