import React, { useEffect, useState, useRef } from 'react';
import * as Vibrant from 'node-vibrant';
import { useMusicPlayer, PlaybackState } from '../../contexts/MusicPlayerContext';
import './BackgroundDyeSystem.css';

// Constants for background dye behavior
const COLOR_INTENSIFY_STEP = 0.01;
const COLOR_INTENSIFY_INTERVAL_MS = 1000;
const INITIAL_OPACITY = 0.85;
const PAUSED_OPACITY = 0.92; // Lighter when paused (holding breath)
const MIN_OPACITY_PLAYING = 0.75;
const REVERBERATION_OPACITY = 0.03; // Memory residue
const TRACK_CHANGE_DURATION_MS = 10000; // 10 seconds for gradient transition

interface BackgroundDyeSystemProps {
  // Legacy props for backward compatibility
  albumImageUrl?: string;
  isPlaying?: boolean;
}

const BackgroundDyeSystem: React.FC<BackgroundDyeSystemProps> = ({
  albumImageUrl: legacyImageUrl,
  isPlaying: legacyIsPlaying,
}) => {
  // Use context for new behavior, fallback to legacy props
  const { state: musicState } = useMusicPlayer();
  const albumImageUrl = musicState.currentAlbumImage || legacyImageUrl;
  const playbackState = legacyIsPlaying !== undefined 
    ? (legacyIsPlaying ? PlaybackState.PLAYING : PlaybackState.STOPPED)
    : musicState.playbackState;
  const [dominantColor, setDominantColor] = useState<string | null>(null);
  const [previousColor, setPreviousColor] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(INITIAL_OPACITY);
  const [isVisible, setIsVisible] = useState(false);
  const [isReverberating, setIsReverberating] = useState(false);
  const [colorTransitionProgress, setColorTransitionProgress] = useState(0);
  const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reverberationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const colorCacheRef = useRef<Map<string, string>>(new Map()); // C-1: Cache for extracted colors
  const previousImageUrlRef = useRef<string | null>(null);

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

    if (playbackState === PlaybackState.PLAYING && dominantColor) {
      // Music starts - transition in (3 seconds)
      setIsReverberating(false);
      setIsVisible(true);
      setOpacity(INITIAL_OPACITY);
      
      // Store previous color for blending on track change
      if (previousColor !== dominantColor) {
        setPreviousColor(dominantColor);
      }
    } else if (playbackState === PlaybackState.PAUSED && isVisible) {
      // Music paused - lighten (holding breath effect)
      setOpacity(PAUSED_OPACITY);
    } else if (playbackState === PlaybackState.STOPPED && isVisible) {
      // Music stops - start reverberation (10 seconds fade-out)
      setIsReverberating(true);
      
      reverberationTimeoutRef.current = setTimeout(() => {
        setOpacity(REVERBERATION_OPACITY); // Leave subtle trace (memory residue)
        
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
  }, [playbackState, dominantColor]);

  // Handle track changes with 10-second gradient transition
  useEffect(() => {
    if (!albumImageUrl) return;
    
    if (previousImageUrlRef.current && previousImageUrlRef.current !== albumImageUrl) {
      // Track changed - animate transition
      setColorTransitionProgress(0);
      
      // Animate over 10 seconds
      const startTime = Date.now();
      const animationInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / TRACK_CHANGE_DURATION_MS, 1);
        setColorTransitionProgress(progress);
        
        if (progress >= 1) {
          clearInterval(animationInterval);
          setPreviousColor(dominantColor);
        }
      }, 16); // ~60fps
      
      return () => clearInterval(animationInterval);
    }
    
    previousImageUrlRef.current = albumImageUrl;
  }, [albumImageUrl, dominantColor]);

  // Gradually intensify color during playback
  useEffect(() => {
    if (playbackState !== PlaybackState.PLAYING || !isVisible || isReverberating) return;

    const interval = setInterval(() => {
      setOpacity((prev) => Math.max(MIN_OPACITY_PLAYING, prev - COLOR_INTENSIFY_STEP));
    }, COLOR_INTENSIFY_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [playbackState, isVisible, isReverberating]);

  if (!isVisible && !isReverberating) return null;

  // Calculate blended color for transitions
  const displayColor = previousColor && colorTransitionProgress < 1
    ? blendColors(previousColor, dominantColor || previousColor, colorTransitionProgress)
    : dominantColor;

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
      {displayColor && (
        <div
          className="color-gradient-overlay"
          style={{
            background: `radial-gradient(circle at center, 
              ${displayColor}40, 
              ${displayColor}20, 
              transparent)`,
            opacity: opacity,
            transition: isReverberating 
              ? 'opacity 10s ease-out' 
              : colorTransitionProgress < 1
              ? 'background 0.016s linear' // Smooth color transition
              : 'opacity 0.5s ease-in-out',
          }}
        />
      )}
      
      {/* Subtle grain texture for paper feel */}
      <div className="grain-texture" />
    </div>
  );
};

/**
 * Blend two hex colors with a given progress (0-1)
 */
function blendColors(color1: string, color2: string, progress: number): string {
  // Parse hex colors
  const c1 = parseInt(color1.replace('#', ''), 16);
  const c2 = parseInt(color2.replace('#', ''), 16);
  
  // Extract RGB components
  const r1 = (c1 >> 16) & 0xff;
  const g1 = (c1 >> 8) & 0xff;
  const b1 = c1 & 0xff;
  
  const r2 = (c2 >> 16) & 0xff;
  const g2 = (c2 >> 8) & 0xff;
  const b2 = c2 & 0xff;
  
  // Blend
  const r = Math.round(r1 + (r2 - r1) * progress);
  const g = Math.round(g1 + (g2 - g1) * progress);
  const b = Math.round(b1 + (b2 - b1) * progress);
  
  // Convert back to hex
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export default BackgroundDyeSystem;
