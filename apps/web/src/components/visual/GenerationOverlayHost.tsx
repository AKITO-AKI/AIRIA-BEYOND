import React from 'react';
import { useGenerationOverlay } from '../../contexts/GenerationOverlayContext';
import GenerationFrostOverlay from './GenerationFrostOverlay';

export default function GenerationOverlayHost() {
  const { current } = useGenerationOverlay();
  return (
    <GenerationFrostOverlay
      active={current.active}
      statusText={current.statusText}
      elapsedSec={current.elapsedSec}
      onCancel={current.onCancel}
    />
  );
}
