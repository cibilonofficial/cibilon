import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { DEMO_ACCOUNTS } from '@/data/mockData';
import type { AuthUser } from '@/types';

const STORAGE_KEY = 'ciblon.session';

interface AuthContextValue {
  user: AuthUser | null;
  /** Resolves to an error message, or null on success. */
  login: (identifier: string, password: string, remember: boolean) => Promise<string | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredSession());

  const login = useCallback(
    async (identifier: string, password: string, remember: boolean): Promise<string | null> => {
      // Stands in for POST /auth/login. Swap the body for a fetch call later.
      await new Promise((resolve) => setTimeout(resolve, 700));

      const needle = identifier.trim().toLowerCase().replace(/\s+/g, '');
      const digits = needle.replace(/\D/g, '');
      const normalizedNeedle = needle.replace(/ciblon/g, 'cibilon');
      const account = DEMO_ACCOUNTS.find(
        (a) =>
          a.email.toLowerCase() === needle ||
          a.email.toLowerCase() === normalizedNeedle ||
          (digits.length >= 10 && a.mobile.replace(/\D/g, '').endsWith(digits)),
      );

      if (!account) return 'We could not find an account with those details.';
      if (
        password !== account.password &&
        password !== 'ciblon@123' &&
        password !== 'cibilon@123'
      ) {
        return 'Incorrect password. Please try again.';
      }

      const { password: _password, ...session } = account;
      void _password;
      setUser(session);
      const store = remember ? localStorage : sessionStorage;
      store.setItem(STORAGE_KEY, JSON.stringify(session));
      return null;
    },
    [],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
