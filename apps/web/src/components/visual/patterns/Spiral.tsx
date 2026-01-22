import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SpiralProps {
  isActive?: boolean;
}

const SpiralGeometry: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const spiralRef = useRef<THREE.Line>(null);
  const materialRef = useRef<THREE.LineBasicMaterial>(null);

  useFrame((state) => {
    if (!spiralRef.current) return;
    
    // Slow rotation - introspective motion
    spiralRef.current.rotation.z += isActive ? 0.002 : 0.001;
    
    // Gentle pulsing
    const pulse = Math.sin(state.clock.elapsedTime * 0.5) * 0.1 + 1;
    spiralRef.current.scale.setScalar(pulse);
    
    // Adjust opacity based on activity
    if (materialRef.current) {
      materialRef.current.opacity = isActive ? 0.6 : 0.3;
    }
  });

  // Create spiral geometry
  const points: THREE.Vector3[] = [];
  const turns = 5;
  const pointsPerTurn = 50;
  const totalPoints = turns * pointsPerTurn;
  
  for (let i = 0; i < totalPoints; i++) {
    const t = i / pointsPerTurn;
    const angle = t * Math.PI * 2;
    const radius = t * 0.5;
    
    points.push(new THREE.Vector3(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      t * 0.1
    ));
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);

  return (
    <line ref={spiralRef} geometry={geometry}>
      <lineBasicMaterial
        ref={materialRef}
        color="#D4AF37"
        linewidth={2}
        transparent
        opacity={0.6}
      />
    </line>
  );
};

const Spiral: React.FC<SpiralProps> = ({ isActive = false }) => {
  return (
    <div style={{ width: '100%', height: '400px', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 0 }}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.5} />
        <SpiralGeometry isActive={isActive} />
      </Canvas>
    </div>
  );
};

export default Spiral;
