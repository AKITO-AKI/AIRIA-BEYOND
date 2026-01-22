import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface StringVibrationProps {
  isActive?: boolean;
  audioData?: {
    bass: number;
    midLow: number;
    mid: number;
    midHigh: number;
    treble: number;
  } | null;
  valence?: number; // -1 to 1
  arousal?: number; // 0 to 1
}

interface StringProps {
  index: number;
  frequency: number;
  amplitude: number;
  color: string;
  mousePos: { x: number; y: number };
  plucked: boolean;
}

const VibrationString: React.FC<StringProps> = ({
  index,
  frequency,
  amplitude,
  color,
  mousePos,
  plucked,
}) => {
  const lineRef = useRef<THREE.Line>(null);
  const [phase, setPhase] = useState(0);
  const [bouncePhase, setBouncePhase] = useState(0);

  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const numPoints = 100;
    const length = 4;

    for (let i = 0; i < numPoints; i++) {
      const x = (i / numPoints) * length - length / 2;
      pts.push(new THREE.Vector3(x, 0, 0));
    }

    return pts;
  }, []);

  useFrame((state) => {
    if (!lineRef.current) return;

    const positions = lineRef.current.geometry.attributes.position;
    const length = 4;
    const numPoints = 100;

    // Update phase
    setPhase((p) => p + frequency * 0.01);
    
    // Bounce animation when plucked
    if (plucked) {
      setBouncePhase((p) => p + 0.2);
    }

    const bounceAmp = plucked ? Math.exp(-bouncePhase) * 0.5 : 0;

    for (let i = 0; i < numPoints; i++) {
      const x = (i / numPoints) * length - length / 2;
      const t = i / numPoints;

      // Mouse proximity effect
      const mouseX = (mousePos.x / window.innerWidth - 0.5) * 8;
      const mouseY = (mousePos.y / window.innerHeight - 0.5) * 6;
      const stringY = (index - 2) * 0.4;
      
      const distance = Math.sqrt(
        Math.pow(mouseX - x, 2) + Math.pow(mouseY - stringY, 2)
      );
      const mouseInfluence = Math.max(0, 1 - distance / 2) * 0.3;

      // Vibration
      const vibration = (amplitude + mouseInfluence + bounceAmp) * Math.sin(frequency * x + phase);
      
      const y = vibration;
      const z = vibration * 0.2;

      positions.setXYZ(i, x, y, z);
    }

    positions.needsUpdate = true;

    // Position the string
    lineRef.current.position.y = (index - 2) * 0.4;
  });

  const geometry = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [points]);

  return (
    <line ref={lineRef} geometry={geometry}>
      <lineBasicMaterial color={color} linewidth={2} transparent opacity={0.8} />
    </line>
  );
};

const StringVibrationGeometry: React.FC<{
  isActive: boolean;
  audioData: any;
  valence: number;
  arousal: number;
  mousePos: { x: number; y: number };
  pluckedIndex: number;
}> = ({ isActive, audioData, valence, arousal, mousePos, pluckedIndex }) => {
  // Map frequency bands to string properties
  const strings = useMemo(() => {
    const baseFrequency = valence < 0 ? 1 : 2;
    const baseAmplitude = arousal * 0.2;

    return [
      {
        frequency: baseFrequency,
        amplitude: audioData?.bass ? (audioData.bass / 255) * 0.3 : baseAmplitude,
        color: '#FF4444', // Red for bass
      },
      {
        frequency: baseFrequency * 1.5,
        amplitude: audioData?.midLow ? (audioData.midLow / 255) * 0.3 : baseAmplitude * 0.8,
        color: '#FF8844', // Orange for mid-low
      },
      {
        frequency: baseFrequency * 2,
        amplitude: audioData?.mid ? (audioData.mid / 255) * 0.3 : baseAmplitude * 0.6,
        color: '#FFDD44', // Yellow for mid
      },
      {
        frequency: baseFrequency * 2.5,
        amplitude: audioData?.midHigh ? (audioData.midHigh / 255) * 0.3 : baseAmplitude * 0.4,
        color: '#44DDFF', // Cyan for mid-high
      },
      {
        frequency: baseFrequency * 3,
        amplitude: audioData?.treble ? (audioData.treble / 255) * 0.3 : baseAmplitude * 0.2,
        color: '#8844FF', // Violet for treble
      },
    ];
  }, [audioData, valence, arousal]);

  return (
    <group>
      {strings.map((string, index) => (
        <VibrationString
          key={index}
          index={index}
          frequency={string.frequency}
          amplitude={string.amplitude}
          color={string.color}
          mousePos={mousePos}
          plucked={pluckedIndex === index}
        />
      ))}
    </group>
  );
};

const StringVibration: React.FC<StringVibrationProps> = ({
  isActive = false,
  audioData = null,
  valence = 0,
  arousal = 0.5,
}) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [pluckedIndex, setPluckedIndex] = useState(-1);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    // Determine which string was clicked based on Y position
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const stringIndex = Math.floor((y / rect.height) * 5);
    
    setPluckedIndex(stringIndex);
    setTimeout(() => setPluckedIndex(-1), 1000);
  };

  return (
    <div
      style={{
        width: '100%',
        height: '400px',
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: isActive ? 'auto' : 'none',
        zIndex: 0,
      }}
      onClick={handleClick}
    >
      <Canvas
        camera={{ position: [0, 0, 4], fov: 50 }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.5} />
        <StringVibrationGeometry
          isActive={isActive}
          audioData={audioData}
          valence={valence}
          arousal={arousal}
          mousePos={mousePos}
          pluckedIndex={pluckedIndex}
        />
      </Canvas>
    </div>
  );
};

export default StringVibration;
