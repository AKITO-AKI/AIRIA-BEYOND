import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface LissajousCurveProps {
  isActive?: boolean;
}

const LissajousGeometry: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const curveRef = useRef<THREE.Line>(null);
  const materialRef = useRef<THREE.LineBasicMaterial>(null);

  useFrame((state) => {
    if (!curveRef.current) return;
    
    // Smooth figure-8 motion
    curveRef.current.rotation.z += isActive ? 0.001 : 0.0005;
    
    // Gentle pulsing
    const pulse = Math.sin(state.clock.elapsedTime * 0.3) * 0.05 + 1;
    curveRef.current.scale.setScalar(pulse);
    
    // Adjust opacity
    if (materialRef.current) {
      materialRef.current.opacity = isActive ? 0.5 : 0.25;
    }
  });

  // Create Lissajous curve (a=3, b=2 for figure-8 like pattern)
  const points: THREE.Vector3[] = [];
  const segments = 200;
  const a = 3;
  const b = 2;
  const delta = Math.PI / 2;
  
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    
    const x = Math.sin(a * t + delta) * 1.5;
    const y = Math.sin(b * t) * 1.5;
    const z = 0;
    
    points.push(new THREE.Vector3(x, y, z));
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);

  return (
    <line ref={curveRef} geometry={geometry}>
      <lineBasicMaterial
        ref={materialRef}
        color="#D4AF37"
        linewidth={2}
        transparent
        opacity={0.5}
      />
    </line>
  );
};

const LissajousCurve: React.FC<LissajousCurveProps> = ({ isActive = false }) => {
  return (
    <div style={{ width: '100%', height: '400px', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 0 }}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.5} />
        <LissajousGeometry isActive={isActive} />
      </Canvas>
    </div>
  );
};

export default LissajousCurve;
