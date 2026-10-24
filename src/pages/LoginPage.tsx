import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { LoginSchema } from "@aegisai/shared";
import { ApiError } from "../api/client";
import { useAuth } from "../context/useAuth";
import { useTheme } from "../context/useTheme";

export const LoginPage = () => {
  const { user, loading, login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<"email" | "password", string>>>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return <div className="min-h-screen bg-[#FBFBFA] dark:bg-[#111213]" aria-label="Checking session" />;
  }
  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setFormError("");
    const result = LoginSchema.safeParse({ email, password });
    if (!result.success) {
      const errors: Partial<Record<"email" | "password", string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if ((field === "email" || field === "password") && !errors[field]) {
          errors[field] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      await login(result.data);
      const locationState: unknown = location.state;
      const from =
        typeof locationState === "object" && locationState !== null && "from" in locationState
          ? locationState.from
          : null;
      const pathname =
        typeof from === "object" && from !== null && "pathname" in from &&
        typeof from.pathname === "string"
          ? from.pathname
          : "/";
      const destination = pathname || "/";
      navigate(destination === "/login" ? "/" : destination, { replace: true });
    } catch (error: unknown) {
      if (error instanceof ApiError && (error.status === 429 || error.code === "RATE_LIMITED")) {
        setFormError("There have been too many sign-in attempts. Please wait a few minutes and try again.");
      } else if (error instanceof ApiError && error.status === 401) {
        setFormError("Sign-in failed. Check your email and password, or wait 15 minutes if repeated attempts temporarily locked your account.");
      } else {
        setFormError(error instanceof Error ? error.message : "Unable to sign in right now. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full rounded-lg border border-[#E4E4E0] dark:border-[#2C2E32] bg-white dark:bg-[#111213] px-3 py-2.5 text-sm text-[#18191B] dark:text-[#EDEDED] placeholder:text-[#8A8C92] focus:outline-none focus:ring-2 focus:ring-[#1B4D3E] dark:focus:ring-emerald-500";

  return (
    <main className="min-h-screen bg-[#FBFBFA] dark:bg-[#111213] text-[#18191B] dark:text-[#EDEDED] flex items-center justify-center p-4">
      <section className="w-full max-w-md rounded-2xl border border-[#E8E8E4] dark:border-[#27282B] bg-white dark:bg-[#18191B] p-7 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#1B4D3E] dark:text-emerald-400">AegisAI</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Sign in</h1>
            <p className="mt-1 text-sm text-[#717378] dark:text-[#8E9096]">Access your AI governance workspace.</p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-lg px-2 py-1.5 text-xs text-[#555] hover:bg-neutral-100 dark:text-[#AAA] dark:hover:bg-neutral-800"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>

        <form className="mt-7 space-y-4" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "email-error" : undefined}
              required
            />
            {fieldErrors.email && <p id="email-error" className="mt-1 text-xs text-rose-600 dark:text-rose-400">{fieldErrors.email}</p>}
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "password-error" : undefined}
              required
            />
            {fieldErrors.password && <p id="password-error" className="mt-1 text-xs text-rose-600 dark:text-rose-400">{fieldErrors.password}</p>}
          </div>
          {formError && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              {formError}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-[#1B4D3E] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#153D31] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
};
