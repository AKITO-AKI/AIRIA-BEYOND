import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { Album } from '../../contexts/AlbumContext';

interface Book3DProps {
  album: Album;
  position: [number, number, number];
  onClick: () => void;
  onHover: (isHovered: boolean) => void;
  isSelected: boolean;
  isHovered: boolean;
}

const Book3D: React.FC<Book3DProps> = ({
  album,
  position,
  onClick,
  onHover,
  isSelected,
  isHovered,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [targetZ, setTargetZ] = useState(0);
  const [targetRotX, setTargetRotX] = useState(0);

  // Dimensions
  const width = 1.2; // 120px in virtual units
  const height = 1.8; // 180px
  const thickness = (album.gallery?.thickness || 30) / 100; // Convert to virtual units

  // Animate hover and selection states
  useFrame(() => {
    if (!meshRef.current) return;

    // Target position and rotation based on state
    const newTargetZ = isHovered ? 0.5 : 0;
    const newTargetRotX = isHovered ? -0.05 : 0;

    if (newTargetZ !== targetZ) setTargetZ(newTargetZ);
    if (newTargetRotX !== targetRotX) setTargetRotX(newTargetRotX);

    // Smooth interpolation
    meshRef.current.position.z = THREE.MathUtils.lerp(
      meshRef.current.position.z,
      targetZ,
      0.1
    );
    meshRef.current.rotation.x = THREE.MathUtils.lerp(
      meshRef.current.rotation.x,
      targetRotX,
      0.1
    );
  });

  const spineColor = album.gallery?.spineColor || '#4A90E2';

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerOver={() => onHover(true)}
        onPointerOut={() => onHover(false)}
      >
        <boxGeometry args={[thickness, height, width]} />
        <meshStandardMaterial
          color={spineColor}
          metalness={0.3}
          roughness={0.7}
        />
      </mesh>

      {/* Glow effect when hovered */}
      {isHovered && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[thickness * 1.1, height * 1.1, width * 1.1]} />
          <meshBasicMaterial
            color={spineColor}
            transparent
            opacity={0.2}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {/* Tooltip when hovered */}
      {isHovered && (
        <Html position={[0, height / 2 + 0.3, 0]} center>
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.8)',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>
              {album.mood}
            </div>
            <div style={{ fontSize: '10px', opacity: 0.8 }}>
              {new Date(album.createdAt).toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </div>
            {album.metadata?.provider && (
              <div
                style={{
                  fontSize: '10px',
                  marginTop: '4px',
                  color: album.metadata.provider === 'replicate' ? '#D4AF37' : '#C0C0C0',
                }}
              >
                {album.metadata.provider === 'replicate' ? 'AI' : 'ローカル'}
              </div>
            )}
            {album.musicMetadata?.duration && (
              <div style={{ fontSize: '10px', opacity: 0.8, marginTop: '2px' }}>
                {Math.floor(album.musicMetadata.duration)}秒
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
};

export default Book3D;
