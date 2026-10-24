import type { DashboardResponse } from "@aegisai/shared";
import type { TooltipContentProps } from "recharts";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";

type RiskChartData = DashboardResponse["riskChartData"][number];

interface RiskChartProps {
  data: DashboardResponse["riskChartData"];
  totalTools: number;
}

function isRiskChartData(value: unknown): value is RiskChartData {
  return (
    typeof value === "object" &&
    value !== null &&
    "level" in value &&
    typeof value.level === "string" &&
    "count" in value &&
    typeof value.count === "number" &&
    "percentage" in value &&
    typeof value.percentage === "number" &&
    "fill" in value &&
    typeof value.fill === "string"
  );
}

const CustomBarTooltip = ({ active, payload }: TooltipContentProps) => {
  const data: unknown = payload[0]?.payload;
  if (active && isRiskChartData(data)) {
    return (
      <div className="bg-white dark:bg-[#1A1C1E] border border-[#E4E4E0] dark:border-[#2C2E32] rounded-lg shadow-lg px-3 py-2 text-xs">
        <div className="font-semibold text-[#18191B] dark:text-[#EDEDED] flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full inline-block"
            style={{ backgroundColor: data.fill }}
          />
          {data.level}
        </div>
        <div className="text-[#64666B] dark:text-[#9A9CA2] mt-0.5">
          {data.count} tool{data.count > 1 ? "s" : ""} ({data.percentage}%)
        </div>
      </div>
    );
  }
  return null;
};

export const RiskChart = ({ data, totalTools }: RiskChartProps) => {
  return (
    <div className="bg-white dark:bg-[#18191B] border border-[#E8E8E4] dark:border-[#27282B] rounded-xl p-5 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#18191B] dark:text-[#EDEDED]">
            Risk Classification Profile
          </h2>
          <span className="text-[11px] font-medium text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200/50 dark:border-emerald-800/40">
            {totalTools} Evaluated
          </span>
        </div>
        <p className="text-xs text-[#717378] dark:text-[#8E9096] mt-0.5">
          Categorized by data exposure and operational impact
        </p>
      </div>

      <div className="h-48 my-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 12, right: 10, left: -20, bottom: 0 }}
          >
            <XAxis
              dataKey="level"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#717378" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              tick={{ fontSize: 10, fill: "#8A8C92" }}
            />
            <Tooltip content={CustomBarTooltip} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
            <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={36}>
              {data.map((entry, index) => (
                <Cell key={`bar-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Breakdown footer */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#F0F0ED] dark:border-[#222427] text-xs">
        {data.map((item) => (
          <div key={item.level} className="flex flex-col items-center sm:items-start">
            <span className="text-[11px] text-[#717378] dark:text-[#8E9096]">
              {item.level}
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-semibold text-xs text-[#18191B] dark:text-[#EDEDED]">
                {item.count}
              </span>
              <span className="text-[10px] text-[#8A8C92]">({item.percentage}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
