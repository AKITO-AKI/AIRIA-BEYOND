import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Album } from '../../contexts/AlbumContext';
import Book3D from './Book3D';
import type { BookshelfInputState } from './BookshelfCanvas';

interface Bookshelf3DProps {
  albums: Album[];
  onBookClick: (albumId: string) => void;
  constellationEnabled: boolean;
  inputRef: React.MutableRefObject<BookshelfInputState>;
}

const Bookshelf3D: React.FC<Bookshelf3DProps> = ({
  albums,
  onBookClick,
  constellationEnabled: _constellationEnabled,
  inputRef,
}) => {
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);

  const shelfGroupRef = useRef<THREE.Group>(null);
  const offsetRef = useRef(0); // 0..max (world units)
  const velocityRef = useRef(0);

  const spacing = 0.32;
  const maxOffset = Math.max(0, (albums.length - 1) * spacing);

  const positions = useMemo(() => {
    // Time axis: newest (index 0) is centered; older extend to the left.
    return albums.map((_, index) => ({ x: -index * spacing, y: 0, z: 0 }));
  }, [albums, spacing]);

  useFrame((_, dt) => {
    const input = inputRef.current;

    // Convert pixels -> world units
    const pxToWorld = 0.0022;
    const wheelWorld = input.wheelPx * pxToWorld;
    const dragWorld = input.dragPx * pxToWorld;

    if (wheelWorld !== 0) {
      // Wheel down => move to older (increase offset)
      velocityRef.current += wheelWorld * 26;
      input.wheelPx = 0;
    }

    if (dragWorld !== 0) {
      // Drag right => show newer (decrease offset)
      offsetRef.current -= dragWorld;
      velocityRef.current = THREE.MathUtils.lerp(velocityRef.current, -dragWorld * 60, 0.35);
      input.dragPx = 0;
    }

    // Inertia
    const friction = input.isDragging ? 0.88 : 0.92;
    velocityRef.current *= Math.pow(friction, dt * 60);
    offsetRef.current += velocityRef.current * dt;

    // Soft bounds + bounce
    const overscroll = 0.9;
    const spring = 40;
    if (offsetRef.current < -overscroll) {
      offsetRef.current = -overscroll;
      velocityRef.current *= -0.35;
    } else if (offsetRef.current > maxOffset + overscroll) {
      offsetRef.current = maxOffset + overscroll;
      velocityRef.current *= -0.35;
    }

    if (offsetRef.current < 0) {
      velocityRef.current += (0 - offsetRef.current) * spring * dt;
    } else if (offsetRef.current > maxOffset) {
      velocityRef.current -= (offsetRef.current - maxOffset) * spring * dt;
    }

    // Snap when not interacting
    const shouldSnap = !input.isDragging && Math.abs(velocityRef.current) < 0.15;
    if (shouldSnap && albums.length > 0) {
      const nearestIndex = Math.max(0, Math.min(albums.length - 1, Math.round(offsetRef.current / spacing)));
      const snapTarget = nearestIndex * spacing;
      const snapStrength = 10;
      offsetRef.current = THREE.MathUtils.lerp(offsetRef.current, snapTarget, 1 - Math.exp(-snapStrength * dt));
    }

    if (shelfGroupRef.current) {
      shelfGroupRef.current.position.x = offsetRef.current;
    }
  });

  return (
    <group>
      {/* Shelf plane (depth via shadow only) */}
      <mesh position={[0, -1.05, -0.25]} receiveShadow>
        <planeGeometry args={[30, 6]} />
        <meshStandardMaterial color="#f5f5f5" roughness={1} metalness={0} />
      </mesh>

      {/* Subtle back panel to anchor the scene */}
      <mesh position={[0, 0.4, -0.6]} receiveShadow>
        <planeGeometry args={[30, 8]} />
        <meshStandardMaterial color="#fafafa" roughness={1} metalness={0} />
      </mesh>

      <group ref={shelfGroupRef}>
        {albums.map((album, index) => {
          const p = positions[index];
          const position: [number, number, number] = [p.x, p.y, p.z];
          return (
            <Book3D
              key={album.id}
              album={album}
              position={position}
              onClick={() => {
                setSelectedBookId(album.id);
                // Snap to clicked book immediately.
                offsetRef.current = index * spacing;
                velocityRef.current = 0;
                onBookClick(album.id);
              }}
              isSelected={selectedBookId === album.id}
            />
          );
        })}
      </group>

      {/* Lighting: quiet and readable */}
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[4, 6, 6]}
        intensity={0.65}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
      />
      <directionalLight position={[-3, 3, 4]} intensity={0.22} />
    </group>
  );
};

export default Bookshelf3D;
