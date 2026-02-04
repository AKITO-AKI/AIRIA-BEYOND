import React from 'react';
import { useAlbums } from '../../contexts/AlbumContext';
import { useAuth } from '../../contexts/AuthContext';
import { useRoomNavigation } from '../../contexts/RoomNavigationContext';
import {
  commentSocialPost,
  createSocialPost,
  deleteSocialPost,
  likeSocialPost,
  listSocialPosts,
  toggleFollowUser,
  updateSocialPostVisibility,
  type SocialPost,
} from '../../api/socialApi';
import SegmentedControl from '../ui/SegmentedControl';
import AlbumCard from '../gallery/AlbumCard';
import Popover from '../ui/Popover';
import Menu from '../ui/Menu';
import Icon from '../ui/Icon';
import './SocialRoom.css';

const SocialRoom: React.FC = () => {
  const { albums, getSelectedAlbum, updateAlbum } = useAlbums();
  const selectedAlbum = getSelectedAlbum();
  const { navigateToRoom } = useRoomNavigation();

  const [posts, setPosts] = React.useState<SocialPost[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const { user: authUser, logout, updateFollowingIds } = useAuth();

  const [caption, setCaption] = React.useState('');
  const [albumId, setAlbumId] = React.useState<string>(selectedAlbum?.id || (albums[0]?.id ?? ''));
  const [publishing, setPublishing] = React.useState(false);

  const [commentDraftByPostId, setCommentDraftByPostId] = React.useState<Record<string, string>>({});
  const [commentingPostId, setCommentingPostId] = React.useState<string | null>(null);
  const [feedMode, setFeedMode] = React.useState<'all' | 'following' | 'trending'>('all');
  const [expandedPosts, setExpandedPosts] = React.useState<Record<string, boolean>>({});
  const [focusPostId, setFocusPostId] = React.useState<string | null>(null);

  const consumeFocusPostId = React.useCallback(() => {
    // 1) explicit hash: #social/<postId>
    try {
      const hash = String(window.location.hash || '');
      const m = hash.match(/^#social\/(.+)$/);
      if (m && m[1]) return decodeURIComponent(m[1]);
    } catch {
      // ignore
    }

    // 2) localStorage handoff from My page
    try {
      const key = 'airia_social_focus_post_v1';
      const stored = localStorage.getItem(key);
      if (stored) {
        localStorage.removeItem(key);
        return String(stored);
      }
    } catch {
      // ignore
    }
    return null;
  }, []);

  const copyPostLink = async (postId: string) => {
    const link = `${window.location.origin}/#social/${postId}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const input = document.createElement('input');
        input.value = link;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setError('リンクをコピーしました');
      setTimeout(() => setError(null), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await listSocialPosts(50, feedMode);
      setPosts(resp.posts || []);

      // If we have a focus target, expand it and scroll.
      const target = focusPostId || consumeFocusPostId();
      if (target) {
        setFocusPostId(target);
        setExpandedPosts((prev) => ({ ...prev, [target]: true }));
        window.setTimeout(() => {
          const el = document.querySelector(`[data-post-id="${CSS.escape(target)}"]`);
          if (el && 'scrollIntoView' in el) {
            (el as HTMLElement).scrollIntoView({ block: 'start', behavior: 'smooth' });
          }
        }, 60);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [consumeFocusPostId, feedMode, focusPostId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (selectedAlbum?.id) setAlbumId(selectedAlbum.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAlbum?.id]);

  const selectedForPost = React.useMemo(() => albums.find((a) => a.id === albumId) || null, [albums, albumId]);

  const canPublish = Boolean(authUser) && Boolean(selectedForPost?.imageDataURL) && !publishing;

  const handlePublish = async () => {
    if (!authUser) {
      setError('投稿にはログインが必要です');
      return;
    }
    if (!selectedForPost) return;
    setPublishing(true);
    setError(null);

    try {
      const created = await createSocialPost({
        caption,
        album: {
          title: selectedForPost.title || selectedForPost.mood,
          mood: selectedForPost.mood,
          imageUrl: selectedForPost.thumbnailUrl || selectedForPost.imageDataURL,
          createdAt: selectedForPost.createdAt,
        },
      });

      setPosts((prev) => [created, ...prev]);
      if (!selectedForPost.isPublic) {
        updateAlbum(selectedForPost.id, { isPublic: true });
      }
      setCaption('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPublishing(false);
    }
  };

  const handleLike = async (postId: string) => {
    if (!authUser) {
      setError('いいねにはログインが必要です');
      return;
    }
    try {
      const updated = await likeSocialPost(postId);
      setPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleComment = async (postId: string) => {
    if (!authUser) {
      setError('コメントにはログインが必要です');
      return;
    }
    const text = (commentDraftByPostId[postId] || '').trim();
    if (!text) return;

    setCommentingPostId(postId);
    setError(null);

    try {
      const created = await commentSocialPost(postId, { text });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                comments: Array.isArray(p.comments) ? [...p.comments, created] : [created],
              }
            : p
        )
      );
      setCommentDraftByPostId((prev) => ({ ...prev, [postId]: '' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCommentingPostId(null);
    }
  };

  const handleToggleFollow = async (targetUserId: string) => {
    if (!authUser) {
      setError('フォローにはログインが必要です');
      return;
    }
    try {
      const resp = await toggleFollowUser(targetUserId);
      updateFollowingIds(resp.followingIds);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const toggleExpanded = (postId: string) => {
    setExpandedPosts((prev) => ({ ...prev, [postId]: !prev[postId] }));
  };

  const toggleVisibility = async (post: SocialPost) => {
    if (!authUser) {
      setError('操作にはログインが必要です');
      return;
    }
    const current = String(post.visibility || 'public').toLowerCase() === 'private' ? 'private' : 'public';
    const next = current === 'private' ? 'public' : 'private';
    setError(null);
    try {
      const updated = await updateSocialPostVisibility(post.id, next);
      setPosts((prev) => prev.map((p) => (p.id === post.id ? updated : p)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const deletePost = async (post: SocialPost) => {
    if (!authUser) {
      setError('操作にはログインが必要です');
      return;
    }
    const title = post.album?.title || post.album?.mood || '投稿';
    if (!window.confirm(`削除しますか？\n\n${title}\nこの操作は取り消せません。`)) return;
    setError(null);
    try {
      await deleteSocialPost(post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="room-content social-room">
      <div className="social-header">
        <div>
          <h1 className="room-title">SOCIAL</h1>
          <p className="room-subtitle">作品を公開して、反応を集める</p>
        </div>
        <div className="social-header-actions" data-no-swipe="true">
          <button className="btn" onClick={() => navigateToRoom('gallery')}>
            ギャラリーへ
          </button>
          <button className="btn" onClick={() => void load()} disabled={loading}>
            更新
          </button>
        </div>
      </div>

      <div className="social-filter" data-no-swipe="true">
        <SegmentedControl
          value={feedMode}
          onChange={(value) => setFeedMode(value)}
          ariaLabel="フィード切り替え"
          options={[
            { id: 'all', label: 'おすすめ' },
            { id: 'following', label: 'フォロー中' },
            { id: 'trending', label: 'トレンド' },
          ]}
        />
      </div>

      <div className="social-auth" data-no-swipe="true" aria-label="ログイン">
        <div className="social-auth-row">
          <div className="social-auth-me">
            <div className="social-auth-title">ログイン中</div>
            <div className="social-auth-handle">@{authUser?.handle || '...'}</div>
            <div className="social-auth-sub">{authUser?.displayName || ''}</div>
          </div>
          <div className="social-auth-actions">
            <button className="btn" onClick={() => void load()} disabled={loading}>
              再読み込み
            </button>
            <button className="btn" onClick={() => void logout()} disabled={!authUser}>
              ログアウト
            </button>
          </div>
        </div>
      </div>

      <div className="social-compose" data-no-swipe="true" aria-label="投稿フォーム">
        <div className="social-compose-grid">
          <label className="social-field">
            <span className="social-label">公開するアルバム</span>
            <select className="social-select" value={albumId} onChange={(e) => setAlbumId(e.target.value)}>
              {albums.length === 0 && <option value="">（アルバムがありません）</option>}
              {albums.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title || a.mood}
                </option>
              ))}
            </select>
          </label>

          <label className="social-field social-field-wide">
            <span className="social-label">キャプション</span>
            <textarea
              className="social-textarea"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="この作品の一言（任意）"
              maxLength={240}
              rows={3}
            />
          </label>
        </div>

        <div className="social-compose-actions">
          <button className="btn btn-primary" disabled={!canPublish} onClick={handlePublish}>
            {publishing ? '公開中…' : '公開する'}
          </button>
          {selectedForPost && (
            <div className="social-compose-preview" aria-label="選択中アルバムのプレビュー">
              <AlbumCard
                variant="compact"
                title={selectedForPost.title || selectedForPost.mood}
                mood={selectedForPost.mood}
                imageUrl={selectedForPost.thumbnailUrl || selectedForPost.imageDataURL}
                badges={[
                  { label: selectedForPost.musicData ? '再生可能' : '音声なし', tone: selectedForPost.musicData ? 'success' : 'default' },
                ]}
              />
            </div>
          )}
        </div>

        {error && <div className="social-error">{error}</div>}
      </div>

      <div className="social-timeline" aria-label="タイムライン">
        {loading && posts.length === 0 && <div className="social-muted">読み込み中…</div>}
        {!loading && posts.length === 0 && <div className="social-muted">まだ投稿がありません</div>}

        {posts.map((post) => (
          <article key={post.id} className="social-post" data-no-swipe="true" data-post-id={post.id}>
            <header className="social-post-header">
              <div className="social-post-author">
                {post.author?.handle ? `@${post.author.handle}` : post.authorName || 'anonymous'}
                {post.author?.displayName && (
                  <span className="social-post-author-sub">{post.author.displayName}</span>
                )}
              </div>
              <div className="social-post-date">
                {new Date(post.createdAt).toLocaleString('ja-JP', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </header>

            {post.author?.id && authUser?.id !== post.author.id && (
              <div className="social-post-follow" data-no-swipe="true">
                <button
                  className={`btn ${authUser?.followingIds?.includes(post.author.id) ? 'btn-primary' : ''}`}
                  onClick={() => void handleToggleFollow(post.author!.id)}
                  disabled={!authUser}
                >
                  {authUser?.followingIds?.includes(post.author.id) ? 'フォロー中' : 'フォロー'}
                </button>
              </div>
            )}

            <div className="social-post-album">
              <AlbumCard
                title={post.album?.title || 'album'}
                mood={post.album?.mood}
                imageUrl={post.album?.imageUrl}
                meta={post.album?.createdAt ? `作成日: ${new Date(post.album.createdAt).toLocaleDateString('ja-JP')}` : undefined}
                badges={[
                  {
                    label: String(post.visibility || 'public').toLowerCase() === 'private' ? '非公開' : '公開作品',
                    tone: String(post.visibility || 'public').toLowerCase() === 'private' ? 'default' : 'info',
                  },
                ]}
              />
            </div>

            {post.caption && <div className="social-post-caption">{post.caption}</div>}

            <div className="social-post-actions">
              <button
                className={`btn social-action ${expandedPosts[post.id] ? 'is-active' : ''}`}
                onClick={() => toggleExpanded(post.id)}
                aria-expanded={Boolean(expandedPosts[post.id])}
                aria-controls={`post-comments-${post.id}`}
                aria-label={expandedPosts[post.id] ? 'コメントを閉じる' : 'コメントを開く'}
              >
                <span className="social-action-main">
                  <Icon name={expandedPosts[post.id] ? 'chevronDown' : 'comment'} className="social-action-icon" />
                  <span className="social-action-label">{expandedPosts[post.id] ? '閉じる' : 'コメント'}</span>
                </span>
                <span className="social-count-chip">{Array.isArray(post.comments) ? post.comments.length : 0}</span>
              </button>
              <button
                className={`btn social-action ${post.viewerHasLiked ? 'is-active' : ''}`}
                onClick={() => void handleLike(post.id)}
                disabled={!authUser}
              >
                <span className="social-action-main">
                  <Icon name="heart" className="social-action-icon" />
                  <span className="social-action-label">いいね</span>
                </span>
                <span className="social-count-chip">{post.likes || 0}</span>
              </button>
              <button className="btn social-action" onClick={() => void copyPostLink(post.id)}>
                <span className="social-action-main">
                  <Icon name="link" className="social-action-icon" />
                  <span className="social-action-label">共有</span>
                </span>
              </button>
              <Popover
                triggerClassName="btn social-action social-action-iconOnly"
                trigger={<Icon name="more" className="social-action-icon" />}
                placement="bottom"
                triggerAriaLabel="メニュー"
                triggerAriaHaspopup="menu"
              >
                {({ close }) => (
                  <Menu
                    items={(
                      () => {
                        const isMine = Boolean(authUser?.id) && Boolean(post.author?.id) && authUser!.id === post.author!.id;
                        const items: any[] = [
                          { id: 'copy', label: 'リンクをコピー', onSelect: () => { void copyPostLink(post.id); close(); } },
                        ];
                        if (isMine) {
                          const isPrivate = String(post.visibility || 'public').toLowerCase() === 'private';
                          items.push({
                            id: 'vis',
                            label: isPrivate ? '公開にする' : '非公開にする',
                            onSelect: () => { void toggleVisibility(post); close(); },
                          });
                          items.push({
                            id: 'delete',
                            label: '削除',
                            onSelect: () => { void deletePost(post); close(); },
                          });
                        } else {
                          items.push({ id: 'report', label: '通報する', onSelect: () => { setError('通報を受け付けました'); close(); } });
                        }
                        return items;
                      }
                    )()}
                  />
                )}
              </Popover>
            </div>

            {expandedPosts[post.id] && (
              <div className="social-post-comments" id={`post-comments-${post.id}`}>
                {(post.comments || []).slice(-6).map((c) => (
                  <div key={c.id} className="social-comment">
                    <span className="social-comment-author">{c.authorName || 'anonymous'}</span>
                    <span className="social-comment-text">{c.text}</span>
                  </div>
                ))}

                <div className="social-comment-compose">
                  <input
                    className="social-input"
                    value={commentDraftByPostId[post.id] || ''}
                    onChange={(e) =>
                      setCommentDraftByPostId((prev) => ({
                        ...prev,
                        [post.id]: e.target.value,
                      }))
                    }
                    placeholder={authUser ? 'コメントを書く' : 'ログインしてコメント'}
                    maxLength={240}
                    disabled={!authUser}
                  />
                  <button
                    className="btn btn-primary"
                    disabled={!authUser || commentingPostId === post.id}
                    onClick={() => void handleComment(post.id)}
                  >
                    {commentingPostId === post.id ? '送信中…' : '送信'}
                  </button>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
};

export default SocialRoom;
