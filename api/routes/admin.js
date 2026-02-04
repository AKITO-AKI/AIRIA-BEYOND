import express from 'express';
import { getUsage, getJobs } from '../controllers/admin.js';
import { listAuditEvents, subscribeAuditSse } from '../lib/auditLog.js';
import { getAdminUserMetrics } from '../authStore.js';

const router = express.Router();

const authMiddleware = (req, res, next) => {
  const expected = String(process.env.ADMIN_TOKEN || '');
  if (!expected) {
    return res.status(500).json({ error: 'Server misconfigured', message: 'ADMIN_TOKEN is not set' });
  }

  const authHeader = req.headers.authorization;
  const headerToken = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '';
  const queryToken = typeof req.query?.token === 'string' ? req.query.token : '';
  const token = headerToken || queryToken;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  if (token !== expected) {
    return res.status(403).json({ error: 'Forbidden: Invalid admin token' });
  }

  next();
};

router.get('/usage', authMiddleware, getUsage);

router.get('/jobs', authMiddleware, getJobs);

router.delete('/jobs', authMiddleware, getJobs);

router.get('/audit', authMiddleware, (req, res) => {
  const limit = Number(req.query.limit ?? 200);
  const sinceId = req.query.sinceId;
  const type = String(req.query.type || '');
  const actorId = String(req.query.actorId || '');
  const events = listAuditEvents({ limit, sinceId, type, actorId });
  return res.json({ events, now: new Date().toISOString() });
});

router.get('/audit/stream', authMiddleware, (req, res) => {
  subscribeAuditSse(req, res);
});

function dayKeyUtc(iso) {
  try {
    const d = new Date(String(iso || ''));
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function buildSeries(days, entries) {
  const out = [];
  const now = new Date();
  // UTC midnight anchors for consistent buckets
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(end.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, value: Number(entries[key] || 0) });
  }
  return out;
}

router.get('/metrics', authMiddleware, async (req, res) => {
  try {
    const days = Math.max(1, Math.min(120, Number(req.query.days ?? 30) || 30));

    const userMetrics = await getAdminUserMetrics();
    const userBuckets = {};
    for (const u of userMetrics.users || []) {
      const key = dayKeyUtc(u?.createdAt);
      if (!key) continue;
      userBuckets[key] = Number(userBuckets[key] || 0) + 1;
    }

    const actionBuckets = {};
    const allEvents = listAuditEvents({ limit: 20000 });
    for (const e of allEvents) {
      const key = dayKeyUtc(e?.ts);
      if (!key) continue;
      actionBuckets[key] = Number(actionBuckets[key] || 0) + 1;
    }

    const usersPerDay = buildSeries(days, userBuckets);
    const actionsPerDay = buildSeries(days, actionBuckets);

    let cumulative = 0;
    const totalUsersByDay = usersPerDay.map((p) => {
      cumulative += Number(p.value || 0);
      return { day: p.day, value: cumulative };
    });

    const totalUsers = Number(userMetrics.totalUsers || 0);
    const totalActions = allEvents.length;

    return res.json({
      now: new Date().toISOString(),
      days,
      totals: {
        users: totalUsers,
        actions: totalActions,
      },
      series: {
        newUsersPerDay: usersPerDay,
        totalUsersPerDay,
        actionsPerDay,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
