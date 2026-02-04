import React, { useState, useRef, useEffect } from 'react';
import { RoomNavigationProvider, type RoomType } from '../contexts/RoomNavigationContext';
import FeedbackNudgePopup from './visual/feedback/FeedbackNudgePopup';
import './RoomNavigator.css';

interface Room {
  id: RoomType;
  name: string;
  component: React.ReactNode;
}

interface RoomNavigatorProps {
  rooms: Room[];
  initialRoom?: RoomType;
}

const RoomNavigator: React.FC<RoomNavigatorProps> = ({ rooms, initialRoom = 'main' }) => {
  const initialIndex = rooms.findIndex(r => r.id === initialRoom);
  const [currentIndex, setCurrentIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [dragAxis, setDragAxis] = useState<'horizontal' | 'vertical' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
  const translateX = -currentIndex * 100 + (offsetX / containerWidth) * 100;

  const currentRoomId = rooms[currentIndex]?.id;
  const showIndicators = currentRoomId !== 'onboarding';

  const navigateToRoomId = (roomId: RoomType) => {
    const normalized = roomId === 'settings' ? 'me' : roomId;
    const idx = rooms.findIndex(r => r.id === normalized);
    if (idx >= 0) navigateToRoom(idx);
  };

  return (
    <RoomNavigationProvider value={{ currentRoomId, navigateToRoom: navigateToRoomId }}>
      <FeedbackNudgePopup />
      <div className={`room-navigator ${showIndicators ? '' : 'indicators-hidden'}`}>
        {/* Room indicator (navigation tool) */}
        {showIndicators && (
          <div className="room-indicators" aria-label="ルームナビゲーション">
            {rooms.map((room, index) => (
              <button
                key={room.id}
                className={`room-indicator ${index === currentIndex ? 'active' : ''}`}
                onClick={() => navigateToRoom(index)}
                aria-current={index === currentIndex ? 'page' : undefined}
                aria-label={`${room.name}へ移動`}
              >
                <span className="room-indicator-label">{room.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Rooms container */}
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
            transform: `translateX(${translateX}%)`,
            transition: isDragging ? 'none' : 'transform 0.8s cubic-bezier(0.4, 0.0, 0.2, 1)',
          }}
        >
          {rooms.map((room) => (
            <div key={room.id} className="room">
              {room.component}
            </div>
          ))}
        </div>
      </div>
    </RoomNavigationProvider>
  );
};

export default RoomNavigator;
