import React from "react";
import { Download } from "lucide-react";
import { mockAuditEvents } from "../data/mockData";

export const AuditLogPage = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E8E4] dark:border-[#27282B]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[#18191B] dark:text-[#EDEDED]">
              Audit Log
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#1B4D3E]/10 dark:bg-emerald-500/15 text-[#1B4D3E] dark:text-emerald-400 border border-[#1B4D3E]/20 dark:border-emerald-500/30">
              10 Recorded Events
            </span>
          </div>
          <p className="text-xs text-[#717378] dark:text-[#8E9096] mt-1">
            Tamper-evident trail of tool submissions, policy changes, scans, and approvals.
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#18191B] dark:text-[#EDEDED] bg-white dark:bg-[#1A1C1E] border border-[#E4E4E0] dark:border-[#2C2E32] hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-2xs self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Audit Trail</span>
        </button>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white dark:bg-[#18191B] border border-[#E8E8E4] dark:border-[#27282B] rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 dark:bg-neutral-900/60 border-b border-[#E8E8E4] dark:border-[#27282B] text-[#717378] dark:text-[#8E9096]">
              <tr>
                <th className="px-4 py-3 font-medium">Timestamp</th>
                <th className="px-4 py-3 font-medium">Event Type</th>
                <th className="px-4 py-3 font-medium">Tool</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0ED] dark:divide-[#242629]">
              {mockAuditEvents.map((event) => (
                <tr
                  key={event.id}
                  className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/40 transition-colors"
                >
                  <td className="px-4 py-3 text-[#717378] dark:text-[#8E9096] whitespace-nowrap">
                    {event.timestamp}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800 text-[#444] dark:text-[#BBB]">
                      {event.eventType}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#18191B] dark:text-[#EDEDED] whitespace-nowrap">
                    {event.toolName}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-medium text-[#18191B] dark:text-[#EDEDED]">
                      {event.actorName}
                    </span>
                    <span className="block text-[10px] text-[#8A8C92]">
                      {event.department}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#64666B] dark:text-[#9A9CA2] max-w-md">
                    {event.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
