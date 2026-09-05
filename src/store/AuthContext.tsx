import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiRequest, errorMessage, setApiAccessToken } from '@/lib/api';
import type { AuthUser, Role } from '@/types';

const STORAGE_KEY = 'ciblon.session';

interface BackendIdentity {
  id: string; name: string; email: string; mobile: string; roles: string[];
  permissions: string[]; advisorId?: string | null; staffId?: string | null;
  code?: string | null; agency?: string | null;
}

interface StoredSession { user: AuthUser; accessToken: string; remember: boolean }
interface LoginResult { error: string | null; role?: Role }
interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (identifier: string, password: string, remember: boolean) => Promise<LoginResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mapIdentity(identity: BackendIdentity): AuthUser {
  const role: Role = identity.roles.includes('admin')
    ? 'admin'
    : identity.staffId
      ? 'staff'
      : 'advisor';
  return {
    id: identity.advisorId ?? identity.staffId ?? identity.id,
    name: identity.name,
    email: identity.email,
    mobile: identity.mobile,
    role,
    permissions: identity.permissions,
    code: identity.code ?? '',
    agency: identity.agency ?? undefined,
    avatarColor: role === 'advisor' ? '#0f766e' : '#4338ca',
  };
}

function readStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as StoredSession : null;
  } catch {
    return null;
  }
}

function clearStoredSession() {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = useMemo(readStoredSession, []);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setApiAccessToken(stored?.accessToken ?? null);
    const bootstrap = stored?.accessToken
      ? apiRequest<{ data: BackendIdentity }>('/me', { skipRefresh: true })
          .then(({ data }) => ({ user: data, accessToken: stored.accessToken }))
          .catch(() => apiRequest<{ data: { user: BackendIdentity; accessToken: string } }>('/auth/refresh', { method: 'POST', skipRefresh: true }).then((response) => response.data))
      : apiRequest<{ data: { user: BackendIdentity; accessToken: string } }>('/auth/refresh', { method: 'POST', skipRefresh: true }).then((response) => response.data);
    bootstrap.then((data) => {
      if (cancelled) return;
      const nextUser = mapIdentity(data.user);
      setApiAccessToken(data.accessToken);
      setUser(nextUser);
      const remember = stored?.remember ?? false;
      (remember ? localStorage : sessionStorage).setItem(
        STORAGE_KEY,
        JSON.stringify({ user: nextUser, accessToken: data.accessToken, remember }),
      );
    }).catch(() => {
      clearStoredSession();
      setApiAccessToken(null);
      setUser(null);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [stored]);

  const login = useCallback(
    async (identifier: string, password: string, remember: boolean): Promise<LoginResult> => {
      try {
        const { data } = await apiRequest<{ data: { accessToken: string; user: BackendIdentity } }>('/auth/login', {
          method: 'POST', body: { identifier, password, remember }, skipRefresh: true,
        });
        const nextUser = mapIdentity(data.user);
        clearStoredSession();
        setApiAccessToken(data.accessToken);
        setUser(nextUser);
        (remember ? localStorage : sessionStorage).setItem(
          STORAGE_KEY,
          JSON.stringify({ user: nextUser, accessToken: data.accessToken, remember }),
        );
        return { error: null, role: nextUser.role };
      } catch (error) {
        return { error: errorMessage(error) };
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await apiRequest<void>('/auth/logout', { method: 'POST', skipRefresh: true });
    } finally {
      clearStoredSession();
      setApiAccessToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
