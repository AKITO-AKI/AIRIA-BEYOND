import React, { Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import Bookshelf3D from './Bookshelf3D';
import { Album } from '../../contexts/AlbumContext';

interface BookshelfCanvasProps {
  albums: Album[];
  onBookClick: (albumId: string) => void;
  constellationEnabled: boolean;
}

export interface BookshelfInputState {
  wheelPx: number;
  dragPx: number;
  isDragging: boolean;
  lastPointerX: number;
}

const BookshelfCanvas: React.FC<BookshelfCanvasProps> = ({
  albums,
  onBookClick,
  constellationEnabled,
}) => {
  const inputRef = useRef<BookshelfInputState>({
    wheelPx: 0,
    dragPx: 0,
    isDragging: false,
    lastPointerX: 0,
  });

  return (
    <div
      style={{
        width: '100%',
        height: 'clamp(420px, 62vh, 640px)',
        background: 'transparent',
        touchAction: 'none',
        overscrollBehavior: 'contain',
      }}
      onWheel={(e) => {
        // Treat wheel as horizontal time-axis scroll.
        e.preventDefault();
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        inputRef.current.wheelPx += delta;
      }}
      onPointerDown={(e) => {
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        inputRef.current.isDragging = true;
        inputRef.current.lastPointerX = e.clientX;
      }}
      onPointerMove={(e) => {
        if (!inputRef.current.isDragging) return;
        const dx = e.clientX - inputRef.current.lastPointerX;
        inputRef.current.lastPointerX = e.clientX;
        inputRef.current.dragPx += dx;
      }}
      onPointerUp={(e) => {
        try {
          (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
        inputRef.current.isDragging = false;
      }}
      onPointerCancel={() => {
        inputRef.current.isDragging = false;
      }}
    >
      <Canvas
        shadows
        camera={{
          // Fixed, front-facing camera.
          position: [0, 1.1, 6.5],
          fov: 32,
        }}
        gl={{
          alpha: true,
          antialias: true,
        }}
      >
        <Suspense fallback={null}>
          <Bookshelf3D
            albums={albums}
            onBookClick={onBookClick}
            constellationEnabled={constellationEnabled}
            inputRef={inputRef}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default BookshelfCanvas;
