const base = process.env.SMOKE_BASE || 'http://localhost:3000';

function rand() {
  return Math.random().toString(16).slice(2, 8);
}

async function readText(res) {
  const text = await res.text();
  return { text, ct: res.headers.get('content-type') || '' };
}

async function main() {
  const email = `test_${Date.now()}_${rand()}@example.com`;
  const password = 'passw0rd!';

  const health = await fetch(`${base}/api/health`).then((r) => r.json()).catch(() => null);
  if (!health?.status) throw new Error(`API health check failed: ${base}`);

  const regRes = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName: 'Test User' }),
  });
  const regBody = await readText(regRes);
  console.log('register', regRes.status, regBody.ct);
  if (!regRes.ok) throw new Error(`register failed: ${regBody.text}`);
  const regJson = JSON.parse(regBody.text);
  if (!regJson?.token || !regJson?.user?.id) throw new Error('register returned invalid json');

  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const loginBody = await readText(loginRes);
  console.log('login', loginRes.status, loginBody.ct);
  if (!loginRes.ok) throw new Error(`login failed: ${loginBody.text}`);
  const loginJson = JSON.parse(loginBody.text);

  const meRes = await fetch(`${base}/api/auth/me`, {
    headers: { Authorization: `Bearer ${loginJson.token}` },
  });
  const meBody = await readText(meRes);
  console.log('me', meRes.status, meBody.ct);
  if (!meRes.ok) throw new Error(`me failed: ${meBody.text}`);

  console.log('ok', { email, userId: regJson.user.id });
}

main().catch((e) => {
  console.error('smoke-auth-local failed:', e?.message || e);
  process.exit(1);
});
