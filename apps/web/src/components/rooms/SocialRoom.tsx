import React from 'react';
import { useAlbums } from '../../contexts/AlbumContext';
import { useRoomNavigation } from '../../contexts/RoomNavigationContext';
import {
  commentSocialPost,
  createSocialPost,
  likeSocialPost,
  listSocialPosts,
  type SocialPost,
} from '../../api/socialApi';
import './SocialRoom.css';

const SocialRoom: React.FC = () => {
  const { albums, getSelectedAlbum } = useAlbums();
  const selectedAlbum = getSelectedAlbum();
  const { navigateToRoom } = useRoomNavigation();

  const [posts, setPosts] = React.useState<SocialPost[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [authorName, setAuthorName] = React.useState('');
  const [caption, setCaption] = React.useState('');
  const [albumId, setAlbumId] = React.useState<string>(selectedAlbum?.id || (albums[0]?.id ?? ''));
  const [publishing, setPublishing] = React.useState(false);

  const [commentDraftByPostId, setCommentDraftByPostId] = React.useState<Record<string, string>>({});
  const [commentingPostId, setCommentingPostId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await listSocialPosts(50);
      setPosts(resp.posts || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (selectedAlbum?.id) setAlbumId(selectedAlbum.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAlbum?.id]);

  const selectedForPost = React.useMemo(() => albums.find((a) => a.id === albumId) || null, [albums, albumId]);

  const canPublish = Boolean(selectedForPost?.imageDataURL) && !publishing;

  const handlePublish = async () => {
    if (!selectedForPost) return;
    setPublishing(true);
    setError(null);

    try {
      const created = await createSocialPost({
        authorName,
        caption,
        album: {
          title: selectedForPost.title || selectedForPost.mood,
          mood: selectedForPost.mood,
          imageUrl: selectedForPost.thumbnailUrl || selectedForPost.imageDataURL,
          createdAt: selectedForPost.createdAt,
        },
      });

      setPosts((prev) => [created, ...prev]);
      setCaption('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPublishing(false);
    }
  };

  const handleLike = async (postId: string) => {
    try {
      const updated = await likeSocialPost(postId);
      setPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleComment = async (postId: string) => {
    const text = (commentDraftByPostId[postId] || '').trim();
    if (!text) return;

    setCommentingPostId(postId);
    setError(null);

    try {
      const created = await commentSocialPost(postId, { authorName, text });
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

      <div className="social-compose" data-no-swipe="true" aria-label="投稿フォーム">
        <div className="social-compose-grid">
          <label className="social-field">
            <span className="social-label">名前（任意）</span>
            <input
              className="social-input"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="anonymous"
              maxLength={24}
            />
          </label>

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
              <img src={selectedForPost.thumbnailUrl || selectedForPost.imageDataURL} alt="" />
              <div className="social-compose-preview-meta">
                <div className="social-compose-preview-title">{selectedForPost.title || selectedForPost.mood}</div>
                <div className="social-compose-preview-sub">{selectedForPost.mood}</div>
              </div>
            </div>
          )}
        </div>

        {error && <div className="social-error">{error}</div>}
      </div>

      <div className="social-timeline" aria-label="タイムライン">
        {loading && posts.length === 0 && <div className="social-muted">読み込み中…</div>}
        {!loading && posts.length === 0 && <div className="social-muted">まだ投稿がありません</div>}

        {posts.map((post) => (
          <article key={post.id} className="social-post" data-no-swipe="true">
            <header className="social-post-header">
              <div className="social-post-author">{post.authorName || 'anonymous'}</div>
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

            <div className="social-post-album">
              <img className="social-post-image" src={post.album?.imageUrl} alt={post.album?.title || 'album'} />
              <div className="social-post-album-meta">
                <div className="social-post-album-title">{post.album?.title}</div>
                <div className="social-post-album-sub">{post.album?.mood}</div>
              </div>
            </div>

            {post.caption && <div className="social-post-caption">{post.caption}</div>}

            <div className="social-post-actions">
              <button className="btn" onClick={() => void handleLike(post.id)}>
                いいね {post.likes || 0}
              </button>
              <div className="social-post-comments-count">コメント {Array.isArray(post.comments) ? post.comments.length : 0}</div>
            </div>

            <div className="social-post-comments">
              {(post.comments || []).slice(-3).map((c) => (
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
                  placeholder="コメントを書く"
                  maxLength={240}
                />
                <button
                  className="btn btn-primary"
                  disabled={commentingPostId === post.id}
                  onClick={() => void handleComment(post.id)}
                >
                  {commentingPostId === post.id ? '送信中…' : '送信'}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

export default SocialRoom;
