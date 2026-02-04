import { checkRateLimit } from '../lib/rate-limit.js';
import { addCommentV2, createPostV2, deletePostV2, getPostById, listPosts, toggleLike, updatePostVisibilityV2 } from '../socialStore.js';
import { getFollowingIds, getPublicUserById, getUserRecordById, toggleFollow } from '../authStore.js';
import { makeEngagementEmail, sendEmail } from '../lib/notifications.js';

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

    // Visibility filter: show only public, or your own private posts.
    filtered = filtered.filter((p) => {
      const v = String(p?.visibility || 'public').toLowerCase();
      if (v !== 'private') return true;
      return viewerId && String(p?.authorId || '') === viewerId;
    });

    const posts = await Promise.all(
      filtered.slice(0, safeLimit).map(async (post) => hydratePostForViewer(post, viewerId))
    );

    return res.json({ posts });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function hydratePostForViewer(post, viewerId) {
  const author = post?.authorId ? await getPublicUserById(String(post.authorId)) : null;
  const authorName = author ? String(author.displayName || `@${author.handle}`) : String(post?.authorName || 'anonymous');

  const likedBy = Array.isArray(post?.likedBy) ? post.likedBy.map(String) : [];
  const viewerHasLiked = viewerId ? likedBy.includes(String(viewerId)) : false;

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
}

export async function getMyPosts(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Login is required',
      });
    }

    const limit = Number(req.query.limit ?? 50);
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
    const all = await listPosts({ limit: 200 });
    const mine = all.filter((p) => String(p?.authorId || '') === String(req.user.id));
    const posts = await Promise.all(mine.slice(0, safeLimit).map(async (p) => hydratePostForViewer(p, String(req.user.id))));
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

    const before = await getPostById(req.params.id);
    if (!before) return res.status(404).json({ error: 'Not found' });
    const vis = String(before?.visibility || 'public').toLowerCase();
    if (vis === 'private' && String(before?.authorId || '') !== String(req.user.id)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'This post is private',
      });
    }

    const updated = await toggleLike(req.params.id, req.user.id);
    if (!updated) return res.status(404).json({ error: 'Not found' });

    const author = updated?.authorId ? await getPublicUserById(String(updated.authorId)) : null;
    const authorName = author ? String(author.displayName || `@${author.handle}`) : String(updated?.authorName || 'anonymous');
    const likedBy = Array.isArray(updated?.likedBy) ? updated.likedBy.map(String) : [];
    const didLike = likedBy.includes(String(req.user.id));

    if (didLike && updated?.authorId && String(updated.authorId) !== String(req.user.id)) {
      const authorRec = await getUserRecordById(String(updated.authorId));
      const to = authorRec?.email;
      const actorName = String(req.user.displayName || `@${req.user.handle}`);
      const postTitle = String(updated?.album?.title || 'あなたの投稿');
      const { subject, text, html } = makeEngagementEmail({ kind: 'like', actorName, postTitle });
      await sendEmail({
        to,
        subject,
        text,
        html,
        dedupeKey: `like:${updated.id}:${req.user.id}`,
        dedupeTtlMs: 6 * 60 * 60 * 1000,
      }).catch((e) => {
        console.warn('[EmailNotifications] like notify failed:', e);
      });
    }

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

    const before = await getPostById(req.params.id);
    if (!before) return res.status(404).json({ error: 'Not found' });
    const vis = String(before?.visibility || 'public').toLowerCase();
    if (vis === 'private' && String(before?.authorId || '') !== String(req.user.id)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'This post is private',
      });
    }

    const { text } = req.body || {};
    const created = await addCommentV2(req.params.id, { authorId: req.user.id, text });
    if (!created) return res.status(404).json({ error: 'Not found' });

    const author = await getPublicUserById(req.user.id);
    const authorName = author ? String(author.displayName || `@${author.handle}`) : 'anonymous';

    // Notify post author (best-effort)
    const post = await getPostById(req.params.id);
    if (post?.authorId && String(post.authorId) !== String(req.user.id)) {
      const ownerRec = await getUserRecordById(String(post.authorId));
      const to = ownerRec?.email;
      const actorNameForEmail = String(req.user.displayName || `@${req.user.handle}`);
      const postTitle = String(post?.album?.title || 'あなたの投稿');
      const { subject, text: t, html } = makeEngagementEmail({ kind: 'comment', actorName: actorNameForEmail, postTitle });
      await sendEmail({
        to,
        subject,
        text: t,
        html,
        dedupeKey: `comment:${post.id}:${created.id}`,
        dedupeTtlMs: 24 * 60 * 60 * 1000,
      }).catch((e) => {
        console.warn('[EmailNotifications] comment notify failed:', e);
      });
    }

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

export async function updatePostHandler(req, res) {
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
        message: 'Login is required',
      });
    }

    const visibility = req.body?.visibility;
    if (visibility === undefined) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'visibility is required',
      });
    }

    const updated = await updatePostVisibilityV2(req.params.id, { authorId: req.user.id, visibility });
    if (!updated) return res.status(404).json({ error: 'Not found' });

    const viewerId = String(req.user.id);
    const hydrated = await hydratePostForViewer(updated, viewerId);
    return res.json(hydrated);
  } catch (error) {
    // @ts-ignore
    const status = typeof error?.statusCode === 'number' ? error.statusCode : null;
    if (status === 403) {
      return res.status(403).json({ error: 'Forbidden', message: 'Only the author can update this post' });
    }
    return res.status(400).json({
      error: 'Bad request',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function deletePostHandler(req, res) {
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
        message: 'Login is required',
      });
    }

    const result = await deletePostV2(req.params.id, { authorId: req.user.id });
    if (!result) return res.status(404).json({ error: 'Not found' });
    return res.json({ ok: true });
  } catch (error) {
    // @ts-ignore
    const status = typeof error?.statusCode === 'number' ? error.statusCode : null;
    if (status === 403) {
      return res.status(403).json({ error: 'Forbidden', message: 'Only the author can delete this post' });
    }
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

    if (result?.isFollowing && targetUserId && targetUserId !== String(req.user.id)) {
      const followeeRec = await getUserRecordById(targetUserId);
      const to = followeeRec?.email;
      const actorName = String(req.user.displayName || `@${req.user.handle}`);
      const { subject, text, html } = makeEngagementEmail({ kind: 'follow', actorName, postTitle: '' });
      await sendEmail({
        to,
        subject,
        text,
        html,
        dedupeKey: `follow:${targetUserId}:${req.user.id}`,
        dedupeTtlMs: 24 * 60 * 60 * 1000,
      }).catch((e) => {
        console.warn('[EmailNotifications] follow notify failed:', e);
      });
    }

    return res.json(result);
  } catch (error) {
    return res.status(400).json({
      error: 'Bad request',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
