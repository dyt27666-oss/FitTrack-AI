import React, { useMemo } from "react";
import type { HabitHistoryPoint } from "../types";

interface HabitTrendCurveProps {
  points: HabitHistoryPoint[];
}

function buildPath(points: HabitHistoryPoint[], width: number, height: number) {
  if (!points.length) return "";
  const maxX = Math.max(points.length - 1, 1);
  return points
    .map((point, index) => {
      const x = (index / maxX) * width;
      const y = height - point.value * height;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

export function HabitTrendCurve({ points }: HabitTrendCurveProps) {
  const normalized = useMemo(
    () =>
      points.map((point) => ({
        ...point,
        value: point.status === "done" ? 1 : point.status === "missed" ? 0 : 0.35,
      })),
    [points]
  );

  const width = 320;
  const height = 96;
  const path = buildPath(normalized, width, height);
  const areaPath = path ? `${path} L ${width} ${height} L 0 ${height} Z` : "";

  return (
    <div className="rounded-[20px] bg-[#F8F9FA] p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-black/35">30 Day Trend</p>
        <p className="text-xs font-bold text-black/40">完成=1 未完成=0 待定=0.35</p>
      </div>
      <div className="mt-4">
        <svg viewBox={`0 0 ${width} ${height + 8}`} className="h-28 w-full">
          <defs>
            <linearGradient id="habit-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#16a34a" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#16a34a" stopOpacity="0.04" />
            </linearGradient>
          </defs>
          <line x1="0" y1={height} x2={width} y2={height} stroke="#d4d4d8" strokeDasharray="4 4" />
          <line x1="0" y1={height * 0.5} x2={width} y2={height * 0.5} stroke="#e5e7eb" strokeDasharray="4 4" />
          {areaPath && <path d={areaPath} fill="url(#habit-area)" />}
          {path && <path d={path} fill="none" stroke="#16a34a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
          {normalized.map((point, index) => {
            const x = (index / Math.max(normalized.length - 1, 1)) * width;
            const y = height - point.value * height;
            return <circle key={point.date} cx={x} cy={y} r="3.5" fill="#166534" />;
          })}
        </svg>
      </div>
      <div className="mt-3 flex justify-between text-[10px] font-bold text-black/30">
        <span>{points[0]?.date || "--"}</span>
        <span>{points[points.length - 1]?.date || "--"}</span>
      </div>
    </div>
  );
}
