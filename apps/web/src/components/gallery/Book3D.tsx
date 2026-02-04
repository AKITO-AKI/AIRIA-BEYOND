import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { Album } from '../../contexts/AlbumContext';

interface Book3DProps {
  album: Album;
  basePosition: [number, number, number];
  isFocused?: boolean;
  focusedPosition?: [number, number, number];
  faceOut: boolean;
  dragging?: boolean;
  onPointerDown?: (e: any) => void;
  onPointerMove?: (e: any) => void;
  onPointerUp?: (e: any) => void;
  onClick?: () => void;
  onDoubleClick?: () => void;
}

const Book3D: React.FC<Book3DProps> = ({
  album,
  basePosition,
  isFocused,
  focusedPosition,
  faceOut,
  dragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onClick,
  onDoubleClick,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const spineMeshRef = useRef<THREE.Mesh>(null);
  const coverGroupRef = useRef<THREE.Group>(null);
  const coverProgressRef = useRef(0);
  const [hovered, setHovered] = React.useState(false);

  // Dimensions (kept consistent for snapping/readability)
  const spineWidth = 0.22;
  const spineHeight = 1.45;
  const spineDepth = 0.55;

  const spineColor = album.gallery?.spineColor || '#111111';
  const labelPrimary = album.title || album.mood;
  const labelSecondary = useMemo(() => {
    const d = new Date(album.createdAt);
    return d.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }, [album.createdAt]);

  const coverTexture = useLoader(THREE.TextureLoader, album.imageDataURL);
  useEffect(() => {
    coverTexture.colorSpace = THREE.SRGBColorSpace;
    coverTexture.anisotropy = 4;
    coverTexture.needsUpdate = true;
  }, [coverTexture]);

  useFrame((_, dt) => {
    // Position (smooth focus animation)
    if (groupRef.current) {
      const target = (isFocused && focusedPosition) ? focusedPosition : basePosition;
      if (dragging) {
        groupRef.current.position.set(target[0], target[1], target[2]);
      } else {
        const speed = isFocused ? 10 : 12;
        const a = 1 - Math.exp(-speed * dt);
        groupRef.current.position.lerp(new THREE.Vector3(target[0], target[1], target[2]), a);
      }
    }

    const target = faceOut || dragging ? 1 : 0;
    const speed = 8;
    coverProgressRef.current = THREE.MathUtils.lerp(
      coverProgressRef.current,
      target,
      1 - Math.exp(-speed * dt)
    );

    if (coverGroupRef.current) {
      const t = coverProgressRef.current;
      // Slide forward + slight lift.
      coverGroupRef.current.position.z = (spineDepth / 2 + 0.04) + t * 0.85;
      coverGroupRef.current.position.y = 0.05 + t * 0.06;
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
    <group ref={groupRef}>
      {/* Spine (minimal info only) */}
      <mesh
        ref={spineMeshRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onDoubleClick?.();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
        }}
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

      {/* Hover tooltip instead of spine text (prevents overflow) */}
      {hovered && !dragging ? (
        <Html
          position={[0, spineHeight / 2 + 0.22, spineDepth / 2 + 0.06]}
          center
          style={{ pointerEvents: 'none' }}
          transform
          distanceFactor={8}
        >
          <div className="book-tooltip">
            <div className="book-tooltip-title">{labelPrimary}</div>
            <div className="book-tooltip-sub">{labelSecondary}</div>
          </div>
        </Html>
      ) : null}

      {/* Cover: only when selected (slides forward) */}
      <group ref={coverGroupRef} position={[0, 0.05, spineDepth / 2 + 0.04]} visible={false}>
        <mesh
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onDoubleClick?.();
          }}
          castShadow
        >
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
