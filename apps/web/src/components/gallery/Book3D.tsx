import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { Album } from '../../contexts/AlbumContext';

interface Book3DProps {
  album: Album;
  position: [number, number, number];
  onClick: () => void;
  isSelected: boolean;
}

const Book3D: React.FC<Book3DProps> = ({
  album,
  position,
  onClick,
  isSelected,
}) => {
  const spineMeshRef = useRef<THREE.Mesh>(null);
  const coverGroupRef = useRef<THREE.Group>(null);
  const coverProgressRef = useRef(0);

  // Dimensions (kept consistent for snapping/readability)
  const spineWidth = 0.22;
  const spineHeight = 1.8;
  const spineDepth = 0.55;

  const spineColor = album.gallery?.spineColor || '#111111';
  const labelPrimary = album.title || album.mood;
  const labelSecondary = useMemo(() => {
    const d = new Date(album.createdAt);
    return d.toLocaleDateString('ja-JP', { year: '2-digit', month: '2-digit', day: '2-digit' });
  }, [album.createdAt]);

  const coverTexture = useLoader(THREE.TextureLoader, album.imageDataURL);
  useEffect(() => {
    coverTexture.colorSpace = THREE.SRGBColorSpace;
    coverTexture.anisotropy = 4;
    coverTexture.needsUpdate = true;
  }, [coverTexture]);

  useFrame((_, dt) => {
    const target = isSelected ? 1 : 0;
    const speed = 8;
    coverProgressRef.current = THREE.MathUtils.lerp(
      coverProgressRef.current,
      target,
      1 - Math.exp(-speed * dt)
    );

    if (coverGroupRef.current) {
      const t = coverProgressRef.current;
      // Slide forward + slight lift; depth is mostly shadow.
      coverGroupRef.current.position.z = (spineDepth / 2 + 0.04) + t * 0.7;
      coverGroupRef.current.position.y = t * 0.08;
      coverGroupRef.current.scale.setScalar(0.92 + t * 0.08);
      coverGroupRef.current.visible = t > 0.01;
    }

    if (spineMeshRef.current) {
      // Subtle emphasis only via brightness, not motion.
      const t = coverProgressRef.current;
      spineMeshRef.current.scale.y = 1 + t * 0.02;
    }
  });

  return (
    <group position={position}>
      {/* Spine (minimal info only) */}
      <mesh
        ref={spineMeshRef}
        onClick={onClick}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[spineWidth, spineHeight, spineDepth]} />
        <meshStandardMaterial color={spineColor} roughness={0.9} metalness={0.05} />
      </mesh>

      {/* Status badges (public/favorite) */}
      <group position={[spineWidth / 2 - 0.05, spineHeight / 2 - 0.12, spineDepth / 2 + 0.03]}>
        {album.isPublic && (
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.06, 0.06, 0.02]} />
            <meshStandardMaterial color="#63e6be" roughness={0.4} metalness={0.1} />
          </mesh>
        )}
        {album.isFavorite && (
          <mesh position={[0, -0.08, 0]}>
            <boxGeometry args={[0.06, 0.06, 0.02]} />
            <meshStandardMaterial color="#d4af37" roughness={0.4} metalness={0.1} />
          </mesh>
        )}
      </group>

      {/* Minimal spine text (2 items max) */}
      <group position={[0, 0, spineDepth / 2 + 0.01]}>
        <Text
          fontSize={0.12}
          color={spineColor === '#111111' ? '#f5f5f5' : '#111111'}
          anchorX="center"
          anchorY="middle"
          maxWidth={0.9}
        >
          {labelPrimary}
        </Text>
        <Text
          position={[0, -0.16, 0]}
          fontSize={0.08}
          color={spineColor === '#111111' ? '#f5f5f5' : '#111111'}
          fillOpacity={spineColor === '#111111' ? 0.75 : 0.55}
          anchorX="center"
          anchorY="middle"
          maxWidth={0.9}
        >
          {labelSecondary}
        </Text>
      </group>

      {/* Cover: only when selected (slides forward) */}
      <group ref={coverGroupRef} position={[0, 0.05, spineDepth / 2 + 0.04]} visible={false}>
        <mesh onClick={onClick} castShadow>
          <planeGeometry args={[1.1, 1.55]} />
          <meshStandardMaterial map={coverTexture} roughness={0.85} metalness={0.0} />
        </mesh>
        <mesh position={[0, 0, -0.01]} receiveShadow>
          <planeGeometry args={[1.14, 1.6]} />
          <meshStandardMaterial color="#ffffff" roughness={1} metalness={0} opacity={0.6} transparent />
        </mesh>
      </group>
    </group>
  );
};

export default Book3D;
