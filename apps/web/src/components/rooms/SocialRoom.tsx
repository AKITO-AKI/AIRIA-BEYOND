import React from 'react';
import { useAlbums } from '../../contexts/AlbumContext';
import { useRoomNavigation } from '../../contexts/RoomNavigationContext';
import { getAuthToken, login, logout, me, register, setAuthToken, type AuthUser } from '../../api/authApi';
import {
  commentSocialPost,
  createSocialPost,
  likeSocialPost,
  listSocialPosts,
  toggleFollowUser,
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

  const [authUser, setAuthUser] = React.useState<AuthUser | null>(null);
  const [authBusy, setAuthBusy] = React.useState(false);
  const [authTab, setAuthTab] = React.useState<'login' | 'register'>(getAuthToken() ? 'login' : 'register');
  const [handle, setHandle] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');

  const [caption, setCaption] = React.useState('');
  const [albumId, setAlbumId] = React.useState<string>(selectedAlbum?.id || (albums[0]?.id ?? ''));
  const [publishing, setPublishing] = React.useState(false);

  const [commentDraftByPostId, setCommentDraftByPostId] = React.useState<Record<string, string>>({});
  const [commentingPostId, setCommentingPostId] = React.useState<string | null>(null);
  const [feedMode, setFeedMode] = React.useState<'all' | 'following' | 'trending'>('all');
  const [expandedPosts, setExpandedPosts] = React.useState<Record<string, boolean>>({});

  const loadMe = React.useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setAuthUser(null);
      return;
    }

    try {
      const resp = await me();
      if (!resp.user) {
        setAuthToken(null);
        setAuthUser(null);
      } else {
        setAuthUser(resp.user);
      }
    } catch {
      setAuthUser(null);
    }
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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [feedMode]);

  React.useEffect(() => {
    void loadMe();
    void load();
  }, [load, loadMe]);

  React.useEffect(() => {
    if (selectedAlbum?.id) setAlbumId(selectedAlbum.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAlbum?.id]);

  const selectedForPost = React.useMemo(() => albums.find((a) => a.id === albumId) || null, [albums, albumId]);

  const canPublish = Boolean(authUser) && Boolean(selectedForPost?.imageDataURL) && !publishing;

  const handleAuthSubmit = async () => {
    setAuthBusy(true);
    setError(null);
    try {
      if (authTab === 'register') {
        const resp = await register({ handle, password, displayName: displayName || undefined });
        setAuthToken(resp.token);
        setAuthUser(resp.user);
      } else {
        const resp = await login({ handle, password });
        setAuthToken(resp.token);
        setAuthUser(resp.user);
      }
      setPassword('');
      if (feedMode === 'following') {
        void load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    setAuthBusy(true);
    setError(null);
    try {
      await logout().catch(() => null);
    } finally {
      setAuthToken(null);
      setAuthUser(null);
      setAuthBusy(false);
    }
  };

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
      setAuthUser((prev) => (prev ? { ...prev, followingIds: resp.followingIds } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const toggleExpanded = (postId: string) => {
    setExpandedPosts((prev) => ({ ...prev, [postId]: !prev[postId] }));
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
        {authUser ? (
          <div className="social-auth-row">
            <div className="social-auth-me">
              <div className="social-auth-title">ログイン中</div>
              <div className="social-auth-handle">@{authUser.handle}</div>
              <div className="social-auth-sub">{authUser.displayName}</div>
            </div>
            <div className="social-auth-actions">
              <button className="btn" onClick={() => void load()} disabled={loading}>
                再読み込み
              </button>
              <button className="btn" onClick={() => void handleLogout()} disabled={authBusy}>
                ログアウト
              </button>
            </div>
          </div>
        ) : (
          <div className="social-auth-form">
            <div className="social-auth-tabs">
              <button
                className={`btn ${authTab === 'register' ? 'btn-primary' : ''}`}
                onClick={() => setAuthTab('register')}
                disabled={authBusy}
              >
                新規登録
              </button>
              <button
                className={`btn ${authTab === 'login' ? 'btn-primary' : ''}`}
                onClick={() => setAuthTab('login')}
                disabled={authBusy}
              >
                ログイン
              </button>
            </div>

            <div className="social-auth-grid">
              <label className="social-field">
                <span className="social-label">ハンドル（a-z/0-9/_）</span>
                <input
                  className="social-input"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="airia_user"
                  maxLength={20}
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </label>
              <label className="social-field">
                <span className="social-label">パスワード</span>
                <input
                  className="social-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6文字以上"
                />
              </label>
              {authTab === 'register' && (
                <label className="social-field social-field-wide">
                  <span className="social-label">表示名（任意）</span>
                  <input
                    className="social-input"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Airia"
                    maxLength={32}
                  />
                </label>
              )}
            </div>

            <div className="social-auth-actions">
              <button
                className="btn btn-primary"
                onClick={() => void handleAuthSubmit()}
                disabled={authBusy || !handle.trim() || !password}
              >
                {authBusy ? '処理中…' : authTab === 'register' ? '登録する' : 'ログインする'}
              </button>
              <div className="social-muted">投稿/いいね/コメント/フォローにはログインが必要です</div>
            </div>
          </div>
        )}
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
        {feedMode === 'following' && !authUser && (
          <div className="social-muted">「フォロー中」を見るにはログインしてください</div>
        )}
        {loading && posts.length === 0 && <div className="social-muted">読み込み中…</div>}
        {!loading && posts.length === 0 && <div className="social-muted">まだ投稿がありません</div>}

        {posts.map((post) => (
          <article key={post.id} className="social-post" data-no-swipe="true">
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
                badges={[{ label: '公開作品', tone: 'info' }]}
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
                    items={[
                      { id: 'copy', label: 'リンクをコピー', onSelect: () => { void copyPostLink(post.id); close(); } },
                      { id: 'report', label: '通報する', onSelect: () => { setError('通報を受け付けました'); close(); } },
                    ]}
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
