import React, { useRef, useState, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
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

  // Create texture from image data URL
  const spineTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Create texture first
    const texture = new THREE.CanvasTexture(canvas);
    
    if (ctx) {
      // Background color
      ctx.fillStyle = spineColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Load and draw album image
      const img = new Image();
      img.src = album.imageDataURL;
      img.onload = () => {
        // Draw small preview of album image
        const imgSize = 180;
        const imgX = (canvas.width - imgSize) / 2;
        const imgY = (canvas.height - imgSize) / 2;
        ctx.drawImage(img, imgX, imgY, imgSize, imgSize);
        
        // Draw badge if provider exists
        if (album.metadata?.provider) {
          const badge = album.metadata.provider === 'replicate' ? 'AI' : 'ローカル';
          const badgeColor = album.metadata.provider === 'replicate' ? '#D4AF37' : '#C0C0C0';
          
          ctx.fillStyle = badgeColor;
          ctx.font = 'bold 24px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(badge, canvas.width / 2, 40);
        }
        
        texture.needsUpdate = true;
      };
    }
    
    return texture;
  }, [album.imageDataURL, spineColor, album.metadata?.provider]);

  return (
    <group position={position}>
      {/* Main book body */}
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerOver={() => onHover(true)}
        onPointerOut={() => onHover(false)}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[thickness, height, width]} />
        <meshStandardMaterial
          map={spineTexture}
          metalness={0.3}
          roughness={0.7}
        />
      </mesh>

      {/* Edge highlights */}
      <mesh position={[thickness / 2, 0, 0]}>
        <boxGeometry args={[0.02, height, width]} />
        <meshStandardMaterial
          color={spineColor}
          metalness={0.8}
          roughness={0.2}
          emissive={spineColor}
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* Glow effect when hovered */}
      {isHovered && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[thickness * 1.15, height * 1.1, width * 1.1]} />
          <meshBasicMaterial
            color={spineColor}
            transparent
            opacity={0.3}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {/* Tooltip when hovered */}
      {isHovered && (
        <Html position={[0, height / 2 + 0.4, 0]} center>
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.85)',
              color: 'white',
              padding: '10px 14px',
              borderRadius: '10px',
              fontSize: '13px',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: '6px', fontSize: '14px' }}>
              {album.mood}
            </div>
            <div style={{ fontSize: '11px', opacity: 0.8 }}>
              {new Date(album.createdAt).toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </div>
            {album.metadata?.provider && (
              <div
                style={{
                  fontSize: '11px',
                  marginTop: '4px',
                  color: album.metadata.provider === 'replicate' ? '#D4AF37' : '#C0C0C0',
                  fontWeight: 600,
                }}
              >
                {album.metadata.provider === 'replicate' ? '✨ AI生成' : '📁 ローカル'}
              </div>
            )}
            {album.musicMetadata?.duration && (
              <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>
                ♪ {Math.floor(album.musicMetadata.duration)}秒
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
};

export default Book3D;
