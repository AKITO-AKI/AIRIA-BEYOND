const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '');

export interface SocialAlbumRef {
  title: string;
  mood: string;
  imageUrl: string;
  createdAt?: string | null;
}

export interface SocialComment {
  id: string;
  createdAt: string;
  authorName: string;
  text: string;
}

export interface SocialPost {
  id: string;
  createdAt: string;
  authorName: string;
  caption: string;
  album: SocialAlbumRef;
  likes: number;
  comments: SocialComment[];
}

export async function listSocialPosts(limit = 50): Promise<{ posts: SocialPost[] }> {
  const response = await fetch(`${API_BASE}/api/social/posts?limit=${encodeURIComponent(String(limit))}`);
  if (!response.ok) throw new Error(`Failed to load posts: ${response.status}`);
  return response.json();
}

export async function createSocialPost(input: {
  authorName?: string;
  caption?: string;
  album: SocialAlbumRef;
}): Promise<SocialPost> {
  const response = await fetch(`${API_BASE}/api/social/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(json?.message || `Failed to create post: ${response.status}`);
  }
  return json;
}

export async function likeSocialPost(postId: string): Promise<SocialPost> {
  const response = await fetch(`${API_BASE}/api/social/posts/${encodeURIComponent(postId)}/like`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(json?.message || `Failed to like post: ${response.status}`);
  }
  return json;
}

export async function commentSocialPost(postId: string, input: { authorName?: string; text: string }): Promise<SocialComment> {
  const response = await fetch(`${API_BASE}/api/social/posts/${encodeURIComponent(postId)}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(json?.message || `Failed to comment: ${response.status}`);
  }
  return json;
}
