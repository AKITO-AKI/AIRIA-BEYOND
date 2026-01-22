const ALLOWED_ORIGINS = [
  'https://akito-aki.github.io',
  process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : null,
  process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
].filter(Boolean);

/**
 * Set CORS headers on response
 * @param {import('@vercel/node').VercelResponse} res - Vercel response object
 * @param {string} [origin] - Request origin
 */
export function setCorsHeaders(res, origin) {
  // Check if origin is allowed
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) 
    ? origin 
    : ALLOWED_ORIGINS[0];
  
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
}

/**
 * Handle CORS preflight request
 * @param {import('@vercel/node').VercelResponse} res - Vercel response object
 * @param {string} [origin] - Request origin
 */
export function handleCorsPreFlight(res, origin) {
  setCorsHeaders(res, origin);
  res.status(200).end();
}
