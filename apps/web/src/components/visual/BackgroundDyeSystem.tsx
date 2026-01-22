import React, { useEffect, useState, useRef } from 'react';
import * as Vibrant from 'node-vibrant';
import './BackgroundDyeSystem.css';

// Constants for background dye behavior
const COLOR_INTENSIFY_STEP = 0.01;
const COLOR_INTENSIFY_INTERVAL_MS = 1000;
const INITIAL_OPACITY = 0.85;
const MIN_OPACITY_PLAYING = 0.75;
const REVERBERATION_OPACITY = 0.05;

interface BackgroundDyeSystemProps {
  albumImageUrl?: string;
  isPlaying: boolean;
}

const BackgroundDyeSystem: React.FC<BackgroundDyeSystemProps> = ({
  albumImageUrl,
  isPlaying,
}) => {
  const [dominantColor, setDominantColor] = useState<string | null>(null);
  const [previousColor, setPreviousColor] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(INITIAL_OPACITY);
  const [isVisible, setIsVisible] = useState(false);
  const [isReverberating, setIsReverberating] = useState(false);
  const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reverberationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const colorCacheRef = useRef<Map<string, string>>(new Map()); // C-1: Cache for extracted colors

  // Extract dominant color from album image
  useEffect(() => {
    if (!albumImageUrl) {
      setDominantColor(null);
      return;
    }

    // Check cache first
    const cachedColor = colorCacheRef.current.get(albumImageUrl);
    if (cachedColor) {
      setDominantColor(cachedColor);
      return;
    }

    const extractColor = async () => {
      try {
        // Create cross-origin compatible image
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = albumImageUrl;
        });

        const palette = await Vibrant.from(img).getPalette();
        
        // Get the most vibrant color, fallback to muted or light muted
        const color = palette.Vibrant || palette.Muted || palette.LightMuted;
        
        if (color) {
          const hexColor = color.hex;
          setDominantColor(hexColor);
          // Cache the extracted color
          colorCacheRef.current.set(albumImageUrl, hexColor);
        }
      } catch (error) {
        console.error('Failed to extract color:', error);
        // Fallback to a default elegant color
        const fallbackColor = '#D4AF37'; // Gold
        setDominantColor(fallbackColor);
        colorCacheRef.current.set(albumImageUrl, fallbackColor);
      }
    };

    extractColor();
  }, [albumImageUrl]);

  // Handle music playback state transitions
  useEffect(() => {
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
    }
    if (reverberationTimeoutRef.current) {
      clearTimeout(reverberationTimeoutRef.current);
    }

    if (isPlaying && dominantColor) {
      // Music starts - transition in (3-5 seconds)
      setIsReverberating(false);
      setIsVisible(true);
      setOpacity(INITIAL_OPACITY);
      
      // Store previous color for blending on track change
      if (previousColor !== dominantColor) {
        setPreviousColor(dominantColor);
      }
    } else if (!isPlaying && isVisible) {
      // Music stops - start reverberation (10 seconds fade-out)
      setIsReverberating(true);
      
      reverberationTimeoutRef.current = setTimeout(() => {
        setOpacity(REVERBERATION_OPACITY); // Leave subtle trace
        
        fadeTimeoutRef.current = setTimeout(() => {
          setIsVisible(false);
          setIsReverberating(false);
        }, 10000); // After 10s reverberation
      }, 100);
    }

    return () => {
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
      if (reverberationTimeoutRef.current) clearTimeout(reverberationTimeoutRef.current);
    };
  }, [isPlaying, dominantColor]);

  // Gradually intensify color during playback
  useEffect(() => {
    if (!isPlaying || !isVisible || isReverberating) return;

    const interval = setInterval(() => {
      setOpacity((prev) => Math.max(MIN_OPACITY_PLAYING, prev - COLOR_INTENSIFY_STEP));
    }, COLOR_INTENSIFY_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isPlaying, isVisible, isReverberating]);

  if (!isVisible && !isReverberating) return null;

  return (
    <div 
      className={`background-dye-system ${isReverberating ? 'reverberating' : ''}`}
      style={{
        opacity: isReverberating ? 0.05 : 1,
        transition: isReverberating ? 'opacity 10s ease-out' : 'opacity 3s ease-in-out',
      }}
    >
      {/* Album image background with frosted glass effect */}
      {albumImageUrl && (
        <div
          className="album-background"
          style={{
            backgroundImage: `url(${albumImageUrl})`,
            opacity: opacity,
            transition: isReverberating ? 'opacity 10s ease-out' : 'opacity 3s ease-in-out',
          }}
        />
      )}
      
      {/* Radial gradient overlay based on dominant color */}
      {dominantColor && (
        <div
          className="color-gradient-overlay"
          style={{
            background: `radial-gradient(circle at center, 
              ${dominantColor}40, 
              ${dominantColor}20, 
              transparent)`,
            opacity: opacity,
            transition: isReverberating ? 'opacity 10s ease-out' : 'opacity 3s ease-in-out',
          }}
        />
      )}
      
      {/* Subtle grain texture for paper feel */}
      <div className="grain-texture" />
    </div>
  );
};

export default BackgroundDyeSystem;
