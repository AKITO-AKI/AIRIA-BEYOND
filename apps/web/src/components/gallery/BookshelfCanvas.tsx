import React, { Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import Bookshelf3D from './Bookshelf3D';
import { Album } from '../../contexts/AlbumContext';

interface BookshelfCanvasProps {
  albums: Album[];
  onBookClick: (albumId: string) => void;
  onBookOpen?: (albumId: string) => void;
  constellationEnabled: boolean;
}

export interface BookshelfInputState {
  wheelPx: number;
  dragPx: number;
  isDragging: boolean;
  lastPointerX: number;
  blockPan: boolean;
}

const BookshelfCanvas: React.FC<BookshelfCanvasProps> = ({
  albums,
  onBookClick,
  onBookOpen,
  constellationEnabled,
}) => {
  const inputRef = useRef<BookshelfInputState>({
    wheelPx: 0,
    dragPx: 0,
    isDragging: false,
    lastPointerX: 0,
    blockPan: false,
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
        if (inputRef.current.blockPan) return;
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        inputRef.current.wheelPx += delta;
      }}
      onPointerDown={(e) => {
        if (inputRef.current.blockPan) return;
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        inputRef.current.isDragging = true;
        inputRef.current.lastPointerX = e.clientX;
      }}
      onPointerMove={(e) => {
        if (inputRef.current.blockPan) return;
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
        inputRef.current.blockPan = false;
      }}
      onPointerCancel={() => {
        inputRef.current.isDragging = false;
        inputRef.current.blockPan = false;
      }}
    >
      <Canvas
        shadows
        camera={{
          // Fixed, front-facing camera.
          position: [0, 0.55, 7.2],
          fov: 34,
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
            onBookOpen={onBookOpen}
            constellationEnabled={constellationEnabled}
            inputRef={inputRef}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default BookshelfCanvas;
