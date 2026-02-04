import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { calculateBookPosition, calculateThickness, getSimpleDominantColor } from '../utils/galleryHelpers';

// P3: Enhanced Album metadata
export interface AlbumMetadata {
  // Intermediate Representation (from P2 analysis)
  valence?: number;
  arousal?: number;
  focus?: number;
  motif_tags?: string[];
  confidence?: number;
  // Optional UI hints
  dominantColors?: string[];
  // Generation parameters
  stylePreset?: string;
  seed?: number;
  provider?: 'replicate' | 'local' | 'rule-based';
  // Prompts used
  prompt?: string;
  negativePrompt?: string;
}

// P4: Music metadata
export interface MusicMetadata {
  key: string; // e.g., "d minor"
  tempo: number; // BPM
  timeSignature: string; // e.g., "3/4"
  form: string; // e.g., "ABA", "theme-variation"
  character: string; // e.g., "melancholic and introspective"
  duration: number; // in seconds
  createdAt: string;
  provider?: 'openai' | 'rule-based';
}

// C-2: Gallery-specific data
export interface GalleryData {
  shelfIndex: number;      // 0-4 (top to bottom)
  positionIndex: number;   // 0-9 (left to right)
  thickness: number;       // Calculated from music duration (20-60px)
  spineColor: string;      // Extracted dominant color from image
}

export interface Album {
  id: string;
  createdAt: string;
  title?: string;
  memo?: string;
  mood: string;
  duration: number;
  isPublic?: boolean;
  isFavorite?: boolean;
  imageDataURL: string;
  thumbnailUrl?: string; // P3: Optional thumbnail for performance
  sessionData?: any;
  metadata?: AlbumMetadata; // P3: Enhanced metadata
  // P4: Music fields
  musicData?: string; // Base64 encoded MIDI data
  musicFormat?: 'midi'; // Format of the music file
  musicMetadata?: MusicMetadata; // Music-specific metadata
  // P5: Causal log reference
  causalLogId?: string; // Reference to the causal log for this album
  // C-2: Gallery-specific fields
  gallery?: GalleryData;
}

interface AlbumContextType {
  albums: Album[];
  selectedAlbumId: string | null;
  addAlbum: (album: Omit<Album, 'id' | 'createdAt'>) => Album;
  updateAlbum: (id: string, patch: Partial<Omit<Album, 'id' | 'createdAt'>>) => void;
  selectAlbum: (id: string | null) => void;
  getSelectedAlbum: () => Album | null;
}

const AlbumContext = createContext<AlbumContextType | undefined>(undefined);

const STORAGE_KEY = 'airia-albums';

export const AlbumProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);

  // Load albums from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setAlbums(parsed);
      }
    } catch (error) {
      console.error('Failed to load albums from localStorage:', error);
    }
  }, []);

  // Save albums to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(albums));
    } catch (error) {
      console.error('Failed to save albums to localStorage:', error);
    }
  }, [albums]);

  const addAlbum = (albumData: Omit<Album, 'id' | 'createdAt'>) => {
    const baseAlbum: Album = {
      ...albumData,
      isPublic: albumData.isPublic ?? false,
      isFavorite: albumData.isFavorite ?? false,
      id: `album_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      createdAt: new Date().toISOString(),
    };

    // Ensure derived gallery fields exist on the returned album (index 0).
    const position0 = calculateBookPosition(0);
    const thickness0 = calculateThickness(baseAlbum.musicMetadata?.duration);
    const spineColor0 = getSimpleDominantColor(baseAlbum.imageDataURL);
    const newAlbum: Album = {
      ...baseAlbum,
      gallery: {
        shelfIndex: position0.shelfIndex,
        positionIndex: position0.positionIndex,
        thickness: thickness0,
        spineColor: spineColor0,
      },
    };
    
    setAlbums((prev) => {
      // C-2: New albums are added at the beginning (index 0)
      const updatedAlbums = [newAlbum, ...prev];
      
      // Recalculate positions for all albums
      return updatedAlbums.map((album, index) => {
        const position = calculateBookPosition(index);
        const thickness = calculateThickness(album.musicMetadata?.duration);
        const spineColor = album.gallery?.spineColor || getSimpleDominantColor(album.imageDataURL);
        
        return {
          ...album,
          gallery: {
            shelfIndex: position.shelfIndex,
            positionIndex: position.positionIndex,
            thickness,
            spineColor,
          },
        };
      });
    });

    return newAlbum;
  };

  const updateAlbum = (id: string, patch: Partial<Omit<Album, 'id' | 'createdAt'>>) => {
    setAlbums((prev) =>
      prev.map((album) => {
        if (album.id !== id) return album;
        const next = { ...album, ...patch };

        // Keep gallery derived fields consistent if image changes
        if (patch.imageDataURL) {
          const spineColor = next.gallery?.spineColor || getSimpleDominantColor(next.imageDataURL);
          return {
            ...next,
            gallery: {
              ...(next.gallery || {
                shelfIndex: 0,
                positionIndex: 0,
                thickness: calculateThickness(next.musicMetadata?.duration),
                spineColor,
              }),
              spineColor,
            },
          };
        }

        return next;
      })
    );
  };

  const selectAlbum = (id: string | null) => {
    setSelectedAlbumId(id);
  };

  const getSelectedAlbum = () => {
    if (!selectedAlbumId) return null;
    return albums.find((album) => album.id === selectedAlbumId) || null;
  };

  return (
    <AlbumContext.Provider
      value={{
        albums,
        selectedAlbumId,
        addAlbum,
        updateAlbum,
        selectAlbum,
        getSelectedAlbum,
      }}
    >
      {children}
    </AlbumContext.Provider>
  );
};

export const useAlbums = () => {
  const context = useContext(AlbumContext);
  if (context === undefined) {
    throw new Error('useAlbums must be used within an AlbumProvider');
  }
  return context;
};
