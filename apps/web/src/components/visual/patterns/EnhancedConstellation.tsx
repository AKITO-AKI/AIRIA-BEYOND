import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Album } from '../../../contexts/AlbumContext';
import { createConstellation, calculateBookPosition, calculate3DPosition } from '../../../utils/galleryHelpers';

interface EnhancedConstellationProps {
  albums: Album[];
  hoveredAlbumId: string | null;
  enabled: boolean;
}

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  lifetime: number;
  maxLifetime: number;
  connectionIndex: number;
}

const EnhancedConstellation: React.FC<EnhancedConstellationProps> = ({
  albums,
  hoveredAlbumId,
  enabled,
}) => {
  const linesRef = useRef<THREE.LineSegments>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const particleSystemRef = useRef<Particle[]>([]);

  // Calculate connections
  const connections = useMemo(() => {
    if (!enabled || albums.length < 2) return [];
    return createConstellation(albums, 0.7);
  }, [albums, enabled]);

  // Create geometry for all connection lines
  const { lineGeometry, connectionPaths } = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const paths: Array<{ from: THREE.Vector3; to: THREE.Vector3; strength: number }> = [];

    connections.forEach((connection) => {
      const fromAlbum = albums.find((a) => a.id === connection.from);
      const toAlbum = albums.find((a) => a.id === connection.to);

      if (!fromAlbum || !toAlbum) return;

      // Get positions
      const fromIndex = albums.indexOf(fromAlbum);
      const toIndex = albums.indexOf(toAlbum);

      const fromBookPos = calculateBookPosition(fromIndex);
      const toBookPos = calculateBookPosition(toIndex);

      const from3D = calculate3DPosition(
        fromBookPos.shelfIndex,
        fromBookPos.positionIndex,
        fromAlbum.gallery?.thickness || 30
      );
      const to3D = calculate3DPosition(
        toBookPos.shelfIndex,
        toBookPos.positionIndex,
        toAlbum.gallery?.thickness || 30
      );

      const fromVec = new THREE.Vector3(from3D[0], from3D[1], from3D[2]);
      const toVec = new THREE.Vector3(to3D[0], to3D[1], to3D[2]);

      paths.push({ from: fromVec, to: toVec, strength: connection.strength });

      // Add line segment
      positions.push(from3D[0], from3D[1], from3D[2]);
      positions.push(to3D[0], to3D[1], to3D[2]);

      // Color based on emotional similarity
      const isHighlighted =
        hoveredAlbumId === connection.from || hoveredAlbumId === connection.to;
      const opacity = isHighlighted ? connection.strength : connection.strength * 0.5;

      // Color code by connection strength (warmer = stronger connection)
      let r, g, b;
      if (connection.strength > 0.8) {
        // Strong connection - bright gold
        r = 0xd4 / 255;
        g = 0xaf / 255;
        b = 0x37 / 255;
      } else if (connection.strength > 0.6) {
        // Medium connection - pale gold
        r = 0xf4 / 255;
        g = 0xe5 / 255;
        b = 0xc2 / 255;
      } else {
        // Weak connection - subtle bronze
        r = 0xb8 / 255;
        g = 0x94 / 255;
        b = 0x1e / 255;
      }

      colors.push(r, g, b, opacity);
      colors.push(r, g, b, opacity);
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));

    return { lineGeometry: geo, connectionPaths: paths };
  }, [connections, albums, hoveredAlbumId]);

  // Create particle geometry
  const particleGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const maxParticles = 100;
    const positions = new Float32Array(maxParticles * 3);
    const colors = new Float32Array(maxParticles * 3);

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    return geo;
  }, []);

  // Animate pulsing effect and particles
  useFrame((state) => {
    if (!linesRef.current) return;

    const pulse = Math.sin(state.clock.elapsedTime * 0.5) * 0.1 + 0.9;
    linesRef.current.scale.setScalar(pulse);

    // Spawn particles along connection paths
    if (connectionPaths.length > 0 && Math.random() < 0.1) {
      const connection = connectionPaths[Math.floor(Math.random() * connectionPaths.length)];
      const t = Math.random();
      const position = new THREE.Vector3().lerpVectors(connection.from, connection.to, t);
      const direction = new THREE.Vector3().subVectors(connection.to, connection.from).normalize();
      const velocity = direction.multiplyScalar(0.02);

      particleSystemRef.current.push({
        position,
        velocity,
        lifetime: 0,
        maxLifetime: 2000,
        connectionIndex: 0,
      });
    }

    // Update particles
    if (particlesRef.current && particleGeometry) {
      const positions = particleGeometry.getAttribute('position') as THREE.BufferAttribute;
      const colors = particleGeometry.getAttribute('color') as THREE.BufferAttribute;

      particleSystemRef.current = particleSystemRef.current.filter((particle, i) => {
        particle.lifetime += 16; // ~60fps

        if (particle.lifetime > particle.maxLifetime || i >= 100) {
          return false;
        }

        particle.position.add(particle.velocity);

        const lifeProgress = particle.lifetime / particle.maxLifetime;
        const opacity = 1 - lifeProgress;

        positions.setXYZ(i, particle.position.x, particle.position.y, particle.position.z);
        colors.setXYZ(i, 0xd4 / 255, 0xaf / 255, 0x37 / 255);

        return true;
      });

      positions.needsUpdate = true;
      colors.needsUpdate = true;
    }
  });

  if (!enabled || connections.length === 0) return null;

  return (
    <group>
      <lineSegments ref={linesRef} geometry={lineGeometry}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.5}
          linewidth={2}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
      <points ref={particlesRef} geometry={particleGeometry}>
        <pointsMaterial
          size={3}
          transparent
          opacity={0.8}
          vertexColors
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
    </group>
  );
};

export default EnhancedConstellation;
