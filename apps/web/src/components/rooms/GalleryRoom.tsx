import React, { useState, useEffect } from 'react';
import { useAlbums } from '../../contexts/AlbumContext';
import BookshelfCanvas from '../gallery/BookshelfCanvas';
import GalleryControls, { SortMode, ViewMode } from '../gallery/GalleryControls';
import GridView from '../gallery/fallback/GridView';
import EmptyState from '../visual/feedback/EmptyState';
import GeometricCanvas from '../visual/GeometricCanvas';
import './GalleryRoom.css';

const GalleryRoom: React.FC = () => {
  const { albums, selectAlbum } = useAlbums();
  
  // C-2: Gallery state
  const [constellationEnabled, setConstellationEnabled] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>('time');
  const [viewMode, setViewMode] = useState<ViewMode>('3d');
  
  // Detect mobile device
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      setViewMode('grid'); // Default to grid view on mobile
    }
  }, []);

  const handleAlbumClick = (albumId: string) => {
    selectAlbum(albumId);
    // Navigation will be handled by clicking on the Album room indicator
  };

  // Sort albums based on mode
  const sortedAlbums = React.useMemo(() => {
    const albumsCopy = [...albums];
    
    switch (sortMode) {
      case 'time':
        // Newest first (already in correct order from context)
        return albumsCopy;
      
      case 'mood':
        // Sort by valence (happy to sad)
        return albumsCopy.sort((a, b) => {
          const valenceA = a.metadata?.valence ?? 0;
          const valenceB = b.metadata?.valence ?? 0;
          return valenceB - valenceA; // Descending (happy first)
        });
      
      case 'duration':
        // Sort by music duration
        return albumsCopy.sort((a, b) => {
          const durationA = a.musicMetadata?.duration ?? 0;
          const durationB = b.musicMetadata?.duration ?? 0;
          return durationB - durationA; // Descending (longest first)
        });
      
      default:
        return albumsCopy;
    }
  }, [albums, sortMode]);

  return (
    <div className="room-content gallery-room">
      <GeometricCanvas pattern="polyhedron" isActive={true} />
      <h1 className="room-title">GALLERY</h1>
      <p className="room-subtitle">あなたの感情コレクション</p>
      
      <div className="bookshelf-container">
        <GalleryControls
          constellationEnabled={constellationEnabled}
          onConstellationToggle={() => setConstellationEnabled(!constellationEnabled)}
          sortMode={sortMode}
          onSortChange={setSortMode}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
        
        {viewMode === '3d' ? (
          <div className={`gallery-shelf-stage ${albums.length === 0 ? 'empty' : ''}`}>
            <BookshelfCanvas
              albums={sortedAlbums}
              onBookClick={handleAlbumClick}
              constellationEnabled={constellationEnabled}
            />
            {albums.length === 0 && (
              <div className="empty-shelf-overlay">
                <EmptyState
                  title="まだアルバムがありません"
                  description="Mainルームでセッションを開始すると、棚にアルバムが生まれます。"
                  actionLabel="セッションを始める"
                  onAction={() => {
                    // Note: Navigation should ideally use proper routing
                    // For now, user can manually navigate to Main room
                    console.log('Navigate to Main room');
                  }}
                  icon={<span className="empty-icon-shape" aria-hidden="true" />}
                />
              </div>
            )}
          </div>
        ) : albums.length === 0 ? (
          <EmptyState
            title="まだアルバムがありません"
            description="Mainルームでセッションを開始すると、アルバムが一覧に追加されます。"
            actionLabel="セッションを始める"
            onAction={() => {
              console.log('Navigate to Main room');
            }}
            icon={<span className="empty-icon-shape" aria-hidden="true" />}
          />
        ) : (
          <GridView
            albums={sortedAlbums}
            onAlbumClick={handleAlbumClick}
          />
        )}
      </div>
    </div>
  );
};

export default GalleryRoom;
