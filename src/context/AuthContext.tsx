import { useCallback, useEffect, useState, type PropsWithChildren } from "react";
import type { AuthUser, LoginInput } from "@aegisai/shared";
import * as api from "../api/client";
import { ApiError } from "../api/client";
import { AuthContext } from "./authContextObject";

export { AuthContext };

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<unknown | null>(null);

  const loadUser = useCallback(async () => {
    try {
      setUser(await api.getMe());
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
      } else {
        setAuthError(error);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const reloadUser = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    await loadUser();
  }, [loadUser]);

  useEffect(() => {
    const controller = new AbortController();
    const handleAuthFailure = () => {
      setUser(null);
      setAuthError(null);
      setLoading(false);
    };
    window.addEventListener("aegis:auth-failed", handleAuthFailure);
    api.getMe()
      .then((loadedUser) => {
        if (!controller.signal.aborted) setUser(loadedUser);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) {
          setUser(null);
        } else {
          setAuthError(error);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
      window.removeEventListener("aegis:auth-failed", handleAuthFailure);
    };
  }, []);

  const signIn = useCallback(async (credentials: LoginInput): Promise<AuthUser> => {
    const signedInUser = await api.login(credentials);
    setUser(signedInUser);
    setAuthError(null);
    return signedInUser;
  }, []);

  const signOut = useCallback(async () => {
    await api.logout();
    setUser(null);
    setAuthError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, role: user?.role ?? null, loading, authError, login: signIn, logout: signOut, reloadUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};
