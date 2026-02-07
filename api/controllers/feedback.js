import { checkRateLimit } from '../lib/rate-limit.js';
import { getClientIdentifier } from '../lib/client-id.js';
import { createFeedbackEntry } from '../feedbackStore.js';


function toOptionalString(value, maxLen) {
  if (value === null || value === undefined) return undefined;
  const str = String(value).trim();
  if (!str) return undefined;
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

function toOptionalBoolean(value) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

export async function submitFeedback(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientId = getClientIdentifier(req);
  if (!checkRateLimit(clientId)) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please wait a minute and try again.',
    });
  }

  try {
    const body = req.body || {};

    const category = toOptionalString(body.category, 40);
    const title = toOptionalString(body.title, 120);
    const message = toOptionalString(body.message, 5000);
    const steps = toOptionalString(body.steps, 5000);
    const expected = toOptionalString(body.expected, 2000);
    const actual = toOptionalString(body.actual, 2000);
    const device = toOptionalString(body.device, 120);
    const browser = toOptionalString(body.browser, 120);
    const contact = toOptionalString(body.contact, 160);
    const name = toOptionalString(body.name, 80);
    const allowFollowUp = toOptionalBoolean(body.allowFollowUp) ?? false;
    const rating = toOptionalString(body.rating, 10);
    const mood = toOptionalString(body.mood, 80);
    const diagnostics = toOptionalString(body.diagnostics, 12000);

    const hasAnyContent = Boolean(title || message || steps || expected || actual);
    if (!hasAnyContent) {
      return res.status(400).json({
        error: 'Bad request',
        message: '内容（タイトル・本文・再現手順など）のいずれかを入力してください。',
      });
    }

    const entry = createFeedbackEntry({
      category,
      title,
      message,
      steps,
      expected,
      actual,
      device,
      browser,
      contact,
      name,
      allowFollowUp,
      rating,
      mood,
      diagnostics,
      meta: {
        ip: clientId,
        userAgent: toOptionalString(req.headers['user-agent'], 240),
        referrer: toOptionalString(req.headers['referer'], 240),
      },
    });

    return res.status(201).json({
      ok: true,
      id: entry.id,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
