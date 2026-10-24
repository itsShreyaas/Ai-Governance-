import React, { useCallback, useEffect, useState } from "react";
import {
  Boxes,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Download,
} from "lucide-react";
import { getDashboard } from "../api/client";
import { KpiCard } from "../components/dashboard/KpiCard";
import { StatusChart } from "../components/dashboard/StatusChart";
import { RiskChart } from "../components/dashboard/RiskChart";
import { RecentActivity } from "../components/dashboard/RecentActivity";
import { PendingReviewList } from "../components/dashboard/PendingReviewList";

export const OverviewPage = () => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      setDashboard(await getDashboard());
    } catch (requestError) {
      setError(requestError.message || "Unable to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  const retryDashboard = () => {
    setLoading(true);
    setError("");
    void loadDashboard();
  };

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="space-y-6" aria-label="Loading dashboard">
        <div className="h-16 animate-pulse rounded-xl bg-neutral-200/70 dark:bg-neutral-800" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-xl border border-[#E8E8E4] bg-neutral-100 dark:border-[#27282B] dark:bg-[#18191B]" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="h-72 animate-pulse rounded-xl border border-[#E8E8E4] bg-neutral-100 dark:border-[#27282B] dark:bg-[#18191B]" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
        <p className="font-semibold">Dashboard data could not be loaded</p>
        <p className="mt-1">{error}</p>
        <button type="button" onClick={retryDashboard} className="mt-4 rounded-lg bg-rose-700 px-3 py-2 font-medium text-white hover:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-500">
          Retry
        </button>
      </div>
    );
  }

  const metrics = dashboard.kpis;
  const hasDashboardData = metrics.totalTools > 0 || dashboard.toolsNeedingReview.length > 0 || dashboard.recentAudits.length > 0;

  return (
    <div className="space-y-6">
      {/* Top Welcome / Status strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E8E4] dark:border-[#27282B]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[#18191B] dark:text-[#EDEDED]">
              Governance & Risk Dashboard
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#1B4D3E]/10 dark:bg-emerald-500/15 text-[#1B4D3E] dark:text-emerald-400 border border-[#1B4D3E]/20 dark:border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              NIST & ISO 42001
            </span>
          </div>
          <p className="text-xs text-[#717378] dark:text-[#8E9096] mt-1">
            Real-time oversight of sanctioned, pending, and restricted enterprise AI services.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#18191B] dark:text-[#EDEDED] bg-white dark:bg-[#1A1C1E] border border-[#E4E4E0] dark:border-[#2C2E32] hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total AI Tools"
          value={metrics.totalTools}
          subtitle="Enterprise fleet catalog"
          badgeText="Live"
          badgeVariant="forest"
          icon={Boxes}
          trend={`${metrics.toolsAddedThisMonth} added this month`}
        />
        <KpiCard
          title="Approved Tools"
          value={metrics.approvedTools}
          subtitle="Passed security gate"
          badgeText="Safe to Use"
          badgeVariant="emerald"
          icon={ShieldCheck}
          trend={`${metrics.totalTools ? Math.round((metrics.approvedTools / metrics.totalTools) * 100) : 0}% of fleet`}
        />
        <KpiCard
          title="Restricted Tools"
          value={metrics.restrictedTools}
          subtitle="Policy violations or containment"
          badgeText="Isolated"
          badgeVariant="rose"
          icon={ShieldAlert}
          trend={undefined}
        />
        <KpiCard
          title="Pending Review"
          value={metrics.pendingTools}
          subtitle="Under InfoSec appraisal"
          badgeText="Action Needed"
          badgeVariant="amber"
          icon={Clock}
          trend={metrics.avgReviewDays == null ? undefined : `Avg response ${metrics.avgReviewDays.toFixed(1)}d`}
        />
      </div>

      {hasDashboardData ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <StatusChart data={dashboard.statusChartData} totalTools={metrics.totalTools} />
            <RiskChart data={dashboard.riskChartData} totalTools={metrics.totalTools} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <PendingReviewList tools={dashboard.toolsNeedingReview} />
            <RecentActivity events={dashboard.recentAudits} />
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-[#D5D5D0] bg-white p-10 text-center dark:border-[#35373B] dark:bg-[#18191B]">
          <h2 className="font-semibold">No governance activity yet</h2>
          <p className="mt-1 text-sm text-[#717378] dark:text-[#8E9096]">Dashboard charts and activity will appear as tools and audit events are added.</p>
        </div>
      )}
    </div>
  );
};
