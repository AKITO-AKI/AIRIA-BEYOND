import { checkRateLimit } from '../lib/rate-limit.js';
import { addCommentV2, createPostV2, listPosts, toggleLike } from '../socialStore.js';
import { getFollowingIds, getPublicUserById, toggleFollow } from '../authStore.js';

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
    const mode = String(req.query.mode || 'all');

    const all = await listPosts({ limit: 100 });
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));

    let filtered = all;
    if (mode === 'following') {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Login is required for following feed',
        });
      }
      const following = await getFollowingIds(req.user.id);
      filtered = all.filter((p) => p?.authorId && following.includes(String(p.authorId)));
    }

    if (mode === 'trending') {
      filtered = filtered
        .slice()
        .sort((a, b) => {
          const diff = Number(b?.likes || 0) - Number(a?.likes || 0);
          if (diff !== 0) return diff;
          return String(b.createdAt).localeCompare(String(a.createdAt));
        });
    }

    const viewerId = req.user?.id ? String(req.user.id) : '';

    const posts = await Promise.all(
      filtered.slice(0, safeLimit).map(async (post) => {
        const author = post?.authorId ? await getPublicUserById(String(post.authorId)) : null;
        const authorName = author ? String(author.displayName || `@${author.handle}`) : String(post?.authorName || 'anonymous');

        const likedBy = Array.isArray(post?.likedBy) ? post.likedBy.map(String) : [];
        const viewerHasLiked = viewerId ? likedBy.includes(viewerId) : false;

        const comments = Array.isArray(post?.comments) ? post.comments : [];
        const hydratedComments = await Promise.all(
          comments.map(async (c) => {
            const cAuthor = c?.authorId ? await getPublicUserById(String(c.authorId)) : null;
            const cAuthorName = cAuthor ? String(cAuthor.displayName || `@${cAuthor.handle}`) : String(c?.authorName || 'anonymous');
            return {
              ...c,
              author: cAuthor,
              authorName: cAuthorName,
            };
          })
        );

        return {
          ...post,
          author,
          authorName,
          viewerHasLiked,
          comments: hydratedComments,
        };
      })
    );

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
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Login is required to post',
      });
    }

    const { caption, album } = req.body || {};
    const created = await createPostV2({ authorId: req.user.id, caption, album });
    const author = await getPublicUserById(req.user.id);
    return res.status(201).json({
      ...created,
      author,
      authorName: author ? String(author.displayName || `@${author.handle}`) : 'anonymous',
      viewerHasLiked: false,
    });
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
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Login is required to like',
      });
    }

    const updated = await toggleLike(req.params.id, req.user.id);
    if (!updated) return res.status(404).json({ error: 'Not found' });

    const author = updated?.authorId ? await getPublicUserById(String(updated.authorId)) : null;
    const authorName = author ? String(author.displayName || `@${author.handle}`) : String(updated?.authorName || 'anonymous');
    const likedBy = Array.isArray(updated?.likedBy) ? updated.likedBy.map(String) : [];

    return res.json({
      ...updated,
      author,
      authorName,
      viewerHasLiked: likedBy.includes(String(req.user.id)),
    });
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
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Login is required to comment',
      });
    }

    const { text } = req.body || {};
    const created = await addCommentV2(req.params.id, { authorId: req.user.id, text });
    if (!created) return res.status(404).json({ error: 'Not found' });

    const author = await getPublicUserById(req.user.id);
    const authorName = author ? String(author.displayName || `@${author.handle}`) : 'anonymous';
    return res.status(201).json({
      ...created,
      author,
      authorName,
    });
  } catch (error) {
    return res.status(400).json({
      error: 'Bad request',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function followToggleHandler(req, res) {
  const clientId = getClientIdentifier(req);
  if (!checkRateLimit(clientId)) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please wait a minute and try again.',
    });
  }

  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Login is required to follow',
      });
    }
    const targetUserId = String(req.params.id || '');
    const result = await toggleFollow(req.user.id, targetUserId);
    return res.json(result);
  } catch (error) {
    return res.status(400).json({
      error: 'Bad request',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
