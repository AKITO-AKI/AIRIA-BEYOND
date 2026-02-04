import nodemailer from 'nodemailer';

const sentDedupe = new Map();

function nowMs() {
  return Date.now();
}

function dedupeOnce(key, ttlMs) {
  const now = nowMs();
  const hit = sentDedupe.get(key);
  if (hit && hit > now) return false;
  sentDedupe.set(key, now + ttlMs);

  // naive cleanup
  if (sentDedupe.size > 2000) {
    for (const [k, exp] of sentDedupe.entries()) {
      if (exp <= now) sentDedupe.delete(k);
      if (sentDedupe.size <= 1500) break;
    }
  }

  return true;
}

function envBool(name, fallback = false) {
  const v = String(process.env[name] ?? '').trim().toLowerCase();
  if (!v) return fallback;
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function envStr(name) {
  return String(process.env[name] ?? '').trim();
}

function normalizeEmail(email) {
  const e = String(email || '').trim();
  if (!e || !e.includes('@')) return '';
  return e.slice(0, 254);
}

function getPublicUrl() {
  return envStr('APP_PUBLIC_URL') || 'https://akito-aki.github.io/AIRIA-BEYOND/';
}

export function isEmailNotificationsEnabled() {
  return envBool('EMAIL_NOTIFICATIONS_ENABLED', false);
}

function getFromAddress() {
  return envStr('EMAIL_FROM');
}

function hasResend() {
  return Boolean(envStr('RESEND_API_KEY'));
}

function hasSmtp() {
  return Boolean(envStr('SMTP_HOST'));
}

async function sendViaResend({ to, subject, html, text }) {
  const apiKey = envStr('RESEND_API_KEY');
  const from = getFromAddress();
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');
  if (!from) throw new Error('EMAIL_FROM is not configured');

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  const json = await resp.json().catch(() => null);
  if (!resp.ok) {
    const msg = json?.message || json?.error || `Resend failed: ${resp.status}`;
    throw new Error(msg);
  }

  return { provider: 'resend', id: json?.id || null };
}

async function sendViaSmtp({ to, subject, html, text }) {
  const host = envStr('SMTP_HOST');
  const port = Number(envStr('SMTP_PORT') || '587');
  const secure = envBool('SMTP_SECURE', false);
  const user = envStr('SMTP_USER');
  const pass = envStr('SMTP_PASS');
  const from = getFromAddress();

  if (!host) throw new Error('SMTP_HOST is not configured');
  if (!from) throw new Error('EMAIL_FROM is not configured');

  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });

  const info = await transport.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  return { provider: 'smtp', id: info?.messageId || null };
}

export async function sendEmail({ to, subject, html, text, dedupeKey, dedupeTtlMs = 10 * 60 * 1000 }) {
  const emailTo = normalizeEmail(to);
  if (!emailTo) return { skipped: true, reason: 'invalid recipient email' };

  if (!isEmailNotificationsEnabled()) {
    return { skipped: true, reason: 'EMAIL_NOTIFICATIONS_ENABLED is false' };
  }

  if (dedupeKey && !dedupeOnce(`email:${dedupeKey}`, dedupeTtlMs)) {
    return { skipped: true, reason: 'deduped' };
  }

  const safeSubject = String(subject || '').slice(0, 140) || 'AIRIA';
  const safeText = String(text || '').slice(0, 20000);
  const safeHtml = String(html || '').slice(0, 200000);

  if (hasResend()) {
    return sendViaResend({ to: emailTo, subject: safeSubject, html: safeHtml, text: safeText });
  }
  if (hasSmtp()) {
    return sendViaSmtp({ to: emailTo, subject: safeSubject, html: safeHtml, text: safeText });
  }

  return { skipped: true, reason: 'No email provider configured (RESEND_API_KEY or SMTP_HOST)' };
}

export function makeEngagementEmail({ kind, actorName, postTitle }) {
  const appUrl = getPublicUrl();
  const title = String(postTitle || 'あなたの投稿');
  const actor = String(actorName || '誰か');

  const subject =
    kind === 'comment'
      ? `${actor} がコメントしました: ${title}`
      : kind === 'like'
      ? `${actor} がいいねしました: ${title}`
      : kind === 'follow'
      ? `${actor} がフォローしました`
      : `AIRIA 通知`;

  const text = `${subject}\n\nAIRIA: ${appUrl}`;
  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.6">
      <h2 style="margin: 0 0 8px">${escapeHtml(subject)}</h2>
      <p style="margin: 0 0 12px; color: #444">AIRIAでの反応をお知らせします。</p>
      <a href="${escapeAttr(appUrl)}" style="display:inline-block; padding:10px 14px; background:#111; color:#fff; text-decoration:none; border-radius:999px">AIRIAを開く</a>
      <p style="margin: 14px 0 0; font-size: 12px; color:#666">設定で通知ON/OFFは次の更新で対応します。</p>
    </div>
  `;

  return { subject, text, html };
}

export function makeGenerationEmail({ albumTitle }) {
  const appUrl = getPublicUrl();
  const title = String(albumTitle || 'あなたの作品');
  const subject = `生成が完了しました: ${title}`;
  const text = `${subject}\n\nAIRIA: ${appUrl}`;
  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.6">
      <h2 style="margin: 0 0 8px">${escapeHtml(subject)}</h2>
      <p style="margin: 0 0 12px; color: #444">音楽生成が完了しました。アプリで確認できます。</p>
      <a href="${escapeAttr(appUrl)}" style="display:inline-block; padding:10px 14px; background:#111; color:#fff; text-decoration:none; border-radius:999px">AIRIAを開く</a>
    </div>
  `;
  return { subject, text, html };
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/\n/g, '');
}
