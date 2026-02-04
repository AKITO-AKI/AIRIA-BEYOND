import React from 'react';

export type GenerationOverlayEntry = {
  active: boolean;
  statusText?: string | null;
  elapsedSec?: number;
  onCancel?: (() => void) | null;
  updatedAt?: number;
};

type GenerationOverlayState = {
  entries: Record<string, Required<GenerationOverlayEntry>>;
};

type GenerationOverlayContextValue = {
  setOverlay: (key: string, entry: GenerationOverlayEntry) => void;
  clearOverlay: (key: string) => void;
  current: Required<GenerationOverlayEntry>;
};

const DEFAULT_ENTRY: Required<GenerationOverlayEntry> = {
  active: false,
  statusText: null,
  elapsedSec: 0,
  onCancel: null,
  updatedAt: 0,
};

const GenerationOverlayContext = React.createContext<GenerationOverlayContextValue | undefined>(undefined);

function pickCurrent(entries: GenerationOverlayState['entries']): Required<GenerationOverlayEntry> {
  const active = Object.values(entries).filter((e) => e.active);
  if (active.length === 0) return DEFAULT_ENTRY;
  active.sort((a, b) => b.updatedAt - a.updatedAt);
  return active[0];
}

export function GenerationOverlayProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<GenerationOverlayState>({ entries: {} });

  const setOverlay = React.useCallback((key: string, entry: GenerationOverlayEntry) => {
    const normalizedKey = String(key || 'default');
    setState((prev) => {
      const prevEntry = prev.entries[normalizedKey] ?? DEFAULT_ENTRY;
      const updated: Required<GenerationOverlayEntry> = {
        active: Boolean(entry.active),
        statusText: entry.statusText ?? prevEntry.statusText ?? null,
        elapsedSec: Number.isFinite(entry.elapsedSec as any) ? (entry.elapsedSec as number) : prevEntry.elapsedSec ?? 0,
        onCancel: entry.onCancel ?? null,
        updatedAt: entry.updatedAt ?? Date.now(),
      };
      return {
        entries: {
          ...prev.entries,
          [normalizedKey]: updated,
        },
      };
    });
  }, []);

  const clearOverlay = React.useCallback((key: string) => {
    const normalizedKey = String(key || 'default');
    setState((prev) => {
      if (!prev.entries[normalizedKey]) return prev;
      const next = { ...prev.entries };
      delete next[normalizedKey];
      return { entries: next };
    });
  }, []);

  const current = React.useMemo(() => pickCurrent(state.entries), [state.entries]);

  const value = React.useMemo<GenerationOverlayContextValue>(() => ({ setOverlay, clearOverlay, current }), [setOverlay, clearOverlay, current]);

  return <GenerationOverlayContext.Provider value={value}>{children}</GenerationOverlayContext.Provider>;
}

export function useGenerationOverlay() {
  const ctx = React.useContext(GenerationOverlayContext);
  if (!ctx) throw new Error('useGenerationOverlay must be used within GenerationOverlayProvider');
  return ctx;
}
