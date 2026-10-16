import type { UserRole } from "@aegisai/shared";

declare global {
  namespace Express {
    interface AuthenticatedUser {
      id: string;
      name: string;
      email: string;
      department: string;
      role: UserRole;
    }

    interface Request {
      authUser?: AuthenticatedUser;
    }
  }
}

export {};