import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export type PolyhedronLayer = 'foreground' | 'background';
export type PolyhedronPlacement = 'center' | 'topRight' | 'topLeft' | 'bottomRight' | 'bottomLeft';

interface PolyhedronProps {
  isActive?: boolean;
  progress?: number; // 0-1 for loading progress
  onComplete?: () => void;
  dominantColor?: string;
  layer?: PolyhedronLayer;
  placement?: PolyhedronPlacement;
  sizePx?: number;
  opacity?: number;
}

interface PolyhedronGeometryProps {
  isActive: boolean;
  progress: number;
  dominantColor: string;
  onComplete?: () => void;
  mousePos: { x: number; y: number };
}

const PolyhedronGeometry: React.FC<PolyhedronGeometryProps> = ({
  isActive,
  progress,
  dominantColor,
  onComplete,
  mousePos,
}) => {
  const polyhedronRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const [dissolving, setDissolving] = useState(false);
  const [currentFace, setCurrentFace] = useState(0);

  // Parse color
  const color = useMemo(() => {
    return new THREE.Color(dominantColor);
  }, [dominantColor]);

  // Create particle system for dissolution
  const particleGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(100 * 3);
    const velocities = new Float32Array(100 * 3);

    for (let i = 0; i < 100; i++) {
      // Random positions on sphere surface
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 1;

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      // Outward velocities
      velocities[i * 3] = positions[i * 3] * 0.02;
      velocities[i * 3 + 1] = positions[i * 3 + 1] * 0.02;
      velocities[i * 3 + 2] = positions[i * 3 + 2] * 0.02;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));

    return geometry;
  }, []);

  useFrame((state) => {
    if (!polyhedronRef.current) return;

    // Slow rotation (30s per full rotation)
    const rotationSpeed = isActive ? (2 * Math.PI) / (30 * 60) : (2 * Math.PI) / (60 * 60);
    polyhedronRef.current.rotation.y += rotationSpeed;
    polyhedronRef.current.rotation.x += rotationSpeed * 0.5;

    // Mouse influence
    if (isActive && mousePos.x !== 0 && mousePos.y !== 0) {
      const targetRotationY = (mousePos.x / window.innerWidth - 0.5) * 0.5;
      const targetRotationX = (mousePos.y / window.innerHeight - 0.5) * 0.5;
      
      polyhedronRef.current.rotation.y += (targetRotationY - polyhedronRef.current.rotation.y) * 0.1;
      polyhedronRef.current.rotation.x += (targetRotationX - polyhedronRef.current.rotation.x) * 0.1;
    }

    // Update active face based on progress
    const totalFaces = 20;
    const newFace = Math.floor(progress * totalFaces);
    if (newFace !== currentFace && newFace < totalFaces) {
      setCurrentFace(newFace);
    }

    // Trigger dissolution when complete
    if (progress >= 1 && !dissolving) {
      setDissolving(true);
      setTimeout(() => {
        onComplete?.();
      }, 1500);
    }

    // Animate particles during dissolution
    if (dissolving && particlesRef.current) {
      const positions = particleGeometry.getAttribute('position') as THREE.BufferAttribute;
      const velocities = particleGeometry.getAttribute('velocity') as THREE.BufferAttribute;

      for (let i = 0; i < 100; i++) {
        positions.setXYZ(
          i,
          positions.getX(i) + velocities.getX(i),
          positions.getY(i) + velocities.getY(i),
          positions.getZ(i) + velocities.getZ(i)
        );
      }

      positions.needsUpdate = true;
      
      // Fade out polyhedron
      if (polyhedronRef.current.material instanceof THREE.Material) {
        polyhedronRef.current.material.opacity = Math.max(0, polyhedronRef.current.material.opacity - 0.02);
      }
    }
  });

  return (
    <group>
      {!dissolving && (
        <mesh ref={polyhedronRef}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color={color}
            transparent
            opacity={0.8}
            wireframe={false}
            emissive={color}
            emissiveIntensity={currentFace / 20}
          />
        </mesh>
      )}
      {dissolving && (
        <points ref={particlesRef} geometry={particleGeometry}>
          <pointsMaterial
            color={color}
            size={0.05}
            transparent
            opacity={0.8}
          />
        </points>
      )}
    </group>
  );
};

const Polyhedron: React.FC<PolyhedronProps> = ({
  isActive = false,
  progress = 0,
  onComplete,
  dominantColor = '#D4AF37',
  layer = 'foreground',
  placement = 'center',
  sizePx = 400,
  opacity,
}) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const placementStyle: React.CSSProperties = (() => {
    switch (placement) {
      case 'topRight':
        return { top: '30%', left: '75%' };
      case 'topLeft':
        return { top: '30%', left: '25%' };
      case 'bottomRight':
        return { top: '70%', left: '75%' };
      case 'bottomLeft':
        return { top: '70%', left: '25%' };
      case 'center':
      default:
        return { top: '50%', left: '50%' };
    }
  })();

  const isBackground = layer === 'background';
  const containerOpacity = typeof opacity === 'number' ? opacity : isBackground ? 0.14 : 1;

  return (
    <div
      style={{
        width: '100%',
        height: `${sizePx}px`,
        position: 'absolute',
        ...placementStyle,
        transform: 'translate(-50%, -50%)',
        pointerEvents: isBackground ? 'none' : isActive ? 'auto' : 'none',
        zIndex: isBackground ? -1 : 0,
        opacity: containerOpacity,
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 3], fov: 50 }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <PolyhedronGeometry
          isActive={isActive}
          progress={progress}
          dominantColor={dominantColor}
          onComplete={onComplete}
          mousePos={mousePos}
        />
      </Canvas>
    </div>
  );
};

export default Polyhedron;
