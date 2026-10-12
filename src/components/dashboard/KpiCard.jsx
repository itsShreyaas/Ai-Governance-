import React from "react";

export const KpiCard = ({
  title,
  value,
  subtitle,
  badgeText,
  badgeVariant = "default",
  icon: Icon,
  trend,
}) => {
  const badgeClasses = {
    forest: "bg-[#1B4D3E]/10 text-[#1B4D3E] dark:bg-emerald-500/15 dark:text-emerald-400 border border-[#1B4D3E]/20 dark:border-emerald-500/30",
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800",
    rose: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800",
    neutral: "bg-neutral-100 text-[#555] dark:bg-neutral-800 dark:text-[#AAA] border border-neutral-200 dark:border-neutral-700",
  }[badgeVariant] || "bg-neutral-100 text-[#555] dark:bg-neutral-800 dark:text-[#AAA]";

  return (
    <div className="bg-white dark:bg-[#18191B] border border-[#E8E8E4] dark:border-[#27282B] rounded-xl p-4 md:p-5 shadow-xs hover:border-[#D0D0CB] dark:hover:border-[#383A3E] transition-all duration-150">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span className="text-xs font-medium text-[#64666B] dark:text-[#929499]">
          {title}
        </span>
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-neutral-100/70 dark:bg-neutral-800 flex items-center justify-center text-[#555] dark:text-[#BBB]">
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <div className="text-2xl md:text-3xl font-semibold tracking-tight text-[#18191B] dark:text-[#EDEDED]">
          {value}
        </div>
        {badgeText && (
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${badgeClasses}`}>
            {badgeText}
          </span>
        )}
      </div>

      {(subtitle || trend) && (
        <div className="mt-2.5 pt-2.5 border-t border-[#F0F0ED] dark:border-[#222427] flex items-center justify-between text-[11px] text-[#717378] dark:text-[#8E9096]">
          <span>{subtitle}</span>
          {trend && <span className="font-medium text-[#1B4D3E] dark:text-emerald-400">{trend}</span>}
        </div>
      )}
    </div>
  );
};
