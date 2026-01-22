import type { VercelResponse } from '@vercel/node';

const ALLOWED_ORIGINS = [
  'https://airia-beyond.vercel.app',
  'https://akito-aki.github.io',
  process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : null,
  process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
].filter(Boolean) as string[];

export function setCorsHeaders(res: VercelResponse, origin?: string) {
  // Check if origin is allowed
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) 
    ? origin 
    : ALLOWED_ORIGINS[0];
  
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
}

export function handleCorsPreFlight(res: VercelResponse, origin?: string) {
  setCorsHeaders(res, origin);
  res.status(200).end();
}
