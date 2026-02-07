function normalizeHeaderIp(value) {
  if (typeof value !== 'string') return '';
  const first = value.split(',')[0]?.trim() || '';
  return first.slice(0, 128);
}

function normalizeRemoteAddress(value) {
  if (typeof value !== 'string') return '';
  // Node can format IPv4-in-IPv6 as ::ffff:1.2.3.4
  const v = value.startsWith('::ffff:') ? value.slice('::ffff:'.length) : value;
  return v.slice(0, 128);
}

function isLocalProxyAddress(addr) {
  const a = normalizeRemoteAddress(addr);
  return a === '127.0.0.1' || a === '::1' || a === '::';
}

/**
 * Derive a stable client identifier for rate limiting.
 *
 * Security note:
 * - We only trust `x-forwarded-for` / `x-real-ip` when the direct peer is localhost.
 *   This prevents trivial header spoofing when someone hits the Node port directly.
 */
export function getClientIdentifier(req) {
  const remote = normalizeRemoteAddress(req?.socket?.remoteAddress || '');
  if (isLocalProxyAddress(remote)) {
    const forwarded = normalizeHeaderIp(req?.headers?.['x-forwarded-for']);
    if (forwarded) return forwarded;
    const realIp = normalizeHeaderIp(req?.headers?.['x-real-ip']);
    if (realIp) return realIp;
  }

  return remote || 'unknown';
}
