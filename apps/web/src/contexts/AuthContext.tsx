import React from 'react';
import {
  getAuthToken,
  me as apiMe,
  oauthLogin,
  logout as apiLogout,
  updateProfile as apiUpdateProfile,
  setAuthToken,
  type AuthUser,
} from '../api/authApi';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  token: string;
  refresh: () => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  loginWithApple: (idToken: string, appleUser?: any) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (patch: { displayName?: string; bio?: string }) => Promise<void>;
  updateFollowingIds: (followingIds: string[]) => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [token, setToken] = React.useState(() => getAuthToken());

  const refresh = React.useCallback(async () => {
    const t = getAuthToken();
    setToken(t);
    if (!t) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const resp = await apiMe();
      setUser(resp.user);
      if (!resp.user) {
        setAuthToken(null);
        setToken('');
      }
    } catch {
      // keep token, but treat as logged out for UX safety
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const loginWithGoogle = React.useCallback(async (idToken: string) => {
    setLoading(true);
    try {
      const resp = await oauthLogin('google', { idToken });
      setAuthToken(resp.token);
      setToken(resp.token);
      setUser(resp.user);
    } finally {
      setLoading(false);
    }
  }, []);

  const loginWithApple = React.useCallback(async (idToken: string, appleUser?: any) => {
    setLoading(true);
    try {
      const resp = await oauthLogin('apple', { idToken, user: appleUser || undefined });
      setAuthToken(resp.token);
      setToken(resp.token);
      setUser(resp.user);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = React.useCallback(async () => {
    setLoading(true);
    try {
      await apiLogout().catch(() => null);
    } finally {
      setAuthToken(null);
      setToken('');
      setUser(null);
      setLoading(false);
    }
  }, []);

  const updateProfile = React.useCallback(async (patch: { displayName?: string; bio?: string }) => {
    setLoading(true);
    try {
      const resp = await apiUpdateProfile(patch);
      setUser(resp.user);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateFollowingIds = React.useCallback((followingIds: string[]) => {
    setUser((prev) => (prev ? { ...prev, followingIds: Array.isArray(followingIds) ? followingIds : [] } : prev));
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    token,
    refresh,
    loginWithGoogle,
    loginWithApple,
    logout,
    updateProfile,
    updateFollowingIds,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
