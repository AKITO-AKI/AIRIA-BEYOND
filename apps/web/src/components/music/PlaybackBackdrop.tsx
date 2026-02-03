import React, { useEffect, useMemo, useState } from 'react';
import { PlaybackState, useMusicPlayer } from '../../contexts/MusicPlayerContext';
import './PlaybackBackdrop.css';

export default function PlaybackBackdrop() {
  const { state } = useMusicPlayer();

  const isActive =
    Boolean(state.currentAlbumImage) &&
    (state.playbackState === PlaybackState.PLAYING || state.playbackState === PlaybackState.PAUSED);

  // Force animation restart when a new album starts playing.
  const animationKey = useMemo(() => {
    const id = state.currentAlbum?.id || 'none';
    return `${id}:${state.playbackState}`;
  }, [state.currentAlbum?.id, state.playbackState]);

  // Slight delay to prevent flash during quick transitions.
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setShow(isActive), isActive ? 40 : 0);
    return () => window.clearTimeout(t);
  }, [isActive]);

  if (!state.currentAlbumImage) return null;

  return (
    <div
      key={animationKey}
      className={`playback-backdrop ${show ? 'is-active' : ''} ${state.playbackState === PlaybackState.PLAYING ? 'is-playing' : ''}`}
      style={{ backgroundImage: `url(${state.currentAlbumImage})` }}
      aria-hidden="true"
    />
  );
}
