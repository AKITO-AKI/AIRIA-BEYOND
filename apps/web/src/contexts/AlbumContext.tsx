import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface Album {
  id: string;
  createdAt: string;
  mood: string;
  duration: number;
  imageDataURL: string;
  sessionData?: any;
}

interface AlbumContextType {
  albums: Album[];
  selectedAlbumId: string | null;
  addAlbum: (album: Omit<Album, 'id' | 'createdAt'>) => void;
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
    const newAlbum: Album = {
      ...albumData,
      id: `album_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };
    setAlbums((prev) => [...prev, newAlbum]);
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
