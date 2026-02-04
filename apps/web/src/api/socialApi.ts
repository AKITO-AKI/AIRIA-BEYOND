const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '');

import { authFetch } from './authApi';

export interface SocialUserRef {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
}

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
  author?: SocialUserRef | null;
  text: string;
}

export interface SocialPost {
  id: string;
  createdAt: string;
  authorName: string;
  author?: SocialUserRef | null;
  caption: string;
  album: SocialAlbumRef;
  likes: number;
  viewerHasLiked?: boolean;
  comments: SocialComment[];
}

export async function listSocialPosts(limit = 50, mode: 'all' | 'following' | 'trending' = 'all'): Promise<{ posts: SocialPost[] }> {
  const response = await authFetch(
    `${API_BASE}/api/social/posts?limit=${encodeURIComponent(String(limit))}&mode=${encodeURIComponent(String(mode))}`
  );
  if (!response.ok) throw new Error(`Failed to load posts: ${response.status}`);
  return response.json();
}

export async function createSocialPost(input: {
  caption?: string;
  album: SocialAlbumRef;
}): Promise<SocialPost> {
  const response = await authFetch(`${API_BASE}/api/social/posts`, {
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
  const response = await authFetch(`${API_BASE}/api/social/posts/${encodeURIComponent(postId)}/like`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(json?.message || `Failed to like post: ${response.status}`);
  }
  return json;
}

export async function commentSocialPost(postId: string, input: { text: string }): Promise<SocialComment> {
  const response = await authFetch(`${API_BASE}/api/social/posts/${encodeURIComponent(postId)}/comments`, {
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

export async function toggleFollowUser(userId: string): Promise<{ isFollowing: boolean; followingIds: string[] }> {
  const response = await authFetch(`${API_BASE}/api/social/users/${encodeURIComponent(userId)}/follow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(json?.message || `Failed to follow: ${response.status}`);
  }
  return json;
}
