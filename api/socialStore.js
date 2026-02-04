import fs from 'fs/promises';
import path from 'path';

const DEFAULT_PATH = path.join(process.cwd(), 'api', 'data', 'social-posts.json');
const STORE_PATH = process.env.SOCIAL_STORE_PATH ? path.resolve(process.env.SOCIAL_STORE_PATH) : DEFAULT_PATH;

let loaded = false;
let posts = [];

async function ensureDirExists(filePath) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

async function loadIfNeeded() {
  if (loaded) return;
  loaded = true;

  try {
    const raw = await fs.readFile(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    posts = Array.isArray(parsed?.posts) ? parsed.posts : [];
  } catch {
    posts = [];
  }
}

async function persist() {
  await ensureDirExists(STORE_PATH);
  const payload = { version: 2, updatedAt: new Date().toISOString(), posts };
  await fs.writeFile(STORE_PATH, JSON.stringify(payload, null, 2), 'utf-8');
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeText(input, maxLen) {
  const str = String(input ?? '');
  const trimmed = str.replace(/\s+/g, ' ').trim();
  return trimmed.slice(0, maxLen);
}

export async function listPosts({ limit = 50 } = {}) {
  await loadIfNeeded();
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  return posts
    .slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, safeLimit);
}

export async function getPostById(postId) {
  await loadIfNeeded();
  const id = String(postId || '');
  if (!id) return null;
  return posts.find((p) => p && p.id === id) || null;
}

export async function createPost({ authorName, caption, album }) {
  await loadIfNeeded();

  const author = sanitizeText(authorName, 24) || 'anonymous';
  const cap = sanitizeText(caption, 240);

  const safeAlbum = album && typeof album === 'object'
    ? {
        title: sanitizeText(album.title, 80) || 'untitled',
        mood: sanitizeText(album.mood, 24) || '',
        imageUrl: String(album.imageUrl ?? '').slice(0, 2048),
        createdAt: album.createdAt ? String(album.createdAt) : null,
      }
    : null;

  if (!safeAlbum?.imageUrl) {
    throw new Error('album.imageUrl is required');
  }

  const post = {
    id: makeId('post'),
    createdAt: new Date().toISOString(),
    authorName: author,
    authorId: null,
    visibility: 'public',
    caption: cap,
    album: safeAlbum,
    likes: 0,
    likedBy: [],
    comments: [],
  };

  posts.unshift(post);
  await persist();
  return post;
}

export async function createPostV2({ authorId, caption, album }) {
  await loadIfNeeded();

  const cap = sanitizeText(caption, 240);
  const safeAuthorId = sanitizeText(authorId, 80);
  if (!safeAuthorId) throw new Error('authorId is required');

  const safeAlbum = album && typeof album === 'object'
    ? {
        title: sanitizeText(album.title, 80) || 'untitled',
        mood: sanitizeText(album.mood, 24) || '',
        imageUrl: String(album.imageUrl ?? '').slice(0, 2048),
        createdAt: album.createdAt ? String(album.createdAt) : null,
      }
    : null;

  if (!safeAlbum?.imageUrl) {
    throw new Error('album.imageUrl is required');
  }

  const post = {
    id: makeId('post'),
    createdAt: new Date().toISOString(),
    authorId: safeAuthorId,
    visibility: 'public',
    caption: cap,
    album: safeAlbum,
    likes: 0,
    likedBy: [],
    comments: [],
  };

  posts.unshift(post);
  await persist();
  return post;
}

function normalizeVisibility(input) {
  const v = String(input || 'public').toLowerCase();
  return v === 'private' ? 'private' : 'public';
}

export async function updatePostVisibilityV2(postId, { authorId, visibility }) {
  await loadIfNeeded();
  const id = String(postId || '');
  const uid = sanitizeText(authorId, 80);
  if (!id) throw new Error('postId is required');
  if (!uid) throw new Error('authorId is required');

  const post = posts.find((p) => p && p.id === id);
  if (!post) return null;
  if (String(post.authorId || '') !== uid) {
    const err = new Error('Forbidden');
    // @ts-ignore
    err.statusCode = 403;
    throw err;
  }

  post.visibility = normalizeVisibility(visibility);
  post.updatedAt = new Date().toISOString();
  await persist();
  return post;
}

export async function deletePostV2(postId, { authorId }) {
  await loadIfNeeded();
  const id = String(postId || '');
  const uid = sanitizeText(authorId, 80);
  if (!id) throw new Error('postId is required');
  if (!uid) throw new Error('authorId is required');

  const idx = posts.findIndex((p) => p && p.id === id);
  if (idx < 0) return null;
  const post = posts[idx];
  if (String(post.authorId || '') !== uid) {
    const err = new Error('Forbidden');
    // @ts-ignore
    err.statusCode = 403;
    throw err;
  }

  posts.splice(idx, 1);
  await persist();
  return { ok: true };
}

export async function likePost(postId) {
  await loadIfNeeded();
  const id = String(postId);
  const post = posts.find((p) => p.id === id);
  if (!post) return null;
  post.likes = Number(post.likes || 0) + 1;
  await persist();
  return post;
}

export async function toggleLike(postId, userId) {
  await loadIfNeeded();
  const id = String(postId);
  const uid = sanitizeText(userId, 80);
  if (!uid) throw new Error('userId is required');

  const post = posts.find((p) => p.id === id);
  if (!post) return null;

  post.likedBy = Array.isArray(post.likedBy) ? post.likedBy.map(String) : [];
  const idx = post.likedBy.indexOf(uid);
  if (idx >= 0) {
    post.likedBy.splice(idx, 1);
    post.likes = Math.max(0, Number(post.likes || 0) - 1);
  } else {
    post.likedBy.unshift(uid);
    post.likedBy = Array.from(new Set(post.likedBy)).slice(0, 20000);
    post.likes = Number(post.likes || 0) + 1;
  }

  await persist();
  return post;
}

export async function addComment(postId, { authorName, text }) {
  await loadIfNeeded();
  const id = String(postId);
  const post = posts.find((p) => p.id === id);
  if (!post) return null;

  const comment = {
    id: makeId('c'),
    createdAt: new Date().toISOString(),
    authorName: sanitizeText(authorName, 24) || 'anonymous',
    authorId: null,
    text: sanitizeText(text, 240),
  };

  if (!comment.text) {
    throw new Error('comment text is required');
  }

  post.comments = Array.isArray(post.comments) ? post.comments : [];
  post.comments.push(comment);
  await persist();
  return comment;
}

export async function addCommentV2(postId, { authorId, text }) {
  await loadIfNeeded();
  const id = String(postId);
  const post = posts.find((p) => p.id === id);
  if (!post) return null;

  const uid = sanitizeText(authorId, 80);
  if (!uid) throw new Error('authorId is required');

  const comment = {
    id: makeId('c'),
    createdAt: new Date().toISOString(),
    authorId: uid,
    text: sanitizeText(text, 240),
  };

  if (!comment.text) {
    throw new Error('comment text is required');
  }

  post.comments = Array.isArray(post.comments) ? post.comments : [];
  post.comments.push(comment);
  await persist();
  return comment;
}
