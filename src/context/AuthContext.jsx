import React, { useCallback, useEffect, useState } from "react";
import * as api from "../api/client";
import { AuthContext } from "./authContextObject";

export { AuthContext };

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const loadUser = useCallback(async () => {
    try {
      setUser(await api.getMe());
    } catch (error) {
      if (error.status === 401) {
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
    const handleAuthFailure = () => {
      setUser(null);
      setAuthError(null);
      setLoading(false);
    };
    window.addEventListener("aegis:auth-failed", handleAuthFailure);
    void loadUser();
    return () => window.removeEventListener("aegis:auth-failed", handleAuthFailure);
  }, [loadUser]);

  const signIn = useCallback(async (credentials) => {
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
