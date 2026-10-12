import React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-[#1A1C1E] border border-[#E4E4E0] dark:border-[#2C2E32] rounded-lg shadow-lg px-3 py-2 text-xs">
        <div className="font-semibold text-[#18191B] dark:text-[#EDEDED] flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full inline-block"
            style={{ backgroundColor: data.color }}
          />
          {data.name}
        </div>
        <div className="text-[#64666B] dark:text-[#9A9CA2] mt-0.5">
          {data.value} tool{data.value > 1 ? "s" : ""}
        </div>
      </div>
    );
  }
  return null;
};

export const StatusChart = ({ data, totalTools }) => {
  return (
    <div className="bg-white dark:bg-[#18191B] border border-[#E8E8E4] dark:border-[#27282B] rounded-xl p-5 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#18191B] dark:text-[#EDEDED]">
            Tool Approval Distribution
          </h2>
          <span className="text-[11px] text-[#717378] dark:text-[#8E9096]">
            {totalTools} tools active
          </span>
        </div>
        <p className="text-xs text-[#717378] dark:text-[#8E9096] mt-0.5">
          Fleet posture by governance review stage
        </p>
      </div>

      <div className="relative h-48 my-2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<CustomTooltip />} />
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={74}
              paddingAngle={3}
              dataKey="value"
              stroke="transparent"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-[#18191B] dark:text-[#EDEDED]">
            {totalTools}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-[#8A8C92]">
            Total
          </span>
        </div>
      </div>

      {/* Legend list */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#F0F0ED] dark:border-[#222427] text-xs">
        {data.map((item) => (
          <div key={item.name} className="flex flex-col items-center sm:items-start">
            <div className="flex items-center gap-1.5 text-[11px] text-[#717378] dark:text-[#8E9096]">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="truncate">{item.name}</span>
            </div>
            <span className="font-semibold text-xs text-[#18191B] dark:text-[#EDEDED] mt-0.5">
              {item.value} ({totalTools > 0 ? Math.round((item.value / totalTools) * 100) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
