import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRoomNavigation } from '../../contexts/RoomNavigationContext';
import { useToast } from '../visual/feedback/ToastContainer';
import { getAdminToken, setAdminToken } from '../../api/adminApi';
import './SettingsRoom.css';

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

const SettingsRoom: React.FC = () => {
  const { user, logout, updateProfile, busy } = useAuth();
  const { navigateToRoom } = useRoomNavigation();
  const { addToast } = useToast();

  const [displayName, setDisplayName] = React.useState(user?.displayName || '');
  const [bio, setBio] = React.useState(user?.bio || '');
  const [saving, setSaving] = React.useState(false);
  const [adminToken, setAdminTokenState] = React.useState(getAdminToken());

  React.useEffect(() => {
    setDisplayName(user?.displayName || '');
    setBio(user?.bio || '');
  }, [user?.displayName, user?.bio]);

  React.useEffect(() => {
    setAdminTokenState(getAdminToken());
  }, []);

  const canSave = Boolean(user) && !saving && (displayName.trim() !== (user?.displayName || '') || bio.trim() !== (user?.bio || ''));

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim() || undefined,
        bio: bio.trim() || '',
      });
      addToast('success', 'プロフィールを保存しました');
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const doLogout = async () => {
    try {
      await logout();
    } catch {
      // ignore
    }
  };

  const saveAdmin = () => {
    const t = adminToken.trim();
    setAdminToken(t || null);
    addToast('success', t ? 'Admin token を保存しました' : 'Admin token をクリアしました');
  };

  return (
    <div className="room-content settings-room">
      <div className="settings-header" data-no-swipe="true">
        <div className="settings-header-actions">
          <button className="btn" onClick={() => void doLogout()} disabled={!user || busy}>
            ログアウト
          </button>
        </div>
      </div>

      <div className="settings-card">
        <section className="settings-section">
          <h2 className="settings-title">アカウント</h2>
          <div className="settings-kv">
            <div className="settings-kv-row">
              <div className="settings-k">ハンドル</div>
              <div className="settings-v">@{user?.handle || '...'}</div>
            </div>
            <div className="settings-kv-row">
              <div className="settings-k">作成日</div>
              <div className="settings-v">{user?.createdAt ? formatDate(user.createdAt) : ''}</div>
            </div>
          </div>
        </section>

        <section className="settings-section" data-no-swipe="true">
          <h2 className="settings-title">プロフィール</h2>
          <div className="settings-grid">
            <label className="settings-field">
              <span className="settings-label">表示名</span>
              <input
                className="settings-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={32}
                placeholder="あなたの名前"
              />
            </label>

            <label className="settings-field settings-field-wide">
              <span className="settings-label">自己紹介</span>
              <textarea
                className="settings-textarea"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={160}
                rows={4}
                placeholder="一言（任意）"
              />
            </label>
          </div>

          <div className="settings-actions">
            <button className="btn btn-primary" disabled={!canSave} onClick={() => void save()}>
              {saving ? '保存中…' : '保存する'}
            </button>
            <div className="settings-muted">プレリリースでは基本項目のみ編集できます。</div>
          </div>
        </section>

        <section className="settings-section">
          <h2 className="settings-title">通知</h2>
          <p className="settings-muted">メール通知は次フェーズで追加予定です。</p>
        </section>

        <section className="settings-section" data-no-swipe="true">
          <h2 className="settings-title">Admin</h2>
          <div className="settings-grid">
            <label className="settings-field settings-field-wide">
              <span className="settings-label">ADMIN_TOKEN</span>
              <input
                className="settings-input"
                value={adminToken}
                onChange={(e) => setAdminTokenState(e.target.value)}
                placeholder="サーバの ADMIN_TOKEN"
                type="password"
                autoComplete="off"
              />
            </label>
          </div>
          <div className="settings-actions">
            <button className="btn btn-primary" onClick={saveAdmin}>
              保存
            </button>
            <button
              className="btn"
              onClick={() => {
                saveAdmin();
                if (adminToken.trim()) navigateToRoom('admin');
              }}
              disabled={!adminToken.trim()}
            >
              Adminログへ
            </button>
            <div className="settings-muted">Adminログは ADMIN_TOKEN を知っている人のみ利用できます。</div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SettingsRoom;
