import React from 'react';
import './AdminRoom.css';
import { AdminMetrics, AuditEvent, getAdminMetrics, getAdminToken, getAuditStreamUrl, listAuditEvents, setAdminToken } from '../../api/adminApi';
import { useToast } from '../visual/feedback/ToastContainer';

function fmtTs(ts: string) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString('ja-JP', { hour12: false });
}

function actorLabel(e: AuditEvent) {
  const a = e.actor;
  if (!a) return 'anonymous';
  const handle = a.handle ? `@${a.handle}` : a.id;
  const name = a.displayName ? String(a.displayName) : '';
  return name ? `${name} (${handle})` : handle;
}

const AdminRoom: React.FC = () => {
  const { addToast } = useToast();

  const [token, setToken] = React.useState(getAdminToken());
  const [savedToken, setSavedToken] = React.useState(getAdminToken());

  const [events, setEvents] = React.useState<AuditEvent[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [metrics, setMetrics] = React.useState<AdminMetrics | null>(null);
  const [metricsDays, setMetricsDays] = React.useState(30);

  const [typeFilter, setTypeFilter] = React.useState('');
  const [actorFilter, setActorFilter] = React.useState('');
  const [connected, setConnected] = React.useState(false);
  const [autoConnect, setAutoConnect] = React.useState(true);

  const esRef = React.useRef<EventSource | null>(null);

  const disconnect = React.useCallback(() => {
    if (esRef.current) {
      try {
        esRef.current.close();
      } catch {
        // ignore
      }
    }
    esRef.current = null;
    setConnected(false);
  }, []);

  const connect = React.useCallback(
    (t: string) => {
      disconnect();
      if (!t) return;

      try {
        const es = new EventSource(getAuditStreamUrl(t));
        esRef.current = es;

        es.addEventListener('hello', () => {
          setConnected(true);
          setError(null);
        });

        es.addEventListener('audit', (evt: MessageEvent) => {
          try {
            const parsed = JSON.parse(String(evt.data || 'null')) as AuditEvent;
            if (!parsed || typeof parsed !== 'object') return;
            setEvents((prev) => {
              const next = [parsed, ...prev];
              return next.slice(0, 2000);
            });
          } catch {
            // ignore
          }
        });

        es.onerror = () => {
          setConnected(false);
        };
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setConnected(false);
      }
    },
    [disconnect]
  );

  const load = React.useCallback(async () => {
    const t = (savedToken || '').trim();
    if (!t) {
      setError('ADMIN_TOKEN を入力してください');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const resp = await listAuditEvents({ limit: 200, type: typeFilter.trim(), actorId: actorFilter.trim() }, t);
      setEvents(resp.events || []);
      const m = await getAdminMetrics(metricsDays, t);
      setMetrics(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [savedToken, typeFilter, actorFilter, metricsDays]);

  React.useEffect(() => {
    const t = (savedToken || '').trim();
    if (!t) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const m = await getAdminMetrics(metricsDays, t);
        if (!cancelled) setMetrics(m);
      } catch {
        // ignore (token may be invalid)
      }
    };
    void tick();
    const timer = window.setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [savedToken, metricsDays]);

  React.useEffect(() => {
    if (!autoConnect) return;
    if (!savedToken) return;
    connect(savedToken);
    return () => disconnect();
  }, [autoConnect, savedToken, connect, disconnect]);

  const saveToken = () => {
    const t = token.trim();
    setAdminToken(t || null);
    setSavedToken(t);
    addToast('success', t ? 'Admin token を保存しました' : 'Admin token をクリアしました');
    if (t && autoConnect) connect(t);
    if (!t) disconnect();
  };

  const clearView = () => setEvents([]);

  const filtered = React.useMemo(() => {
    const tf = typeFilter.trim().toLowerCase();
    const af = actorFilter.trim();
    return events.filter((e) => {
      if (tf && !String(e.type || '').toLowerCase().includes(tf)) return false;
      if (af) {
        const id = String(e.actor?.id || '');
        const handle = String(e.actor?.handle || '');
        if (af !== id && af !== handle) return false;
      }
      return true;
    });
  }, [events, typeFilter, actorFilter]);

  return (
    <div className="room-content admin-room">
      <div className="admin-header" data-no-swipe="true">
        <div className="admin-header-actions">
          <span className={`admin-pill ${connected ? 'ok' : 'ng'}`}>{connected ? 'LIVE' : 'OFFLINE'}</span>
          <button className="btn" onClick={() => void load()} disabled={loading || !savedToken}>
            {loading ? '読込中…' : '最新を取得'}
          </button>
          <button className="btn btn-secondary" onClick={clearView} disabled={events.length === 0}>
            表示クリア
          </button>
        </div>
      </div>

      <div className="admin-metrics" data-no-swipe="true">
        <div className="admin-metrics-top">
          <div className="admin-metrics-cards">
            <div className="admin-metric">
              <div className="admin-metric-k">総ユーザー数</div>
              <div className="admin-metric-v">{metrics?.totals?.users ?? '—'}</div>
            </div>
            <div className="admin-metric">
              <div className="admin-metric-k">総アクション数</div>
              <div className="admin-metric-v">{metrics?.totals?.actions ?? '—'}</div>
            </div>
            <div className="admin-metric">
              <div className="admin-metric-k">期間</div>
              <div className="admin-metric-v">直近 {metricsDays} 日</div>
            </div>
          </div>
          <div className="admin-metrics-days">
            <button className={`btn ${metricsDays === 7 ? 'btn-primary' : ''}`} onClick={() => setMetricsDays(7)}>
              7日
            </button>
            <button className={`btn ${metricsDays === 14 ? 'btn-primary' : ''}`} onClick={() => setMetricsDays(14)}>
              14日
            </button>
            <button className={`btn ${metricsDays === 30 ? 'btn-primary' : ''}`} onClick={() => setMetricsDays(30)}>
              30日
            </button>
          </div>
        </div>

        <div className="admin-charts">
          <MiniBarChart title="ユーザー増加（新規/日）" points={metrics?.series?.newUsersPerDay || []} />
          <MiniBarChart title="アクション数（/日）" points={metrics?.series?.actionsPerDay || []} />
        </div>
      </div>

      <div className="admin-card" data-no-swipe="true">
        <div className="admin-grid">
          <label className="admin-field admin-field-wide">
            <span className="admin-label">ADMIN_TOKEN</span>
            <input
              className="admin-input"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Bearer token（サーバの ADMIN_TOKEN）"
              type="password"
              autoComplete="off"
            />
          </label>

          <div className="admin-actions">
            <button className="btn btn-primary" onClick={saveToken}>
              保存
            </button>
            <button className="btn" onClick={() => (connected ? disconnect() : connect(savedToken))} disabled={!savedToken}>
              {connected ? '切断' : '接続'}
            </button>
            <label className="admin-toggle">
              <input type="checkbox" checked={autoConnect} onChange={(e) => setAutoConnect(e.target.checked)} />
              自動接続
            </label>
          </div>

          <label className="admin-field">
            <span className="admin-label">type filter</span>
            <input className="admin-input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} placeholder="social.post" />
          </label>

          <label className="admin-field">
            <span className="admin-label">actor filter</span>
            <input className="admin-input" value={actorFilter} onChange={(e) => setActorFilter(e.target.value)} placeholder="user id or handle" />
          </label>
        </div>

        {error && <div className="admin-error">{error}</div>}
        {!savedToken && <div className="admin-hint">まず ADMIN_TOKEN を入力して「保存」してください。</div>}
      </div>

      <div className="admin-list" data-no-swipe="true">
        {filtered.length === 0 ? (
          <div className="admin-empty">ログがありません。操作してイベントを発生させてください。</div>
        ) : (
          filtered.map((e) => <AuditRow key={e.id} evt={e} onCopy={() => {
            const text = JSON.stringify(e, null, 2);
            navigator.clipboard
              .writeText(text)
              .then(() => addToast('success', 'コピーしました'))
              .catch(() => addToast('error', 'コピーできませんでした'));
          }} />)
        )}
      </div>
    </div>
  );
};

const MiniBarChart: React.FC<{ title: string; points: Array<{ day: string; value: number }> }> = ({ title, points }) => {
  const max = Math.max(1, ...points.map((p) => Number(p.value || 0)));
  const last = points[points.length - 1];
  const sum = points.reduce((a, p) => a + (Number(p.value) || 0), 0);
  return (
    <div className="admin-chart">
      <div className="admin-chart-top">
        <div className="admin-chart-title">{title}</div>
        <div className="admin-chart-meta">
          合計 {sum} / 最新 {last?.value ?? 0}
        </div>
      </div>
      <div className="admin-chart-bars" aria-label={title}>
        {points.map((p) => (
          <div key={p.day} className="admin-chart-bar" title={`${p.day}: ${p.value}`}>
            <div className="admin-chart-barFill" style={{ height: `${Math.round((Number(p.value || 0) / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="admin-chart-axis">
        <span>{points[0]?.day || ''}</span>
        <span>{points[points.length - 1]?.day || ''}</span>
      </div>
    </div>
  );
};

const AuditRow: React.FC<{ evt: AuditEvent; onCopy: () => void }> = ({ evt, onCopy }) => {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="admin-row">
      <button className="admin-row-main" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <div className="admin-row-top">
          <div className="admin-row-type">{evt.type}</div>
          <div className="admin-row-ts">{fmtTs(evt.ts)}</div>
        </div>
        <div className="admin-row-mid">
          <div className="admin-row-actor">{actorLabel(evt)}</div>
          <div className="admin-row-summary">{evt.summary || ''}</div>
        </div>
        {evt.request?.path ? <div className="admin-row-path">{evt.request.method} {evt.request.path}</div> : null}
      </button>

      <div className="admin-row-actions" data-no-swipe="true">
        <button className="btn btn-secondary" onClick={onCopy}>
          JSONコピー
        </button>
      </div>

      {open ? (
        <pre className="admin-row-json">{JSON.stringify(evt, null, 2)}</pre>
      ) : null}
    </div>
  );
};

export default AdminRoom;
