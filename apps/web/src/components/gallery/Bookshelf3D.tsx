import React, { useState } from 'react';
import { Album } from '../../contexts/AlbumContext';
import Book3D from './Book3D';
import Constellation from './Constellation';
import { calculate3DPosition, calculateBookPosition } from '../../utils/galleryHelpers';

interface Bookshelf3DProps {
  albums: Album[];
  onBookClick: (albumId: string) => void;
  constellationEnabled: boolean;
}

const Bookshelf3D: React.FC<Bookshelf3DProps> = ({
  albums,
  onBookClick,
  constellationEnabled,
}) => {
  const [hoveredBookId, setHoveredBookId] = useState<string | null>(null);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);

  // Shelf geometry
  const shelfCount = 5;
  const shelfWidth = 12;
  const shelfDepth = 3;
  const shelfHeight = 0.08;
  const shelfSpacing = 2.5;

  return (
    <group>
      {/* Background wall */}
      <mesh position={[0, 3, -1.5]} receiveShadow>
        <planeGeometry args={[shelfWidth + 2, 14]} />
        <meshStandardMaterial
          color="#f5f5f5"
          roughness={0.9}
          metalness={0.0}
        />
      </mesh>

      {/* Render shelves */}
      {Array.from({ length: shelfCount }).map((_, i) => {
        const y = 5 - i * shelfSpacing;
        return (
          <group key={`shelf-${i}`}>
            {/* Shelf surface */}
            <mesh position={[0, y - 0.9, 0]} castShadow receiveShadow>
              <boxGeometry args={[shelfWidth, shelfHeight, shelfDepth]} />
              <meshStandardMaterial
                color="#d8d8d8"
                roughness={0.7}
                metalness={0.1}
              />
            </mesh>
            
            {/* Shelf front edge (trim) */}
            <mesh position={[0, y - 0.9, shelfDepth / 2]} receiveShadow>
              <boxGeometry args={[shelfWidth, shelfHeight * 1.5, 0.05]} />
              <meshStandardMaterial
                color="#c0c0c0"
                roughness={0.6}
                metalness={0.2}
              />
            </mesh>
          </group>
        );
      })}

      {/* Render books */}
      {albums.map((album, index) => {
        const bookPos = calculateBookPosition(index);
        const position = calculate3DPosition(
          bookPos.shelfIndex,
          bookPos.positionIndex,
          album.gallery?.thickness || 30
        );

        return (
          <Book3D
            key={album.id}
            album={album}
            position={position}
            onClick={() => {
              setSelectedBookId(album.id);
              onBookClick(album.id);
            }}
            onHover={(isHovered) => {
              setHoveredBookId(isHovered ? album.id : null);
            }}
            isSelected={selectedBookId === album.id}
            isHovered={hoveredBookId === album.id}
          />
        );
      })}

      {/* Constellation connections */}
      <Constellation
        albums={albums}
        hoveredAlbumId={hoveredBookId}
        enabled={constellationEnabled}
      />

      {/* Ambient light for overall illumination */}
      <ambientLight intensity={0.5} />

      {/* Main directional light (sun-like) */}
      <directionalLight
        position={[8, 12, 8]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />

      {/* Fill light from the side */}
      <directionalLight
        position={[-5, 5, 3]}
        intensity={0.3}
      />

      {/* Point light for highlights on books */}
      <pointLight
        position={[0, 8, 6]}
        intensity={0.4}
        distance={15}
        decay={2}
      />

      {/* Rim light from behind */}
      <pointLight
        position={[0, 4, -2]}
        intensity={0.2}
        color="#ffffff"
      />
    </group>
  );
};

export default Bookshelf3D;
