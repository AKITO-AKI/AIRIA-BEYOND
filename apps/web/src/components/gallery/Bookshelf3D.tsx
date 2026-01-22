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
  const shelfHeight = 0.1;
  const shelfSpacing = 2.5;

  return (
    <group>
      {/* Render shelves */}
      {Array.from({ length: shelfCount }).map((_, i) => {
        const y = 5 - i * shelfSpacing;
        return (
          <mesh key={`shelf-${i}`} position={[0, y - 0.9, 0]}>
            <boxGeometry args={[shelfWidth, shelfHeight, shelfDepth]} />
            <meshStandardMaterial
              color="#e0e0e0"
              roughness={0.8}
              metalness={0.1}
            />
          </mesh>
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

      {/* Ambient light */}
      <ambientLight intensity={0.6} />

      {/* Directional light */}
      <directionalLight
        position={[5, 10, 5]}
        intensity={0.8}
        castShadow
      />

      {/* Point light for highlights */}
      <pointLight position={[0, 5, 5]} intensity={0.4} />
    </group>
  );
};

export default Bookshelf3D;
