import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, ChevronDown, ChevronUp, Leaf, ShieldCheck } from "lucide-react";
import type { BalancedDietAnalysisReport } from "../types";

interface NutritionInsightCardProps {
  healthScore: number;
  alertLevel: "green" | "yellow" | "red";
  report: BalancedDietAnalysisReport;
  macroRatio?: {
    protein: number;
    carbs: number;
    fats: number;
  } | null;
}

const ALERT_STYLES = {
  green: {
    border: "border-emerald-200",
    badge: "bg-emerald-100 text-emerald-700",
    glow: "shadow-[0_20px_45px_-26px_rgba(16,185,129,0.45)]",
  },
  yellow: {
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-700",
    glow: "shadow-[0_20px_45px_-26px_rgba(245,158,11,0.45)]",
  },
  red: {
    border: "border-rose-200",
    badge: "bg-rose-100 text-rose-700",
    glow: "shadow-[0_20px_45px_-26px_rgba(244,63,94,0.45)]",
  },
} as const;

function polarToCartesian(cx: number, cy: number, r: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(angleInRadians),
    y: cy + r * Math.sin(angleInRadians),
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

export function NutritionInsightCard({
  healthScore,
  alertLevel,
  report,
  macroRatio,
}: NutritionInsightCardProps) {
  const [expanded, setExpanded] = useState(false);
  const style = ALERT_STYLES[alertLevel];

  const segments = useMemo(() => {
    const source = macroRatio || { protein: 0, carbs: 0, fats: 0 };
    return [
      { key: "carbs", label: "碳水", value: source.carbs, color: "#3b82f6" },
      { key: "protein", label: "蛋白质", value: source.protein, color: "#10b981" },
      { key: "fats", label: "脂肪", value: source.fats, color: "#f59e0b" },
    ];
  }, [macroRatio]);

  let currentAngle = 0;

  return (
    <div className={`rounded-[28px] border bg-white p-5 ${style.border} ${style.glow}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.26em] text-black/35">Balanced Diet</p>
          <h4 className="mt-2 text-lg font-black text-slate-900">膳食平衡建议</h4>
          <p className="mt-2 text-sm font-bold text-slate-600">{report.plate_comment}</p>
        </div>
        <div className={`rounded-full px-3 py-1 text-xs font-black ${style.badge}`}>
          {healthScore} / 100
        </div>
      </div>

      <div className="mt-5 grid grid-cols-[0.9fr_1.1fr] gap-4">
        <div className="rounded-[24px] bg-[#F8F9FA] p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-black/35">P/C/F 分布图</p>
            <span className={`rounded-full px-2 py-1 text-[10px] font-black ${style.badge}`}>{alertLevel}</span>
          </div>
          <div className="mt-3 flex items-center justify-center">
            <svg viewBox="0 0 120 120" className="h-28 w-28">
              <circle cx="60" cy="60" r="38" fill="none" stroke="#E5E7EB" strokeWidth="12" />
              {segments.map((segment) => {
                const startAngle = currentAngle;
                const endAngle = currentAngle + (segment.value || 0) * 3.6;
                currentAngle = endAngle;
                if (!segment.value) return null;
                return (
                  <path
                    key={segment.key}
                    d={describeArc(60, 60, 38, startAngle, endAngle)}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth="12"
                    strokeLinecap="round"
                  />
                );
              })}
            </svg>
          </div>
          <div className="mt-2 space-y-1 text-[11px] font-black">
            {segments.map((segment) => (
              <div key={segment.key} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-black/55">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
                  {segment.label}
                </span>
                <span>{segment.value.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-emerald-50 p-3">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-700/55">蔬果</p>
              <p className="mt-2 text-lg font-black text-emerald-700">{report.vegetables_fruits_ratio}%</p>
            </div>
            <div className="rounded-2xl bg-sky-50 p-3">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-sky-700/55">全谷物</p>
              <p className="mt-2 text-lg font-black text-sky-700">{report.whole_grains_ratio}%</p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-3">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-700/55">优质蛋白</p>
              <p className="mt-2 text-lg font-black text-amber-700">{report.healthy_protein_ratio}%</p>
            </div>
          </div>

          <div className="rounded-2xl bg-[#F8F9FA] p-4">
            <div className="flex items-center justify-between text-xs font-black">
              <span className="flex items-center gap-2 text-black/55">
                <Leaf size={14} />
                GI 预估
              </span>
              <span>{report.gi_level.toUpperCase()}</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs font-black">
              <span className="flex items-center gap-2 text-black/55">
                <AlertTriangle size={14} />
                加工等级
              </span>
              <span>{report.processing_level}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-[#F8F9FA] p-4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-black text-slate-900">
            <ShieldCheck size={16} className="text-emerald-600" />
            营养建议
          </p>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="flex items-center gap-1 text-xs font-black text-black/45"
          >
            {expanded ? "收起" : "展开"}
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {report.suggestions.slice(0, 2).map((item) => (
            <p key={item} className="text-sm font-bold text-slate-700">
              {item}
            </p>
          ))}
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-4 border-t border-black/5 pt-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-black/35">优点</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {report.strengths.map((item) => (
                      <span key={item} className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-black/35">风险点</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {report.risks.map((item) => (
                      <span key={item} className="rounded-full bg-rose-100 px-3 py-1 text-xs font-black text-rose-700">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-black/35">营养科普</p>
                  <p className="mt-2 text-sm font-bold text-slate-600">{report.education_tip}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
