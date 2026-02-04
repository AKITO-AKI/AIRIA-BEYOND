import React from 'react';
import {
  getAuthToken,
  me as apiMe,
  login as apiLogin,
  loginWithEmail as apiLoginWithEmail,
  oauthLogin,
  register as apiRegister,
  registerWithEmail as apiRegisterWithEmail,
  logout as apiLogout,
  updateProfile as apiUpdateProfile,
  setAuthToken,
  type AuthUser,
} from '../api/authApi';

interface AuthContextValue {
  user: AuthUser | null;
  bootLoading: boolean;
  busy: boolean;
  token: string;
  refresh: () => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  loginWithApple: (idToken: string, appleUser?: any) => Promise<void>;
  loginWithPassword: (input: { identifier: string; password: string }) => Promise<void>;
  registerWithPassword: (input: { email: string; password: string; displayName?: string; handle?: string }) => Promise<void>;
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
  const [bootLoading, setBootLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [token, setToken] = React.useState(() => getAuthToken());

  const opSeqRef = React.useRef(0);
  const didInitRefreshRef = React.useRef(false);

  const beginOp = React.useCallback(() => {
    opSeqRef.current += 1;
    return opSeqRef.current;
  }, []);

  const isLatest = React.useCallback((opId: number) => opSeqRef.current === opId, []);

  const refresh = React.useCallback(async () => {
    const opId = beginOp();
    const t = getAuthToken();
    setToken(t);
    if (!t) {
      if (isLatest(opId)) {
        setUser(null);
        setBootLoading(false);
      }
      return;
    }

    try {
      const tokenAtStart = t;
      const resp = await apiMe();
      if (!isLatest(opId)) return;

      // If another auth op replaced the token while this request was in flight,
      // ignore this response to avoid "kicked back" / flapping.
      if (getAuthToken() !== tokenAtStart) return;

      setUser(resp.user);
      if (!resp.user) {
        setAuthToken(null);
        setToken('');
      }
    } catch (e) {
      if (!isLatest(opId)) return;
      // Network/transient failures should not immediately kick the user out.
      // If the server explicitly returns user: null, we handle it above.
      const msg = e instanceof Error ? e.message : String(e);
      const looksLikeNetwork =
        /failed to fetch/i.test(msg) ||
        /networkerror/i.test(msg) ||
        /load failed/i.test(msg) ||
        /timeout/i.test(msg);
      if (!looksLikeNetwork) {
        setUser(null);
      }
    } finally {
      if (isLatest(opId)) setBootLoading(false);
    }
  }, [beginOp, isLatest]);

  React.useEffect(() => {
    // React.StrictMode in dev runs effects twice; avoid duplicate refresh races.
    if (didInitRefreshRef.current) return;
    didInitRefreshRef.current = true;
    void refresh();
  }, [refresh]);

  const loginWithGoogle = React.useCallback(async (idToken: string) => {
    const opId = beginOp();
    setBusy(true);
    try {
      const resp = await oauthLogin('google', { idToken });
      if (!isLatest(opId)) return;
      setAuthToken(resp.token);
      setToken(resp.token);
      setUser(resp.user);
    } finally {
      if (isLatest(opId)) setBusy(false);
    }
  }, [beginOp, isLatest]);

  const loginWithApple = React.useCallback(async (idToken: string, appleUser?: any) => {
    const opId = beginOp();
    setBusy(true);
    try {
      const resp = await oauthLogin('apple', { idToken, user: appleUser || undefined });
      if (!isLatest(opId)) return;
      setAuthToken(resp.token);
      setToken(resp.token);
      setUser(resp.user);
    } finally {
      if (isLatest(opId)) setBusy(false);
    }
  }, [beginOp, isLatest]);

  const loginWithPassword = React.useCallback(async (input: { identifier: string; password: string }) => {
    const opId = beginOp();
    setBusy(true);
    try {
      const identifier = String(input?.identifier || '').trim();
      const password = String(input?.password || '');
      const resp = identifier.includes('@')
        ? await apiLoginWithEmail({ email: identifier, password })
        : await apiLogin({ handle: identifier, password });
      if (!isLatest(opId)) return;
      setAuthToken(resp.token);
      setToken(resp.token);
      setUser(resp.user);
    } finally {
      if (isLatest(opId)) setBusy(false);
    }
  }, [beginOp, isLatest]);

  const registerWithPassword = React.useCallback(
    async (input: { email: string; password: string; displayName?: string; handle?: string }) => {
      const opId = beginOp();
      setBusy(true);
      try {
        const email = String(input?.email || '').trim();
        const password = String(input?.password || '');
        const displayName = input?.displayName;
        const handle = input?.handle;
        const resp = await apiRegisterWithEmail({ email, password, displayName, handle });
        if (!isLatest(opId)) return;
        setAuthToken(resp.token);
        setToken(resp.token);
        setUser(resp.user);
      } finally {
        if (isLatest(opId)) setBusy(false);
      }
    },
    [beginOp, isLatest]
  );

  const logout = React.useCallback(async () => {
    const opId = beginOp();
    setBusy(true);
    try {
      await apiLogout().catch(() => null);
    } finally {
      if (!isLatest(opId)) return;
      setAuthToken(null);
      setToken('');
      setUser(null);
      setBusy(false);
    }
  }, [beginOp, isLatest]);

  const updateProfile = React.useCallback(async (patch: { displayName?: string; bio?: string }) => {
    const opId = beginOp();
    setBusy(true);
    try {
      const resp = await apiUpdateProfile(patch);
      if (!isLatest(opId)) return;
      setUser(resp.user);
    } finally {
      if (isLatest(opId)) setBusy(false);
    }
  }, [beginOp, isLatest]);

  const updateFollowingIds = React.useCallback((followingIds: string[]) => {
    setUser((prev) => (prev ? { ...prev, followingIds: Array.isArray(followingIds) ? followingIds : [] } : prev));
  }, []);

  const value: AuthContextValue = {
    user,
    bootLoading,
    busy,
    token,
    refresh,
    loginWithGoogle,
    loginWithApple,
    loginWithPassword,
    registerWithPassword,
    logout,
    updateProfile,
    updateFollowingIds,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
