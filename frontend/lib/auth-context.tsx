"use client";

/**
 * Single auth seam for the whole frontend. Every portal (CEO, Sales,
 * Consultant, Client, ...) reads from this context rather than each
 * managing its own token/user state.
 */
import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { apiClient, ApiError } from "./api-client";

interface CurrentUser {
  id: string;
  email: string;
  full_name: string;
  role_key: string;
  branch_id: string | null;
  is_superuser: boolean;
  permissions: string[];
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<CurrentUser | null>;
  logout: () => Promise<void>;
  hasPermission: (key: string) => boolean;
  sessionExpiringSoon: boolean;
  extendSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ACCESS_TOKEN_KEY = "visa_crm_access_token";
const REFRESH_TOKEN_KEY = "visa_crm_refresh_token";
const REMEMBER_ME_KEY = "visa_crm_remember_me";

// Warn this many milliseconds before the access token actually expires,
// giving the person time to notice the banner and click "Stay signed in"
// before they lose whatever they were doing mid-edit.
const EXPIRY_WARNING_WINDOW_MS = 2 * 60 * 1000;

/** Storage picks up wherever "remember me" left it — localStorage
 * survives closing the browser, sessionStorage doesn't. Falls back to
 * sessionStorage (the safer default) if nothing has been chosen yet. */
function getStorage(): Storage {
  if (typeof window === "undefined") return sessionStorage;
  return localStorage.getItem(REMEMBER_ME_KEY) === "true" ? localStorage : sessionStorage;
}

function readToken(key: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key) ?? sessionStorage.getItem(key);
}

function clearTokens() {
  [ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY].forEach((key) => {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  });
  localStorage.removeItem(REMEMBER_ME_KEY);
}

/** Access tokens are JWTs — decoding the payload client-side (no
 * signature check needed, we're just reading `exp` to schedule a UI
 * warning) avoids a round trip just to know when to nudge the user. */
function getTokenExpiryMs(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpiringSoon, setSessionExpiringSoon] = useState(false);
  const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleExpiryWarning(accessToken: string) {
    if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
    setSessionExpiringSoon(false);
    const expiryMs = getTokenExpiryMs(accessToken);
    if (!expiryMs) return;
    const msUntilWarning = expiryMs - Date.now() - EXPIRY_WARNING_WINDOW_MS;
    warnTimerRef.current = setTimeout(() => setSessionExpiringSoon(true), Math.max(msUntilWarning, 0));
  }

  async function fetchCurrentUser(): Promise<CurrentUser | null> {
    const token = readToken(ACCESS_TOKEN_KEY);
    if (!token) return null;
    try {
      const me = await apiClient.get<CurrentUser>("/auth/me", { token });
      setUser(me);
      scheduleExpiryWarning(token);
      return me;
    } catch {
      clearTokens();
      return null;
    }
  }

  useEffect(() => {
    fetchCurrentUser().finally(() => setLoading(false));
    return () => {
      if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string, rememberMe = false): Promise<CurrentUser | null> {
    const tokens = await apiClient.post<{ access_token: string; refresh_token: string }>(
      "/auth/login",
      { email, password }
    );
    localStorage.setItem(REMEMBER_ME_KEY, rememberMe ? "true" : "false");
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
    storage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
    return fetchCurrentUser();
  }

  async function logout() {
    const refreshToken = readToken(REFRESH_TOKEN_KEY);
    if (refreshToken) {
      try {
        await apiClient.post("/auth/logout", { refresh_token: refreshToken });
      } catch {
        // best-effort; clear local state regardless
      }
    }
    clearTokens();
    setUser(null);
    setSessionExpiringSoon(false);
  }

  const extendSession = useCallback(async () => {
    const refreshToken = readToken(REFRESH_TOKEN_KEY);
    if (!refreshToken) return;
    try {
      const tokens = await apiClient.post<{ access_token: string; refresh_token: string }>("/auth/refresh", {
        refresh_token: refreshToken,
      });
      const storage = getStorage();
      storage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
      storage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
      scheduleExpiryWarning(tokens.access_token);
      setSessionExpiringSoon(false);
    } catch (err) {
      // Refresh token itself has expired too — nothing to do but send
      // them back to login rather than leave a dead banner up.
      if (err instanceof ApiError) {
        clearTokens();
        setUser(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function hasPermission(key: string): boolean {
    if (!user) return false;
    return user.is_superuser || user.permissions.includes(key);
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, hasPermission, sessionExpiringSoon, extendSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export function getAccessToken(): string | null {
  return readToken(ACCESS_TOKEN_KEY);
}
