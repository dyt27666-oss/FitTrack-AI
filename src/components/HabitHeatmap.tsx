import React from "react";
import type { HabitHeatmapCell } from "../types";

interface HabitHeatmapProps {
  data: HabitHeatmapCell[];
  onSelectDate?: (date: string) => void;
}

const LEVEL_CLASSES: Record<HabitHeatmapCell["level"], string> = {
  0: "bg-[#ebedf0]",
  1: "bg-[#c7f0cf]",
  2: "bg-[#7ddc8d]",
  3: "bg-[#34c759]",
  4: "bg-[#167c3a]",
};

export function HabitHeatmap({ data, onSelectDate }: HabitHeatmapProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-black/35">Consistency Map</p>
          <p className="mt-1 text-sm font-bold text-slate-600">颜色越深，说明当天完成率越高。</p>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-black text-black/30">
          <span>低</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <span key={level} className={`h-3 w-3 rounded-[4px] ${LEVEL_CLASSES[level as HabitHeatmapCell["level"]]}`} />
          ))}
          <span>高</span>
        </div>
      </div>

      <div className="grid grid-cols-10 gap-2 sm:grid-cols-15">
        {data.map((cell) => (
          <button
            key={cell.date}
            type="button"
            onClick={() => onSelectDate?.(cell.date)}
            className={`group relative aspect-square rounded-[6px] ${LEVEL_CLASSES[cell.level]} transition-transform hover:scale-110`}
            title={`${cell.date} · ${cell.completed}/${cell.total} · ${Math.round(cell.rate * 100)}%`}
          >
            <span className="absolute left-1/2 top-full z-10 hidden -translate-x-1/2 rounded-md bg-black px-2 py-1 text-[10px] font-bold text-white group-hover:block">
              {cell.date} {cell.completed}/{cell.total}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
