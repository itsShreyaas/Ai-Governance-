import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";

export const PendingReviewList = ({ tools }) => {
  const getRiskBadge = (risk) => {
    switch (risk) {
      case "High":
        return "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800";
      case "Medium":
        return "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case null:
        return "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700";
      default:
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
    }
  };

  const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "Approved":
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      case "Restricted":
        return "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800";
      default:
        return "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800";
    }
  };

  return (
    <div className="bg-white dark:bg-[#18191B] border border-[#E8E8E4] dark:border-[#27282B] rounded-xl p-5 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-[#F0F0ED] dark:border-[#222427]">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[#18191B] dark:text-[#EDEDED]">
                Tools Needing Governance Review
              </h2>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                {tools.length} Priority
              </span>
            </div>
            <p className="text-xs text-[#717378] dark:text-[#8E9096] mt-0.5">
              Tools flagged for security review or elevated risk threshold
            </p>
          </div>
          <Link
            to="/tools"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#1B4D3E] dark:text-emerald-400 hover:underline"
          >
            <span>All Tools</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {tools.length === 0 ? (
          <p className="py-6 text-center text-xs text-[#717378] dark:text-[#8E9096]">No tools currently need review.</p>
        ) : (
          <div className="divide-y divide-[#F0F0ED] dark:divide-[#222427] mt-1">
            {tools.map((tool) => (
              <div
                key={tool.id}
                className="py-3 first:pt-2 last:pb-1 flex items-center justify-between gap-3 hover:bg-neutral-50/50 dark:hover:bg-neutral-900/40 rounded-lg px-2 -mx-2 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-2xs"
                    style={{ backgroundColor: tool.iconColor || "#1B4D3E" }}
                  >
                    {tool.name.charAt(0)}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#18191B] dark:text-[#EDEDED] truncate">
                        {tool.name}
                      </span>
                      <span className="text-[10px] text-[#8A8C92] hidden sm:inline">
                        • {tool.vendor || "Vendor not specified"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-medium border ${getStatusBadge(
                          tool.approvalStatus
                        )}`}
                      >
                        {tool.approvalStatus}
                      </span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-medium border ${getRiskBadge(
                          tool.riskLevel
                        )}`}
                      >
                        {tool.riskLevel ? `${tool.riskLevel} Risk` : "Risk not assessed"}
                      </span>
                      <span className="text-[10px] text-[#8A8C92] hidden md:inline">
                        Dept: {tool.ownerDepartment || "Unassigned"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right hidden sm:block">
                    <div className="text-xs font-semibold text-[#18191B] dark:text-[#EDEDED]">
                      {tool.complianceScore == null ? "—" : `${tool.complianceScore}%`}
                    </div>
                    <div className="text-[10px] text-[#8A8C92]">
                      {tool.complianceScore == null ? `Submitted ${formatDate(tool.submittedAt)}` : "Compliance"}
                    </div>
                  </div>
                  <Link
                    to="/risk-assessments"
                    className="px-2.5 py-1 rounded-md text-xs font-medium text-[#1B4D3E] dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors flex items-center gap-1"
                  >
                    <span>Assess</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
