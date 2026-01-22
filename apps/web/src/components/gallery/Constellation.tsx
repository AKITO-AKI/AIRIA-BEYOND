import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Album } from '../../contexts/AlbumContext';
import { createConstellation, calculateBookPosition, calculate3DPosition } from '../../utils/galleryHelpers';

interface ConstellationProps {
  albums: Album[];
  hoveredAlbumId: string | null;
  enabled: boolean;
}

const Constellation: React.FC<ConstellationProps> = ({
  albums,
  hoveredAlbumId,
  enabled,
}) => {
  const linesRef = useRef<THREE.LineSegments>(null);

  // Calculate connections
  const connections = useMemo(() => {
    if (!enabled || albums.length < 2) return [];
    return createConstellation(albums, 0.7);
  }, [albums, enabled]);

  // Create geometry for all connection lines
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];

    connections.forEach((connection) => {
      const fromAlbum = albums.find((a) => a.id === connection.from);
      const toAlbum = albums.find((a) => a.id === connection.to);

      if (!fromAlbum || !toAlbum) return;

      // Get positions
      const fromIndex = albums.indexOf(fromAlbum);
      const toIndex = albums.indexOf(toAlbum);

      const fromBookPos = calculateBookPosition(fromIndex);
      const toBookPos = calculateBookPosition(toIndex);

      const from3D = calculate3DPosition(
        fromBookPos.shelfIndex,
        fromBookPos.positionIndex,
        fromAlbum.gallery?.thickness || 30
      );
      const to3D = calculate3DPosition(
        toBookPos.shelfIndex,
        toBookPos.positionIndex,
        toAlbum.gallery?.thickness || 30
      );

      // Add line segment
      positions.push(from3D[0], from3D[1], from3D[2]);
      positions.push(to3D[0], to3D[1], to3D[2]);

      // Gold color with varying opacity based on strength
      const isHighlighted =
        hoveredAlbumId === connection.from || hoveredAlbumId === connection.to;
      const opacity = isHighlighted ? connection.strength : connection.strength * 0.5;

      // RGB for gold (#D4AF37) - normalized to 0-1 range
      const r = 0xd4 / 255;
      const g = 0xaf / 255;
      const b = 0x37 / 255;

      colors.push(r, g, b, opacity);
      colors.push(r, g, b, opacity);
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));

    return geo;
  }, [connections, albums, hoveredAlbumId]);

  // Animate pulsing effect
  useFrame((state) => {
    if (!linesRef.current) return;

    const pulse = Math.sin(state.clock.elapsedTime * 0.5) * 0.1 + 0.9;
    linesRef.current.scale.setScalar(pulse);
  });

  if (!enabled || connections.length === 0) return null;

  return (
    <lineSegments ref={linesRef} geometry={geometry}>
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={0.5}
        linewidth={2}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
};

export default Constellation;
