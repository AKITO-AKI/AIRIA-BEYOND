import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { Album } from '../../contexts/AlbumContext';
import {
  createNoiseTexture,
  createToonGradientTexture,
  patchMaterialWithGrain,
  updateMaterialGrainTime,
} from './toonTextures';

interface Book3DProps {
  album: Album;
  basePosition: [number, number, number];
  isFocused?: boolean;
  dimmed?: boolean;
  focusedPosition?: [number, number, number];
  faceOut: boolean;
  dragging?: boolean;
  onPointerDown?: (e: any) => void;
  onPointerMove?: (e: any) => void;
  onPointerUp?: (e: any) => void;
  onContextMenu?: () => void;
  onClick?: () => void;
  onDoubleClick?: () => void;
}

const Book3D: React.FC<Book3DProps> = ({
  album,
  basePosition,
  isFocused,
  dimmed,
  focusedPosition,
  faceOut,
  dragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onContextMenu,
  onClick,
  onDoubleClick,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const spineMeshRef = useRef<THREE.Mesh>(null);
  const coverGroupRef = useRef<THREE.Group>(null);
  const coverProgressRef = useRef(0);
  const [hovered, setHovered] = React.useState(false);

  const toonGradient = useMemo(() => createToonGradientTexture(4), []);
  const noiseTex = useMemo(() => createNoiseTexture(64), []);
  const spineMatRef = useRef<THREE.MeshToonMaterial>(null);
  const accentMatRef = useRef<THREE.MeshToonMaterial>(null);
  const coverMatRef = useRef<THREE.MeshToonMaterial>(null);

  useEffect(() => {
    patchMaterialWithGrain(spineMatRef.current, noiseTex, { strength: 0.10, scale: 18, speed: 0.28 });
    patchMaterialWithGrain(accentMatRef.current, noiseTex, { strength: 0.06, scale: 14, speed: 0.22 });
    patchMaterialWithGrain(coverMatRef.current, noiseTex, { strength: 0.06, scale: 12, speed: 0.20 });

    return () => {
      toonGradient.dispose();
      noiseTex.dispose();
    };
  }, [noiseTex, toonGradient]);

  // Dimensions (kept consistent for snapping/readability)
  const spineWidth = 0.22;
  const spineHeight = 1.45;
  const spineDepth = 0.55;

  const spineColor = album.gallery?.spineColor || '#111111';

  const { spineBaseColor, accentColor } = useMemo(() => {
    // Cohesive style: spines are mostly white, with a colored "stamp" taken from the album.
    const base = new THREE.Color('#f7f5f0');
    const acc = new THREE.Color(spineColor);
    // Keep accent slightly muted toward paper.
    acc.lerp(new THREE.Color('#ffffff'), 0.55);
    if (dimmed) {
      base.lerp(new THREE.Color('#d7d7d7'), 0.35);
      acc.lerp(new THREE.Color('#d7d7d7'), 0.55);
    }
    return {
      spineBaseColor: `#${base.getHexString()}`,
      accentColor: `#${acc.getHexString()}`,
    };
  }, [spineColor, dimmed]);

  const coverTint = dimmed ? '#b5b5b5' : '#ffffff';
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

    // Display modes:
    // - Focused: cover pulled forward (1)
    // - faceOut: cover facing outward, but only slightly forward (0.35)
    // - dragging: treat like focused (1)
    const target = dragging ? 1 : isFocused ? 1 : faceOut ? 0.35 : 0;
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

    if (groupRef.current && !dragging) {
      const targetScale = isFocused ? 1.06 : dimmed ? 0.985 : 1;
      const a = 1 - Math.exp(-10 * dt);
      const current = groupRef.current.scale.x;
      const next = THREE.MathUtils.lerp(current, targetScale, a);
      groupRef.current.scale.setScalar(next);
    }

    const time = _.clock.elapsedTime;
    updateMaterialGrainTime(spineMatRef.current, time);
    updateMaterialGrainTime(accentMatRef.current, time);
    updateMaterialGrainTime(coverMatRef.current, time);
  });

  return (
    <group ref={groupRef}>
      {/* Spine (minimal info only) */}
      <mesh
        ref={spineMeshRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onContextMenu={(e) => {
          e.stopPropagation();
          try {
            e.nativeEvent?.preventDefault?.();
          } catch {
            // ignore
          }
          onContextMenu?.();
        }}
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
        <meshToonMaterial
          ref={spineMatRef}
          color={spineBaseColor}
          gradientMap={toonGradient}
        />
      </mesh>

      {/* Graphic accent band (2D-like) */}
      <mesh position={[0, 0.18, spineDepth / 2 + 0.002]} castShadow={false}>
        <planeGeometry args={[spineWidth * 0.92, spineHeight * 0.22]} />
        <meshToonMaterial
          ref={accentMatRef}
          color={accentColor}
          gradientMap={toonGradient}
          transparent={Boolean(dimmed)}
          opacity={dimmed ? 0.35 : 0.95}
        />
      </mesh>

      {/* Status badges (public/favorite) */}
      <group position={[spineWidth / 2 - 0.05, spineHeight / 2 - 0.12, spineDepth / 2 + 0.03]}>
        {album.isPublic && (
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.06, 0.06, 0.02]} />
            <meshStandardMaterial
              color="#63e6be"
              roughness={0.4}
              metalness={0.1}
              transparent={Boolean(dimmed)}
              opacity={dimmed ? 0.25 : 1}
            />
          </mesh>
        )}
        {album.isFavorite && (
          <mesh position={[0, -0.08, 0]}>
            <boxGeometry args={[0.06, 0.06, 0.02]} />
            <meshStandardMaterial
              color="#d4af37"
              roughness={0.4}
              metalness={0.1}
              transparent={Boolean(dimmed)}
              opacity={dimmed ? 0.25 : 1}
            />
          </mesh>
        )}
      </group>

      {/* Hover tooltip instead of spine text (prevents overflow) */}
      {hovered && !dragging && !dimmed ? (
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
          onContextMenu={(e) => {
            e.stopPropagation();
            try {
              e.nativeEvent?.preventDefault?.();
            } catch {
              // ignore
            }
            onContextMenu?.();
          }}
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
          <meshToonMaterial ref={coverMatRef} map={coverTexture} color={coverTint} gradientMap={toonGradient} />
        </mesh>
        <mesh position={[0, 0, -0.01]} receiveShadow>
          <planeGeometry args={[1.14, 1.6]} />
          <meshToonMaterial color="#ffffff" opacity={dimmed ? 0.14 : 0.45} transparent gradientMap={toonGradient} />
        </mesh>
      </group>
    </group>
  );
};

export default Book3D;
