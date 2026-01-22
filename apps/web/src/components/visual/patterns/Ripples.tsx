import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface RipplesProps {
  isActive?: boolean;
  triggerRipple?: number; // Timestamp to trigger new ripple
}

interface Ripple {
  id: number;
  startTime: number;
}

const RipplesGeometry: React.FC<{ isActive: boolean; ripples: Ripple[] }> = ({ isActive, ripples }) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    
    const currentTime = state.clock.elapsedTime;
    
    // Update each ripple
    groupRef.current.children.forEach((child, index) => {
      if (ripples[index]) {
        const age = currentTime - ripples[index].startTime;
        const maxAge = 3; // Ripple lifetime in seconds
        
        if (age < maxAge) {
          // Expand outward
          const scale = 1 + age * 0.5;
          child.scale.setScalar(scale);
          
          // Fade out
          const opacity = 1 - (age / maxAge);
          if (child instanceof THREE.Line) {
            (child.material as THREE.LineBasicMaterial).opacity = opacity * (isActive ? 0.6 : 0.3);
          }
        } else {
          // Hide old ripples
          child.visible = false;
        }
      }
    });
  });

  // Create concentric circles for ripples
  const createRippleGeometry = () => {
    const points: THREE.Vector3[] = [];
    const segments = 64;
    const radius = 1;
    
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        0
      ));
    }
    
    return new THREE.BufferGeometry().setFromPoints(points);
  };

  return (
    <group ref={groupRef}>
      {ripples.slice(-5).map((ripple) => (
        <line key={ripple.id} geometry={createRippleGeometry()}>
          <lineBasicMaterial
            color="#D4AF37"
            linewidth={2}
            transparent
            opacity={0.6}
          />
        </line>
      ))}
    </group>
  );
};

const Ripples: React.FC<RipplesProps> = ({ isActive = false, triggerRipple }) => {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const rippleIdRef = useRef(0);

  // Add new ripple when triggered
  useEffect(() => {
    if (triggerRipple) {
      const newRipple = {
        id: rippleIdRef.current++,
        startTime: Date.now() / 1000, // Convert to seconds
      };
      setRipples((prev) => [...prev, newRipple].slice(-5)); // Keep max 5 ripples
    }
  }, [triggerRipple]);

  // Auto-generate ripples when active
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      const newRipple = {
        id: rippleIdRef.current++,
        startTime: Date.now() / 1000,
      };
      setRipples((prev) => [...prev, newRipple].slice(-5));
    }, 2000); // New ripple every 2 seconds

    return () => clearInterval(interval);
  }, [isActive]);

  return (
    <div style={{ width: '100%', height: '400px', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 0 }}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.5} />
        <RipplesGeometry isActive={isActive} ripples={ripples} />
      </Canvas>
    </div>
  );
};

export default Ripples;
