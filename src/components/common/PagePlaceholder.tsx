import { Link } from "react-router-dom";
import { ArrowLeft, Layers, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface PagePlaceholderProps {
  title: string;
  description: string;
  badge?: string;
  icon?: LucideIcon;
}

export const PagePlaceholder = ({
  title,
  description,
  badge = "Stage 2 Scheduled",
  icon: Icon = Layers,
}: PagePlaceholderProps) => {
  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E8E4] dark:border-[#27282B]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-[#18191B] dark:text-[#EDEDED]">
              {title}
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#1B4D3E]/10 dark:bg-emerald-500/15 text-[#1B4D3E] dark:text-emerald-400 border border-[#1B4D3E]/20 dark:border-emerald-500/30">
              {badge}
            </span>
          </div>
          <p className="text-xs text-[#717378] dark:text-[#8E9096] mt-1">
            {description}
          </p>
        </div>

        <Link
          to="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#18191B] dark:text-[#EDEDED] bg-white dark:bg-[#1A1C1E] border border-[#E4E4E0] dark:border-[#2C2E32] hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors self-start sm:self-auto shadow-2xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Overview</span>
        </Link>
      </div>

      {/* Main placeholder canvas */}
      <div className="bg-white dark:bg-[#18191B] border border-dashed border-[#DCDCD6] dark:border-[#2E3035] rounded-2xl p-8 sm:p-12 text-center max-w-2xl mx-auto my-8">
        <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 text-[#1B4D3E] dark:text-emerald-400 flex items-center justify-center mx-auto mb-4 border border-[#E8E8E4] dark:border-[#27282B]">
          <Icon className="w-6 h-6" />
        </div>

        <h3 className="text-base font-semibold text-[#18191B] dark:text-[#EDEDED]">
          {title} Module
        </h3>

        <p className="text-xs text-[#717378] dark:text-[#8E9096] max-w-md mx-auto mt-2 leading-relaxed">
          {description}. This module is provisioned for full interactive implementation in Stage 2. All navigation routes, data bindings, and layouts are fully wired.
        </p>

        <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 text-xs text-[#1B4D3E] dark:text-emerald-400 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Security guardrails & role gates ready</span>
        </div>
      </div>
    </div>
  );
};
