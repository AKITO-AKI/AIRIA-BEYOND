import { checkRateLimit } from '../lib/rate-limit.js';
import { addComment, createPost, likePost, listPosts } from '../socialStore.js';

function getClientIdentifier(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || 'unknown';
}

export async function getPosts(req, res) {
  try {
    const limit = Number(req.query.limit ?? 50);
    const posts = await listPosts({ limit });
    return res.json({ posts });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function createPostHandler(req, res) {
  const clientId = getClientIdentifier(req);
  if (!checkRateLimit(clientId)) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please wait a minute and try again.',
    });
  }

  try {
    const { authorName, caption, album } = req.body || {};
    const created = await createPost({ authorName, caption, album });
    return res.status(201).json(created);
  } catch (error) {
    return res.status(400).json({
      error: 'Bad request',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function likePostHandler(req, res) {
  const clientId = getClientIdentifier(req);
  if (!checkRateLimit(clientId)) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please wait a minute and try again.',
    });
  }

  try {
    const updated = await likePost(req.params.id);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function commentPostHandler(req, res) {
  const clientId = getClientIdentifier(req);
  if (!checkRateLimit(clientId)) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please wait a minute and try again.',
    });
  }

  try {
    const { authorName, text } = req.body || {};
    const created = await addComment(req.params.id, { authorName, text });
    if (!created) return res.status(404).json({ error: 'Not found' });
    return res.status(201).json(created);
  } catch (error) {
    return res.status(400).json({
      error: 'Bad request',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
