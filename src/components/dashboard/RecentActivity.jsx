import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Info,
} from "lucide-react";

export const RecentActivity = ({ events }) => {
  const getSeverityBadge = (severity) => {
    switch (severity) {
      case "critical":
        return {
          icon: ShieldAlert,
          dot: "bg-rose-500",
          badge: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800",
        };
      case "warning":
        return {
          icon: AlertCircle,
          dot: "bg-amber-500",
          badge: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800",
        };
      case "success":
        return {
          icon: CheckCircle2,
          dot: "bg-emerald-500",
          badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
        };
      default:
        return {
          icon: Info,
          dot: "bg-blue-500",
          badge: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800",
        };
    }
  };

  const formatTimestamp = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Unknown time" : new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  return (
    <div className="bg-white dark:bg-[#18191B] border border-[#E8E8E4] dark:border-[#27282B] rounded-xl p-5 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-[#F0F0ED] dark:border-[#222427]">
          <div>
            <h2 className="text-sm font-semibold text-[#18191B] dark:text-[#EDEDED]">
              Recent Audit Activity
            </h2>
            <p className="text-xs text-[#717378] dark:text-[#8E9096] mt-0.5">
              Immutable telemetry log for enterprise compliance
            </p>
          </div>
          <Link
            to="/audit-log"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#1B4D3E] dark:text-emerald-400 hover:underline"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {events.length === 0 ? (
          <p className="py-6 text-center text-xs text-[#717378] dark:text-[#8E9096]">No audit activity to show.</p>
        ) : (
          <div className="divide-y divide-[#F0F0ED] dark:divide-[#222427] mt-1">
            {events.map((event) => {
              const config = getSeverityBadge(event.severity);
              const Icon = config.icon;

              return (
                <div
                  key={event.id}
                  className="py-3 first:pt-2 last:pb-1 flex items-start gap-3 hover:bg-neutral-50/50 dark:hover:bg-neutral-900/40 rounded-lg px-2 -mx-2 transition-colors"
                >
                  {/* Actor Avatar */}
                  <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[10px] font-semibold text-[#555] dark:text-[#AAA] flex items-center justify-center shrink-0 border border-[#E4E4E0] dark:border-[#2E3034]">
                    {event.actorAvatar}
                  </div>

                  {/* Event Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-medium text-[#18191B] dark:text-[#EDEDED] truncate">
                          {event.actorName || "Unknown user"}
                        </span>
                        <span className="text-xs font-semibold text-[#1B4D3E] dark:text-emerald-400 truncate">
                          {event.toolName || "Governance"}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#8A8C92] shrink-0">
                        {formatTimestamp(event.timestamp)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${config.badge}`}
                      >
                        <Icon className="w-3 h-3" />
                        {event.eventType.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
