import React, { useState, useRef, useEffect } from 'react';
import './RoomNavigator.css';

export type RoomType = 'onboarding' | 'main' | 'gallery' | 'album' | 'music';

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
  const [offsetX, setOffsetX] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startX;
    setOffsetX(diff);
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
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const diff = e.clientX - startX;
    setOffsetX(diff);
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
    }
  };

  const navigateToRoom = (index: number) => {
    setCurrentIndex(index);
    setOffsetX(0);
  };

  const containerWidth = containerRef.current?.clientWidth || window.innerWidth || 1;
  const translateX = -currentIndex * 100 + (offsetX / containerWidth) * 100;

  return (
    <div className="room-navigator">
      {/* Room indicator dots */}
      <div className="room-indicators">
        {rooms.map((room, index) => (
          <button
            key={room.id}
            className={`room-indicator ${index === currentIndex ? 'active' : ''}`}
            onClick={() => navigateToRoom(index)}
            aria-label={`${room.name}へ移動`}
          >
            <span className="room-indicator-label">{room.name}</span>
          </button>
        ))}
      </div>

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
  );
};

export default RoomNavigator;
