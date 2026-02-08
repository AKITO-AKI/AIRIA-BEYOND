import React, { useMemo, useState, useRef, useEffect } from 'react';
import { RoomNavigationProvider, type RoomType } from '../contexts/RoomNavigationContext';
import FeedbackNudgePopup from './visual/feedback/FeedbackNudgePopup';
import './RoomNavigator.css';

const BRAND_LOGO_SRC = `${import.meta.env.BASE_URL}img/airia-logo.png`;

interface Room {
  id: RoomType;
  name: string;
  component: React.ReactNode;
}

interface RoomNavigatorProps {
  rooms: Room[];
  initialRoom?: RoomType;
}

function RoomIcon({ roomId }: { roomId: RoomType }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': true,
  } as const;

  switch (roomId) {
    case 'main':
      return (
        <svg {...common}>
          <path d="M4 11.5L12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5z" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case 'gallery':
      return (
        <svg {...common}>
          <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v11A2.5 2.5 0 0 1 16.5 20h-9A2.5 2.5 0 0 1 5 17.5v-11z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 14l2.2-2.2a1 1 0 0 1 1.4 0L15 15l1.2-1.2a1 1 0 0 1 1.4 0L19 15.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 9.5h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case 'album':
      return (
        <svg {...common}>
          <path d="M7 4h10a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M9 8h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M9 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'music':
      return (
        <svg {...common}>
          <path d="M10 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M18 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 16V6l8-2v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'social':
      return (
        <svg {...common}>
          <path d="M8.5 13.5a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M16.5 12.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4.5 20c.6-2.9 2.7-4.8 6-4.8s5.4 1.9 6 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M14 20c.3-1.8 1.4-3.1 3.4-3.1 1.8 0 2.7.6 3.1 1.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'me':
    case 'settings':
      return (
        <svg {...common}>
          <path d="M12 12.4a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M5 20c.9-3.6 3.6-5.6 7-5.6s6.1 2 7 5.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'admin':
      return (
        <svg {...common}>
          <path d="M12 2l8 4v6c0 5-3.4 9.6-8 10-4.6-.4-8-5-8-10V6l8-4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M9.2 12.3l1.8 1.9 3.9-4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'info':
      return (
        <svg {...common}>
          <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 10.6V16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M12 8.2h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case 'feedback':
      return (
        <svg {...common}>
          <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H11l-4.2 3.2c-.6.5-1.8.1-1.8-.8V6.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M8.2 8.8h7.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M8.2 12h5.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M6 12h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M12 6v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
  }
}

const RoomNavigator: React.FC<RoomNavigatorProps> = ({ rooms, initialRoom = 'main' }) => {
  const initialIndex = rooms.findIndex(r => r.id === initialRoom);
  const [currentIndex, setCurrentIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
  const [isNarrow, setIsNarrow] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [dragAxis, setDragAxis] = useState<'horizontal' | 'vertical' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 860px)');
    const update = () => {
      setIsNarrow(mq.matches);
    };
    update();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    // Safari fallback
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  useEffect(() => {
    // Default: open sidebar on desktop, closed on mobile.
    setSidebarOpen(!isNarrow);
  }, [isNarrow]);

  const isInteractiveTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest(
        'button, a, input, select, textarea, [role="button"], [data-no-swipe="true"]'
      )
    );
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isInteractiveTarget(e.target)) return;
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
    setStartY(e.touches[0].clientY);
    setDragAxis(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const dx = currentX - startX;
    const dy = currentY - startY;

    // Decide whether user intent is scrolling (vertical) or room swipe (horizontal)
    if (!dragAxis) {
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      if (ax < 6 && ay < 6) return;
      if (ay > ax * 1.2) {
        setDragAxis('vertical');
        setIsDragging(false);
        setOffsetX(0);
        return;
      }
      setDragAxis('horizontal');
    }

    if (dragAxis === 'horizontal') {
      // Prevent vertical scroll only when we are actively swiping rooms
      e.preventDefault();
      setOffsetX(dx);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const threshold = 100; // Minimum swipe distance to change room
    if (Math.abs(offsetX) > threshold) {
      if (offsetX > 0 && currentIndex > 0) {
        // Swipe right - go to previous room
        setCurrentIndex(currentIndex - 1);
      } else if (offsetX < 0 && currentIndex < rooms.length - 1) {
        // Swipe left - go to next room
        setCurrentIndex(currentIndex + 1);
      }
    }
    setOffsetX(0);
    setDragAxis(null);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isInteractiveTarget(e.target)) return;
    setIsDragging(true);
    setStartX(e.clientX);
    setStartY(e.clientY);
    setDragAxis(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (!dragAxis) {
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      if (ax < 6 && ay < 6) return;
      if (ay > ax * 1.2) {
        setDragAxis('vertical');
        setIsDragging(false);
        setOffsetX(0);
        return;
      }
      setDragAxis('horizontal');
    }

    if (dragAxis === 'horizontal') {
      setOffsetX(dx);
    }
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const threshold = 100;
    if (Math.abs(offsetX) > threshold) {
      if (offsetX > 0 && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      } else if (offsetX < 0 && currentIndex < rooms.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    }
    setOffsetX(0);
    setDragAxis(null);
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      const threshold = 100;
      if (Math.abs(offsetX) > threshold) {
        if (offsetX > 0 && currentIndex > 0) {
          setCurrentIndex(currentIndex - 1);
        } else if (offsetX < 0 && currentIndex < rooms.length - 1) {
          setCurrentIndex(currentIndex + 1);
        }
      }
      setIsDragging(false);
      setOffsetX(0);
      setDragAxis(null);
    }
  };

  const navigateToRoom = (index: number) => {
    setCurrentIndex(index);
    setOffsetX(0);
  };

  const containerWidth = containerRef.current?.clientWidth || window.innerWidth || 1;
  // IMPORTANT: translateX(%) is relative to the element's own width.
  // Because `.rooms-container` becomes wider than the viewport (N rooms in a row),
  // using percent here can over-shift by N*width and push content off-screen.
  // Use pixel translation instead so one step == one viewport.
  const translateXPx = -currentIndex * containerWidth + offsetX;

  const currentRoomId = rooms[currentIndex]?.id;
  const showIndicators = currentRoomId !== 'onboarding';

  const visibleRooms = useMemo(() => {
    // Keep onboarding isolated (no global navigation).
    if (!showIndicators) return [] as Room[];
    return rooms;
  }, [rooms, showIndicators]);

  const navigateToRoomId = (roomId: RoomType) => {
    const normalized = roomId === 'settings' ? 'me' : roomId;
    const idx = rooms.findIndex(r => r.id === normalized);
    if (idx >= 0) navigateToRoom(idx);
  };

  const handleNavClick = (index: number) => {
    navigateToRoom(index);
    if (isNarrow) setSidebarOpen(false);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <RoomNavigationProvider value={{ currentRoomId, navigateToRoom: navigateToRoomId }}>
      <FeedbackNudgePopup />
      <div className={`room-navigator ${showIndicators ? '' : 'indicators-hidden'}`}>
        {showIndicators && (
          <>
            <div
              className={`room-sidebar-backdrop ${sidebarOpen && isNarrow ? 'open' : ''}`}
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
            <aside
              className={`room-sidebar ${sidebarOpen ? 'open' : 'closed'} ${isNarrow ? 'narrow' : 'wide'}`}
              aria-label="ナビゲーション"
            >
              <div className="room-sidebar-top">
                <button
                  type="button"
                  className="room-sidebar-toggle"
                  onClick={() => setSidebarOpen((v) => !v)}
                  aria-label={sidebarOpen ? 'サイドバーを閉じる' : 'サイドバーを開く'}
                  aria-expanded={sidebarOpen}
                >
                  <span className="room-sidebar-toggle-bar" />
                  <span className="room-sidebar-toggle-bar" />
                  <span className="room-sidebar-toggle-bar" />
                </button>
                <div className="room-sidebar-brand" aria-label="AIRIA BEYOND">
                  <img className="room-sidebar-logo" src={BRAND_LOGO_SRC} alt="" aria-hidden="true" />
                  <span className="room-sidebar-brand-text">AIRIA</span>
                </div>
              </div>

              <nav className="room-sidebar-nav" aria-label="ルーム一覧">
                {visibleRooms.map((room, index) => (
                  <button
                    key={room.id}
                    type="button"
                    className={`room-sidebar-item ${index === currentIndex ? 'active' : ''}`}
                    onClick={() => handleNavClick(index)}
                    aria-current={index === currentIndex ? 'page' : undefined}
                    aria-label={`${room.name}へ移動`}
                    title={room.name}
                  >
                    <span className="room-sidebar-icon" aria-hidden="true">
                      <RoomIcon roomId={room.id} />
                    </span>
                    <span className="room-sidebar-item-label">{room.name}</span>
                  </button>
                ))}
              </nav>
            </aside>

            {isNarrow && !sidebarOpen ? (
              <button
                type="button"
                className="room-sidebar-fab"
                onClick={() => setSidebarOpen(true)}
                aria-label="ナビゲーションを開く"
              >
                <span className="room-sidebar-fab-bar" />
                <span className="room-sidebar-fab-bar" />
                <span className="room-sidebar-fab-bar" />
              </button>
            ) : null}
          </>
        )}

        <main className={`room-stage ${showIndicators ? 'with-sidebar' : ''} ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <div
            ref={containerRef}
            className="rooms-container"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            style={{
              transform: `translateX(${translateXPx}px)`,
              transition: isDragging ? 'none' : 'transform 0.8s cubic-bezier(0.4, 0.0, 0.2, 1)',
            }}
          >
            {rooms.map((room) => (
              <div key={room.id} className="room">
                {room.component}
              </div>
            ))}
          </div>
        </main>
      </div>
    </RoomNavigationProvider>
  );
};

export default RoomNavigator;
