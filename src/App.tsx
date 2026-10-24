import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import type { UserRole } from "@aegisai/shared";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./context/useAuth";
import { AppLayout } from "./components/layout/AppLayout";

const OverviewPage = lazy(() =>
  import("./pages/OverviewPage").then((module) => ({ default: module.OverviewPage }))
);
const LoginPage = lazy(() =>
  import("./pages/LoginPage").then((module) => ({ default: module.LoginPage }))
);
const ToolRegistryPage = lazy(() =>
  import("./pages/ToolRegistryPage").then((module) => ({ default: module.ToolRegistryPage }))
);
const PolicyMatrixPage = lazy(() =>
  import("./pages/PolicyMatrixPage").then((module) => ({ default: module.PolicyMatrixPage }))
);
const RiskAssessmentsPage = lazy(() =>
  import("./pages/RiskAssessmentsPage").then((module) => ({ default: module.RiskAssessmentsPage }))
);
const AuditLogPage = lazy(() =>
  import("./pages/AuditLogPage").then((module) => ({ default: module.AuditLogPage }))
);
const EmployeeCheckerPage = lazy(() =>
  import("./pages/EmployeeCheckerPage").then((module) => ({ default: module.EmployeeCheckerPage }))
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage }))
);

interface RequireAuthProps {
  role?: UserRole;
}

const RequireAuth = ({ role }: RequireAuthProps) => {
  const { user, role: userRole, loading, authError, reloadUser } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen bg-[#FBFBFA] dark:bg-[#111213]" aria-label="Loading session" />;
  }
  if (authError !== null) {
    const message =
      authError instanceof Error ? authError.message : "An unexpected error occurred.";
    return (
      <main className="min-h-screen bg-[#FBFBFA] dark:bg-[#111213] text-[#18191B] dark:text-[#EDEDED] grid place-items-center p-6">
        <div className="max-w-md rounded-xl border border-[#E8E8E4] dark:border-[#27282B] bg-white dark:bg-[#18191B] p-6 text-center">
          <p className="font-semibold">Unable to verify your session</p>
          <p className="mt-2 text-sm text-[#717378] dark:text-[#8E9096]">{message}</p>
          <button type="button" onClick={() => void reloadUser()} className="mt-4 rounded-lg bg-[#1B4D3E] px-4 py-2 text-sm font-medium text-white dark:bg-emerald-600">
            Retry
          </button>
        </div>
      </main>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (role && role !== userRole) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
};

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Suspense fallback={<div role="status" aria-label="Loading page" className="min-h-screen bg-[#FBFBFA] dark:bg-[#111213]" />}>
          <Routes>
            <Route path="login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<AppLayout />}>
                <Route index element={<OverviewPage />} />
                <Route path="tools" element={<ToolRegistryPage />} />
                <Route path="policy-matrix" element={<PolicyMatrixPage />} />
                <Route path="risk-assessments" element={<RiskAssessmentsPage />} />
                <Route path="audit-log" element={<AuditLogPage />} />
                <Route path="employee-checker" element={<EmployeeCheckerPage />} />
                <Route path="settings" element={<RequireAuth role="Admin" />}>
                  <Route index element={<SettingsPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Route>
          </Routes>
          </Suspense>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
