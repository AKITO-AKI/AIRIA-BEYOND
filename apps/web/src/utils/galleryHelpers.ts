// Gallery helper utilities for C-2

/**
 * Calculate book thickness based on music duration
 * Maps 30s-180s → 20px-60px
 */
export const calculateThickness = (musicDuration?: number): number => {
  if (!musicDuration) return 30; // Default for image-only albums
  
  const min = 20;
  const max = 60;
  const durMin = 30;
  const durMax = 180;
  
  // Clamp duration to range
  const clampedDuration = Math.max(durMin, Math.min(durMax, musicDuration));
  
  return min + ((clampedDuration - durMin) / (durMax - durMin)) * (max - min);
};

/**
 * Calculate shelf and position indices for an album
 * @param totalAlbums Total number of albums
 * @param albumIndex Index of this album (0 = newest)
 * @returns {shelfIndex: 0-4, positionIndex: 0-9}
 */
export const calculateBookPosition = (albumIndex: number): { shelfIndex: number; positionIndex: number } => {
  const booksPerShelf = 10;
  const shelfIndex = Math.floor(albumIndex / booksPerShelf);
  const positionIndex = albumIndex % booksPerShelf;
  
  return {
    shelfIndex: Math.min(shelfIndex, 4), // Max 5 shelves (0-4)
    positionIndex,
  };
};

/**
 * Calculate 3D position for a book on the bookshelf
 * @param shelfIndex 0-4 (top to bottom)
 * @param positionIndex 0-9 (left to right)
 * @param thickness Book thickness
 * @returns [x, y, z] position in 3D space
 */
export const calculate3DPosition = (
  shelfIndex: number,
  positionIndex: number,
  thickness: number
): [number, number, number] => {
  const shelfWidth = 12; // 1200px in virtual units (scaled down 100x)
  const shelfSpacing = 2.5; // 250px vertical spacing
  const bookWidth = 1.2; // 120px
  const bookSpacing = 0.1; // Small gap between books
  
  // Calculate X position (left to right)
  // Accumulate thickness of books to the left
  const baseX = -shelfWidth / 2 + bookWidth / 2;
  const x = baseX + positionIndex * (bookWidth + bookSpacing);
  
  // Calculate Y position (top to bottom)
  const baseY = 5; // Start high
  const y = baseY - shelfIndex * shelfSpacing;
  
  // Z position (depth)
  const z = 0;
  
  // Add slight randomness for natural look (±5% of spacing)
  const randomOffsetX = (Math.random() - 0.5) * 0.1;
  const randomOffsetY = (Math.random() - 0.5) * 0.05;
  
  return [x + randomOffsetX, y + randomOffsetY, z];
};

/**
 * Extract dominant color from image data URL using a simple algorithm
 * For better results, use node-vibrant in the component
 */
export const getSimpleDominantColor = (imageDataURL: string): string => {
  // Fallback colors based on hash of image URL
  const colors = [
    '#4A90E2', // Blue
    '#E24A90', // Pink
    '#90E24A', // Green
    '#E2904A', // Orange
    '#904AE2', // Purple
    '#4AE290', // Teal
  ];
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < imageDataURL.length; i++) {
    hash = ((hash << 5) - hash) + imageDataURL.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return colors[Math.abs(hash) % colors.length];
};

/**
 * Calculate emotional similarity between two albums
 * Returns 0 (different) to 1 (identical)
 */
export const calculateSimilarity = (
  ir1?: { valence?: number; arousal?: number },
  ir2?: { valence?: number; arousal?: number }
): number => {
  if (!ir1 || !ir2) return 0;
  if (ir1.valence === undefined || ir1.arousal === undefined) return 0;
  if (ir2.valence === undefined || ir2.arousal === undefined) return 0;
  
  // Euclidean distance in valence-arousal space
  const valenceDiff = ir1.valence - ir2.valence;
  const arousalDiff = ir1.arousal - ir2.arousal;
  const distance = Math.sqrt(valenceDiff ** 2 + arousalDiff ** 2);
  
  // Max distance is sqrt(2^2 + 2^2) ≈ 2.828 (assuming valence and arousal are -1 to 1)
  // Normalize to 0-1 range
  const maxDistance = 2.828;
  const similarity = 1 - Math.min(distance / maxDistance, 1);
  
  return similarity;
};

/**
 * Create constellation connections between similar albums
 * @param albums Array of albums with metadata
 * @param threshold Minimum similarity to create connection (default: 0.7)
 * @returns Array of connections with strength
 */
export const createConstellation = (
  albums: Array<{
    id: string;
    metadata?: { valence?: number; arousal?: number };
  }>,
  threshold: number = 0.7
): Array<{ from: string; to: string; strength: number }> => {
  const connections: Array<{ from: string; to: string; strength: number }> = [];
  
  for (let i = 0; i < albums.length; i++) {
    let connectionCount = 0;
    const maxConnectionsPerBook = 5;
    
    for (let j = i + 1; j < albums.length; j++) {
      if (connectionCount >= maxConnectionsPerBook) break;
      
      const similarity = calculateSimilarity(
        albums[i].metadata,
        albums[j].metadata
      );
      
      if (similarity > threshold) {
        connections.push({
          from: albums[i].id,
          to: albums[j].id,
          strength: similarity,
        });
        connectionCount++;
      }
    }
  }
  
  return connections;
};
