import React, { createContext, useContext, ReactNode } from 'react';

export type RoomType =
  | 'onboarding'
  | 'main'
  | 'gallery'
  | 'album'
  | 'music'
  | 'social'
  | 'me'
  | 'settings'
  | 'admin'
  | 'info'
  | 'feedback';

export interface RoomNavigationContextValue {
  currentRoomId: RoomType;
  navigateToRoom: (roomId: RoomType) => void;
}

const RoomNavigationContext = createContext<RoomNavigationContextValue | undefined>(undefined);

export const RoomNavigationProvider: React.FC<{ value: RoomNavigationContextValue; children: ReactNode }> = ({
  value,
  children,
}) => {
  return <RoomNavigationContext.Provider value={value}>{children}</RoomNavigationContext.Provider>;
};

export const useRoomNavigation = () => {
  const context = useContext(RoomNavigationContext);
  if (!context) {
    throw new Error('useRoomNavigation must be used within RoomNavigationProvider');
  }
  return context;
};
