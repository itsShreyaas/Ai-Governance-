import { Router, type CookieOptions, type RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { LoginSchema, RefreshTokenSchema, UserRole } from "@aegisai/shared";
import { login, logout, refresh } from "../services/authService.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { validate } from "../middleware/validate.js";
import { HttpError } from "../middleware/httpError.js";
import { requireCsrfHeader } from "../middleware/requireCsrfHeader.js";

const router = Router();
const ACCESS_COOKIE = "aegis_access";
const REFRESH_COOKIE = "aegis_refresh";
const refreshMaxAge = 7 * 24 * 60 * 60 * 1000;
const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  path: "/",
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 429, code: "RATE_LIMITED", message: "Too many login attempts" },
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const loginHandler: RequestHandler = async (req, res) => {
  const authSession = await login(req.body);
  res.cookie(ACCESS_COOKIE, authSession.accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
  res.cookie(REFRESH_COOKIE, authSession.refreshToken, { ...cookieOptions, maxAge: refreshMaxAge });
  res.status(200).json({ user: authSession.user });
};

const refreshHandler: RequestHandler = async (req, res) => {
  const tokenResult = RefreshTokenSchema.safeParse(req.cookies?.[REFRESH_COOKIE]);
  if (!tokenResult.success) {
    clearSessionCookies(res);
    throw new HttpError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired");
  }

  const outcome = await refresh(tokenResult.data);
  if ("error" in outcome) {
    clearSessionCookies(res);
    throw new HttpError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired");
  }
  res.cookie(ACCESS_COOKIE, outcome.session.accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
  res.cookie(REFRESH_COOKIE, outcome.session.refreshToken, { ...cookieOptions, maxAge: refreshMaxAge });
  res.status(200).json({ user: outcome.session.user });
};

const logoutHandler: RequestHandler = async (req, res) => {
  const tokenResult = RefreshTokenSchema.safeParse(req.cookies?.[REFRESH_COOKIE]);
  if (tokenResult.success) await logout(tokenResult.data);
  clearSessionCookies(res);
  res.status(204).end();
};

router.post("/login", loginLimiter, requireCsrfHeader, validate(LoginSchema), loginHandler);
router.post("/refresh", refreshLimiter, requireCsrfHeader, refreshHandler);
router.post("/logout", requireCsrfHeader, logoutHandler);
router.get("/me", requireAuth, requireRole(...Object.values(UserRole)), (req, res) => {
  res.status(200).json({ user: req.authUser });
});

function clearSessionCookies(res: Parameters<RequestHandler>[1]): void {
  res.clearCookie(ACCESS_COOKIE, cookieOptions);
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
}

export { router as authRouter };