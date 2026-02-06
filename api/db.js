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

export async function dbQuery(text, params) {
  const p = getPool();
  if (!p) throw new Error('DATABASE_URL is not set');
  return p.query(text, params);
}
