import { createContext } from "react";
import type { LoginInput, UserDoc } from "@aegisai/shared";

export interface AuthContextValue {
  user: UserDoc | null;
  role: UserDoc["role"] | null;
  loading: boolean;
  authError: unknown | null;
  login: (credentials: LoginInput) => Promise<UserDoc>;
  logout: () => Promise<void>;
  reloadUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
