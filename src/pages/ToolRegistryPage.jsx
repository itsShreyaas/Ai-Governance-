import React from "react";
import { Plus } from "lucide-react";
import { mockAiTools } from "../data/mockData";

export const ToolRegistryPage = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E8E4] dark:border-[#27282B]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[#18191B] dark:text-[#EDEDED]">
              AI Tool Registry
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#1B4D3E]/10 dark:bg-emerald-500/15 text-[#1B4D3E] dark:text-emerald-400 border border-[#1B4D3E]/20 dark:border-emerald-500/30">
              6 Cataloged
            </span>
          </div>
          <p className="text-xs text-[#717378] dark:text-[#8E9096] mt-1">
            Complete inventory of authorized and unvetted AI applications across Acme Global.
          </p>
        </div>

        <button
          disabled
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[#1B4D3E] opacity-75 cursor-not-allowed self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Register Tool (Stage 2)</span>
        </button>
      </div>

      {/* Quick summary grid of the 6 tools */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockAiTools.map((tool) => (
          <div
            key={tool.id}
            className="bg-white dark:bg-[#18191B] border border-[#E8E8E4] dark:border-[#27282B] rounded-xl p-4 shadow-2xs hover:border-[#D0D0CB] dark:hover:border-[#383A3E] transition-all"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-lg text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs"
                  style={{ backgroundColor: tool.iconColor || "#1B4D3E" }}
                >
                  {tool.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-[#18191B] dark:text-[#EDEDED]">
                    {tool.name}
                  </h3>
                  <p className="text-[10px] text-[#717378] dark:text-[#8E9096]">
                    {tool.vendor}
                  </p>
                </div>
              </div>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  tool.approvalStatus === "Approved"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : tool.approvalStatus === "Restricted"
                    ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                    : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                }`}
              >
                {tool.approvalStatus}
              </span>
            </div>

            <p className="text-[11px] text-[#64666B] dark:text-[#9A9CA2] line-clamp-2 mt-2 leading-relaxed">
              {tool.description}
            </p>

            <div className="mt-3 pt-3 border-t border-[#F0F0ED] dark:border-[#242629] flex items-center justify-between text-[11px] text-[#8A8C92]">
              <span>Risk: <strong>{tool.riskLevel}</strong></span>
              <span>{tool.userCount} users</span>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center py-4 text-xs text-[#8A8C92]">
        Full interactive filtering, tool onboarding workflows, and policy binding scheduled for Stage 2.
      </div>
    </div>
  );
};
