import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Bookshelf3D from './Bookshelf3D';
import { Album } from '../../contexts/AlbumContext';

interface BookshelfCanvasProps {
  albums: Album[];
  onBookClick: (albumId: string) => void;
  constellationEnabled: boolean;
}

const BookshelfCanvas: React.FC<BookshelfCanvasProps> = ({
  albums,
  onBookClick,
  constellationEnabled,
}) => {
  return (
    <div style={{ width: '100%', height: '700px', background: 'transparent' }}>
      <Canvas
        shadows
        camera={{
          position: [0, 5, 15],
          fov: 50,
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
          />

          {/* Orbit controls for camera manipulation */}
          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 2.2}
            minDistance={8}
            maxDistance={25}
            target={[0, 3, 0]}
            enablePan={false}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default BookshelfCanvas;
