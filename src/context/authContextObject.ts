import { createContext } from "react";
import type { AuthUser, LoginInput } from "@aegisai/shared";

export interface AuthContextValue {
  user: AuthUser | null;
  role: AuthUser["role"] | null;
  loading: boolean;
  authError: unknown | null;
  login: (credentials: LoginInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
  reloadUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
