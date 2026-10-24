import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Boxes,
  FileSpreadsheet,
  ShieldAlert,
  History,
  UserCheck,
  Settings,
  Shield,
  X,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { getAudit, getDashboard, getTools } from "../../api/client";

const navItems = [
  { name: "Overview", path: "/", icon: LayoutDashboard },
  { name: "Tool Registry", path: "/tools", icon: Boxes },
  { name: "Policy Matrix", path: "/policy-matrix", icon: FileSpreadsheet },
  { name: "Risk Assessments", path: "/risk-assessments", icon: ShieldAlert, badgeColor: "amber" },
  { name: "Audit Log", path: "/audit-log", icon: History },
  { name: "Employee Checker", path: "/employee-checker", icon: UserCheck },
  { name: "Settings", path: "/settings", icon: Settings },
];

export const Sidebar = ({ isOpen, onClose }) => {
  const { role } = useAuth();
  const [countSnapshot, setCountSnapshot] = useState(null);
  const [countError, setCountError] = useState(null);
  const visibleItems = navItems.filter((item) => item.path !== "/settings" || role === "Admin");
  const liveCounts = countSnapshot?.role === role ? countSnapshot.counts : {};
  const liveCountError = countError?.role === role ? countError.message : "";

  useEffect(() => {
    if (role == null) return undefined;

    const controller = new AbortController();
    const canReadTools = ["Admin", "Compliance", "Requester", "Auditor"].includes(role);
    const canReadGovernance = ["Admin", "Compliance", "Auditor"].includes(role);
    const requests = [];

    if (canReadTools) {
      requests.push(
        getTools({ page: 1, limit: 1 }, { signal: controller.signal })
          .then((result) => ["tools", result.total])
      );
    }
    if (canReadGovernance) {
      requests.push(
        getDashboard({ signal: controller.signal })
          .then((result) => ["assessments", result.kpis.openAssessments])
      );
      requests.push(
        getAudit({ page: 1, limit: 1 }, { signal: controller.signal })
          .then((result) => ["auditEvents", result.total])
      );
    }

    Promise.all(requests)
      .then((entries) => {
        if (!controller.signal.aborted) {
          setCountSnapshot({ role, counts: Object.fromEntries(entries) });
          setCountError(null);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setCountError({ role, message: error.message || "Live counts are unavailable." });
        }
      });
    return () => controller.abort();
  }, [role]);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#FBFBFA] dark:bg-[#141517] border-r border-[#E8E8E4] dark:border-[#242629] flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        {/* Organization Header */}
        <div className="h-16 px-4 border-b border-[#E8E8E4] dark:border-[#242629] flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-[#1B4D3E] dark:bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-xs">
              <Shield className="w-4 h-4 text-emerald-100" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm text-[#18191B] dark:text-[#EDEDED] truncate">
                  Acme Global
                </span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <span className="text-[11px] text-[#717378] dark:text-[#8E9096] truncate">
                Enterprise Governance
              </span>
            </div>
          </div>

          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-md text-[#717378] hover:text-[#18191B] dark:hover:text-[#EDEDED] hover:bg-neutral-200/50 dark:hover:bg-neutral-800"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 px-3 py-4 overflow-y-auto space-y-6">
          <div>
            <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-[#8A8C92] dark:text-[#6C6E74] uppercase">
              Core Platform
            </div>
            <nav className="space-y-1">
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const badge = {
                  "/tools": liveCounts.tools,
                  "/risk-assessments": liveCounts.assessments,
                  "/audit-log": liveCounts.auditEvents,
                }[item.path];
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => onClose && onClose()}
                    className={({ isActive }) =>
                      `group relative flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                        isActive
                          ? "bg-[#1B4D3E]/10 dark:bg-emerald-500/15 text-[#1B4D3E] dark:text-emerald-400 font-semibold"
                          : "text-[#5C5E64] dark:text-[#9B9DA2] hover:text-[#18191B] dark:hover:text-[#EDEDED] hover:bg-neutral-200/40 dark:hover:bg-neutral-800/60"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div className="flex items-center gap-2.5">
                          {isActive && (
                            <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#1B4D3E] dark:bg-emerald-500 rounded-r-full" />
                          )}
                          <Icon
                            className={`w-4 h-4 transition-colors ${
                              isActive
                                ? "text-[#1B4D3E] dark:text-emerald-400"
                                : "text-[#7B7D83] dark:text-[#7A7D84] group-hover:text-[#18191B] dark:group-hover:text-[#EDEDED]"
                            }`}
                          />
                          <span>{item.name}</span>
                        </div>

                        {typeof badge === "number" && (
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-md ${
                              item.badgeColor === "amber"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                : "bg-neutral-200/80 text-[#555] dark:bg-neutral-800 dark:text-[#AAA]"
                            }`}
                          >
                            {badge}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Governance Quick Info Box */}
          <div className="mx-1 p-3 rounded-lg bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-600/15 dark:border-emerald-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-[#1B4D3E] dark:text-emerald-400" />
              <span className="text-[11px] font-semibold text-[#1B4D3E] dark:text-emerald-300">
                Governance in one place
              </span>
            </div>
            <p className="text-[11px] text-[#6A6D72] dark:text-[#989B9F] leading-relaxed">
              Track tool approvals, assessments, and audit activity.
            </p>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-[#E8E8E4] dark:border-[#242629]">
          {liveCountError && (
            <p role="status" className="mb-2 px-2 text-[10px] text-rose-600 dark:text-rose-400" title={liveCountError}>
              Live counts unavailable
            </p>
          )}
          <div className="flex items-center gap-1.5 rounded-md bg-neutral-100/60 px-2 py-1.5 text-[11px] text-[#717378] dark:bg-neutral-900/60 dark:text-[#8E9096]">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Governance platform</span>
          </div>
        </div>
      </aside>
    </>
  );
};
