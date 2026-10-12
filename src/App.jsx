import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { AppLayout } from "./components/layout/AppLayout";
import { OverviewPage } from "./pages/OverviewPage";
import { ToolRegistryPage } from "./pages/ToolRegistryPage";
import { PolicyMatrixPage } from "./pages/PolicyMatrixPage";
import { RiskAssessmentsPage } from "./pages/RiskAssessmentsPage";
import { AuditLogPage } from "./pages/AuditLogPage";
import { EmployeeCheckerPage } from "./pages/EmployeeCheckerPage";
import { SettingsPage } from "./pages/SettingsPage";

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="tools" element={<ToolRegistryPage />} />
            <Route path="policy-matrix" element={<PolicyMatrixPage />} />
            <Route path="risk-assessments" element={<RiskAssessmentsPage />} />
            <Route path="audit-log" element={<AuditLogPage />} />
            <Route path="employee-checker" element={<EmployeeCheckerPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
