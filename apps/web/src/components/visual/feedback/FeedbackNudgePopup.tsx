import React from 'react';
import Dialog from '../../ui/Dialog';
import { useRoomNavigation } from '../../../contexts/RoomNavigationContext';

const KEY_OPEN_COUNT = 'airia_feedback_nudge_open_count_v1';
const KEY_LAST_SHOWN_AT = 'airia_feedback_nudge_last_shown_at_v1';

function readInt(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  } catch {
    return 0;
  }
}

function writeInt(key: string, value: number) {
  try {
    localStorage.setItem(key, String(Math.trunc(value)));
  } catch {
    // ignore
  }
}

function readMs(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  } catch {
    return 0;
  }
}

function writeMs(key: string, value: number) {
  try {
    localStorage.setItem(key, String(Math.trunc(value)));
  } catch {
    // ignore
  }
}

function daysSince(ms: number): number {
  if (!ms) return Number.POSITIVE_INFINITY;
  return (Date.now() - ms) / (24 * 60 * 60 * 1000);
}

const FeedbackNudgePopup: React.FC = () => {
  const { currentRoomId, navigateToRoom } = useRoomNavigation();
  const [open, setOpen] = React.useState(false);
  const timerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    // Avoid showing in onboarding or when user is already on feedback.
    if (currentRoomId === 'onboarding' || currentRoomId === 'feedback') return;

    // Count app "arrivals" to avoid nudging too early.
    const nextCount = readInt(KEY_OPEN_COUNT) + 1;
    writeInt(KEY_OPEN_COUNT, nextCount);

    // Rare + rate-limited.
    const lastShownAt = readMs(KEY_LAST_SHOWN_AT);
    const cooldownDays = 10;
    if (daysSince(lastShownAt) < cooldownDays) return;

    // Let the user settle; also avoid very first few launches.
    if (nextCount < 4) return;

    // Small probability per launch (keeps it "rare").
    const chance = nextCount < 10 ? 0.05 : 0.08;
    if (Math.random() > chance) return;

    // Schedule (don’t pop immediately after load).
    timerRef.current = window.setTimeout(() => {
      if (document.visibilityState !== 'visible') return;
      writeMs(KEY_LAST_SHOWN_AT, Date.now());
      setOpen(true);
    }, 7000);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [currentRoomId]);

  const goFeedback = () => {
    setOpen(false);
    navigateToRoom('feedback');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title="フィードバックしませんか？"
      description="短くてOK。気づいたことを教えてください。"
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
            今はしない
          </button>
          <button type="button" className="btn btn-primary" onClick={goFeedback}>
            書く
          </button>
        </>
      }
    >
      <p style={{ margin: 0, lineHeight: 1.7 }}>
        バグ報告・改善案・良かった点、どれでも歓迎です。
        送信時に診断情報も添付できるので、原因調査が早くなります。
      </p>
    </Dialog>
  );
};

export default FeedbackNudgePopup;
