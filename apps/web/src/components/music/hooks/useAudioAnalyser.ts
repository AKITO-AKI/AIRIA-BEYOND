import { useEffect, useRef, useState } from 'react';

export interface AudioBands {
  bass: number;      // 20-250 Hz
  midLow: number;    // 250-500 Hz
  mid: number;       // 500-2000 Hz
  midHigh: number;   // 2000-4000 Hz
  treble: number;    // 4000-8000 Hz
}

interface UseAudioAnalyserOptions {
  fftSize?: number;
  smoothingTimeConstant?: number;
  enabled?: boolean;
}

export function useAudioAnalyser(
  audioElement: HTMLAudioElement | null,
  options: UseAudioAnalyserOptions = {}
) {
  const {
    fftSize = 2048,
    smoothingTimeConstant = 0.8,
    enabled = true,
  } = options;

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const timeDataArrayRef = useRef<Uint8Array | null>(null);

  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!audioElement || !enabled) {
      return;
    }

    // Initialize Web Audio API
    const initAudio = async () => {
      try {
        // Create audio context
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;

        // Create analyser
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = fftSize;
        analyser.smoothingTimeConstant = smoothingTimeConstant;
        analyserRef.current = analyser;

        // Create source from audio element
        const source = audioContext.createMediaElementSource(audioElement);
        sourceRef.current = source;

        // Connect audio graph
        source.connect(analyser);
        analyser.connect(audioContext.destination);

        // Create data arrays
        const bufferLength = analyser.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);
        timeDataArrayRef.current = new Uint8Array(bufferLength);

        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize audio analyser:', error);
      }
    };

    initAudio();

    return () => {
      // Cleanup
      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch (e) {
          // Already disconnected
        }
      }
      if (analyserRef.current) {
        try {
          analyserRef.current.disconnect();
        } catch (e) {
          // Already disconnected
        }
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      setIsInitialized(false);
    };
  }, [audioElement, enabled, fftSize, smoothingTimeConstant]);

  const getFrequencyData = (): Uint8Array | null => {
    if (!analyserRef.current || !dataArrayRef.current) {
      return null;
    }
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    return dataArrayRef.current;
  };

  const getTimeDomainData = (): Uint8Array | null => {
    if (!analyserRef.current || !timeDataArrayRef.current) {
      return null;
    }
    analyserRef.current.getByteTimeDomainData(timeDataArrayRef.current);
    return timeDataArrayRef.current;
  };

  const getAverageBand = (
    dataArray: Uint8Array,
    freqStart: number,
    freqEnd: number
  ): number => {
    const sampleRate = audioContextRef.current?.sampleRate || 44100;
    const nyquist = sampleRate / 2;
    const fftSize = analyserRef.current?.fftSize || 2048;
    
    // Convert frequency to bin index
    const startBin = Math.floor((freqStart / nyquist) * (fftSize / 2));
    const endBin = Math.floor((freqEnd / nyquist) * (fftSize / 2));
    
    // Calculate average amplitude in range
    let sum = 0;
    for (let i = startBin; i <= endBin && i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    return sum / (endBin - startBin + 1);
  };

  const analyzeAudio = (): AudioBands | null => {
    const dataArray = getFrequencyData();
    if (!dataArray) {
      return null;
    }

    return {
      bass: getAverageBand(dataArray, 20, 250),
      midLow: getAverageBand(dataArray, 250, 500),
      mid: getAverageBand(dataArray, 500, 2000),
      midHigh: getAverageBand(dataArray, 2000, 4000),
      treble: getAverageBand(dataArray, 4000, 8000),
    };
  };

  return {
    isInitialized,
    getFrequencyData,
    getTimeDomainData,
    analyzeAudio,
    analyser: analyserRef.current,
    audioContext: audioContextRef.current,
  };
}
