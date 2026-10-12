import React from "react";
import {
  Boxes,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Download,
  Users,
  Award,
} from "lucide-react";
import { mockAiTools, mockAuditEvents, getGovernanceMetrics } from "../data/mockData";
import { KpiCard } from "../components/dashboard/KpiCard";
import { StatusChart } from "../components/dashboard/StatusChart";
import { RiskChart } from "../components/dashboard/RiskChart";
import { RecentActivity } from "../components/dashboard/RecentActivity";
import { PendingReviewList } from "../components/dashboard/PendingReviewList";

export const OverviewPage = () => {
  const metrics = getGovernanceMetrics(mockAiTools, mockAuditEvents);

  const totalUsers = mockAiTools.reduce((acc, t) => acc + (t.userCount || 0), 0);
  const avgCompliance = Math.round(
    mockAiTools.reduce((acc, t) => acc + (t.complianceScore || 0), 0) / mockAiTools.length
  );

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
          <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-neutral-100/70 dark:bg-neutral-800/70 text-xs text-[#555] dark:text-[#AAA] border border-[#E8E8E4] dark:border-[#2C2E32]">
            <Users className="w-3.5 h-3.5 text-[#1B4D3E] dark:text-emerald-400" />
            <span>
              <strong className="text-[#18191B] dark:text-white font-semibold">{totalUsers}</strong> active users
            </span>
            <span className="text-neutral-300 dark:text-neutral-700">|</span>
            <Award className="w-3.5 h-3.5 text-[#1B4D3E] dark:text-emerald-400" />
            <span>
              <strong className="text-[#18191B] dark:text-white font-semibold">{avgCompliance}%</strong> compliance avg
            </span>
          </div>

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
          badgeText="100% Tracked"
          badgeVariant="forest"
          icon={Boxes}
          trend="+2 this month"
        />
        <KpiCard
          title="Approved Tools"
          value={metrics.approvedTools}
          subtitle="Passed security gate"
          badgeText="Safe to Use"
          badgeVariant="emerald"
          icon={ShieldCheck}
          trend={`${Math.round((metrics.approvedTools / metrics.totalTools) * 100)}% of fleet`}
        />
        <KpiCard
          title="Restricted Tools"
          value={metrics.restrictedTools}
          subtitle="Policy violations or containment"
          badgeText="Isolated"
          badgeVariant="rose"
          icon={ShieldAlert}
          trend="IP protection active"
        />
        <KpiCard
          title="Pending Review"
          value={metrics.pendingTools}
          subtitle="Under InfoSec appraisal"
          badgeText="Action Needed"
          badgeVariant="amber"
          icon={Clock}
          trend="Avg response 1.4d"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <StatusChart
          data={metrics.statusChartData}
          totalTools={metrics.totalTools}
        />
        <RiskChart
          data={metrics.riskChartData}
          totalTools={metrics.totalTools}
        />
      </div>

      {/* Lists Row: Tools Needing Review & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <PendingReviewList tools={metrics.toolsNeedingReview} />
        <RecentActivity events={metrics.recentAudits} />
      </div>
    </div>
  );
};
