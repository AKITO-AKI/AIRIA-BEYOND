import React from 'react';
import { useRoomNavigation } from '../../contexts/RoomNavigationContext';
import { useAuth } from '../../contexts/AuthContext';
import { deleteSocialPost, listMySocialPosts, updateSocialPostVisibility, type SocialPost } from '../../api/socialApi';
import './MyPageRoom.css';

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const MyPageRoom: React.FC = () => {
  const { user } = useAuth();
  const { navigateToRoom } = useRoomNavigation();

  const focusAndGoSocial = (postId: string) => {
    try {
      localStorage.setItem('airia_social_focus_post_v1', String(postId));
    } catch {
      // ignore
    }
    navigateToRoom('social');
  };

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [posts, setPosts] = React.useState<SocialPost[]>([]);
  const [busyPostId, setBusyPostId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await listMySocialPosts(120);
      setPosts(resp.posts || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const totalLikes = React.useMemo(() => posts.reduce((sum, p) => sum + (Number(p.likes) || 0), 0), [posts]);

  const toggleVisibility = async (post: SocialPost) => {
    const current = String(post.visibility || 'public').toLowerCase() === 'private' ? 'private' : 'public';
    const next = current === 'private' ? 'public' : 'private';
    setBusyPostId(post.id);
    setError(null);
    try {
      const updated = await updateSocialPostVisibility(post.id, next);
      setPosts((prev) => prev.map((p) => (p.id === post.id ? updated : p)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyPostId(null);
    }
  };

  const deletePost = async (post: SocialPost) => {
    const title = post.album?.title || post.album?.mood || '投稿';
    if (!window.confirm(`削除しますか？\n\n${title}\nこの操作は取り消せません。`)) return;
    setBusyPostId(post.id);
    setError(null);
    try {
      await deleteSocialPost(post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyPostId(null);
    }
  };

  return (
    <div className="room-content mypage-room">
      <div className="mypage-header" data-no-swipe="true">
        <div>
          <h1 className="room-title">MY</h1>
          <p className="room-subtitle">あなたのプロフィールと投稿</p>
        </div>
        <div className="mypage-header-actions">
          <button className="btn" onClick={() => navigateToRoom('settings')}>設定へ</button>
          <button className="btn" onClick={() => void load()} disabled={loading || !user}>
            更新
          </button>
        </div>
      </div>

      <div className="mypage-card">
        <section className="mypage-section">
          <h2 className="mypage-title">プロフィール</h2>
          <div className="mypage-profile">
            <div className="mypage-avatar" aria-hidden="true">
              {(user?.displayName || user?.handle || 'A').slice(0, 1).toUpperCase()}
            </div>
            <div className="mypage-profile-meta">
              <div className="mypage-handle">@{user?.handle || '...'}</div>
              <div className="mypage-name">{user?.displayName || ''}</div>
              {user?.bio ? <div className="mypage-bio">{user.bio}</div> : <div className="mypage-bio muted">自己紹介は未設定です</div>}
            </div>
          </div>
        </section>

        <section className="mypage-section">
          <h2 className="mypage-title">サマリー</h2>
          <div className="mypage-stats">
            <div className="mypage-stat">
              <div className="mypage-stat-k">投稿</div>
              <div className="mypage-stat-v">{posts.length}</div>
            </div>
            <div className="mypage-stat">
              <div className="mypage-stat-k">合計いいね</div>
              <div className="mypage-stat-v">{totalLikes}</div>
            </div>
            <div className="mypage-stat">
              <div className="mypage-stat-k">フォロー中</div>
              <div className="mypage-stat-v">{user?.followingIds?.length || 0}</div>
            </div>
          </div>
        </section>

        <section className="mypage-section" data-no-swipe="true">
          <div className="mypage-row">
            <h2 className="mypage-title">あなたの投稿</h2>
            <button className="btn" onClick={() => navigateToRoom('social')}>Socialへ</button>
          </div>

          {error && <div className="mypage-error">{error}</div>}
          {loading && <div className="mypage-muted">読み込み中…</div>}
          {!loading && posts.length === 0 && <div className="mypage-muted">まだ投稿がありません</div>}

          <div className="mypage-posts">
            {posts.map((post) => (
              <article key={post.id} className="mypage-post">
                <div className="mypage-post-top">
                  <div className="mypage-post-title">
                    {post.album?.title || post.album?.mood || '作品'}
                    {String(post.visibility || 'public').toLowerCase() === 'private' ? (
                      <span className="mypage-visibility mypage-visibility-private">非公開</span>
                    ) : (
                      <span className="mypage-visibility">公開</span>
                    )}
                  </div>
                  <div className="mypage-post-time">{formatDateTime(post.createdAt)}</div>
                </div>
                {post.caption ? <div className="mypage-post-caption">{post.caption}</div> : null}
                <div className="mypage-post-meta">
                  <span>♥ {post.likes}</span>
                  <span>💬 {post.comments?.length || 0}</span>
                  <div className="mypage-post-actions">
                    <button className="btn" onClick={() => focusAndGoSocial(post.id)} disabled={busyPostId === post.id}>
                      開く
                    </button>
                    <button className="btn" onClick={() => void toggleVisibility(post)} disabled={busyPostId === post.id}>
                      {String(post.visibility || 'public').toLowerCase() === 'private' ? '公開にする' : '非公開にする'}
                    </button>
                    <button className="btn" onClick={() => void deletePost(post)} disabled={busyPostId === post.id}>
                      削除
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default MyPageRoom;
