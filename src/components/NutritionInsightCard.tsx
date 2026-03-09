import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
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

const alertTone = {
  green: {
    pill: "bg-emerald-100 text-emerald-700",
    border: "border-emerald-200",
  },
  yellow: {
    pill: "bg-amber-100 text-amber-700",
    border: "border-amber-200",
  },
  red: {
    pill: "bg-rose-100 text-rose-700",
    border: "border-rose-200",
  },
} as const;

function polarToCartesian(cx: number, cy: number, r: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
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
  const [expanded, setExpanded] = useState(true);
  const tone = alertTone[alertLevel];
  const strengths = Array.isArray(report.strengths) ? report.strengths : [];
  const weaknesses = Array.isArray(report.weaknesses)
    ? report.weaknesses
    : Array.isArray(report.risks)
      ? report.risks
      : [];
  const improvements = Array.isArray(report.improvements)
    ? report.improvements
    : Array.isArray(report.suggestions)
      ? report.suggestions
      : [];
  const segments = useMemo(() => {
    const source = macroRatio || { protein: 0, carbs: 0, fats: 0 };
    return [
      { key: "carbs", label: "碳水", value: source.carbs, color: "#4B82F1" },
      { key: "protein", label: "蛋白质", value: source.protein, color: "#15B57A" },
      { key: "fats", label: "脂肪", value: source.fats, color: "#F59E0B" },
    ];
  }, [macroRatio]);
  const metricItems = useMemo(
    () => [
      {
        label: "蔬果均衡",
        value: Math.max(0, Math.round(report.vegetables_fruits_ratio ?? 0)),
        toneClass: "bg-emerald-50 text-emerald-700",
      },
      {
        label: "全谷物比",
        value: Math.max(0, Math.round(report.whole_grains_ratio ?? 0)),
        toneClass: "bg-sky-50 text-sky-700",
      },
      {
        label: "优质蛋白",
        value: Math.max(0, Math.round(report.healthy_protein_ratio ?? 0)),
        toneClass: "bg-amber-50 text-amber-700",
      },
    ],
    [report.healthy_protein_ratio, report.vegetables_fruits_ratio, report.whole_grains_ratio]
  );

  let currentAngle = 0;

  return (
    <section className={`rounded-[28px] border bg-[#F3F4F2] p-4 shadow-sm ${tone.border}`}>
      <div className="rounded-[24px] border border-[#F0D77B] bg-[#FBFBF8] p-4">
        <div className="grid grid-cols-[11.5rem_minmax(0,1fr)] gap-3 border-b border-black/6 pb-4 sm:grid-cols-[12.5rem_minmax(0,1fr)]">
          <div className="rounded-[24px] bg-[#F3F4F2] p-4">
            <div className="grid grid-cols-[1fr_auto] items-start gap-3">
              <div>
                <p className="whitespace-nowrap text-[10px] font-black uppercase tracking-[0.18em] text-black/35">P / C / F</p>
                <p className="mt-1 whitespace-nowrap text-[12px] font-bold text-black/45">迷你饼图</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${tone.pill}`}>{alertLevel}</span>
            </div>
            <div className="mt-4 flex items-center justify-center">
              <svg viewBox="0 0 120 120" className="h-24 w-24 sm:h-28 sm:w-28">
                <circle cx="60" cy="60" r="34" fill="none" stroke="#E5E7EB" strokeWidth="10" />
                {segments.map((segment) => {
                  const startAngle = currentAngle;
                  const endAngle = currentAngle + (segment.value || 0) * 3.6;
                  currentAngle = endAngle;
                  if (!segment.value) return null;
                  return (
                    <path
                      key={segment.key}
                      d={describeArc(60, 60, 34, startAngle, endAngle)}
                      fill="none"
                      stroke={segment.color}
                      strokeWidth="10"
                      strokeLinecap="round"
                    />
                  );
                })}
              </svg>
            </div>
            <div className="mt-4 space-y-2">
              {segments.map((segment) => (
                <div key={segment.key} className="flex items-center justify-between text-[13px] font-bold text-black/70">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
                    {segment.label}
                  </span>
                  <span>{segment.value.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 overflow-hidden">
            <div className="grid grid-cols-3 gap-3 overflow-hidden">
            {metricItems.map((item) => (
              <div
                key={item.label}
                className={`flex min-h-[7.5rem] min-w-0 flex-col items-center justify-between overflow-hidden rounded-[26px] px-2 py-4 text-center ${item.toneClass}`}
              >
                <div className="space-y-1">
                  <p className="text-[20px] font-black leading-6 tracking-[0.01em] text-center">
                  {item.label === "蔬果均衡" ? "蔬果" : item.label === "全谷物比" ? "全谷物" : "优质"}
                  </p>
                  <p className="text-[20px] font-black leading-6 tracking-[0.01em] text-center opacity-80">
                  {item.label === "蔬果均衡" ? "均衡" : item.label === "全谷物比" ? "占比" : "蛋白"}
                  </p>
                </div>
                <p className="font-black leading-none tracking-tight text-[15px] sm:text-[18px]">
                  {item.value}%
                </p>
              </div>
            ))}
            </div>

            <div className="mt-5 rounded-[24px] bg-white px-4 py-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-[20px] font-black text-black/70">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="min-w-[4.5rem]">GI 预估</span>
                </span>
                <span className="shrink-0 text-right">
                  {report.gi_level === "high" ? "高" : report.gi_level === "low" ? "低" : "中等"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-[20px] font-black text-black/70">
                <span className="flex min-w-0 items-center gap-2">
                  <AlertTriangle size={14} />
                  <span className="min-w-[4.5rem]">加工等级</span>
                </span>
                <span className="shrink-0 text-right">
                  {report.processing_level === "ultra_processed"
                    ? "较高"
                    : report.processing_level === "processed"
                      ? "中等"
                      : "较低"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-base font-black text-slate-900">
              <ShieldCheck size={16} className="text-emerald-600" />
              AI 营养分析
            </p>
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="inline-flex items-center gap-1 text-xs font-black text-black/45"
            >
              {expanded ? "收起" : "展开"}
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          <div className="mt-3 rounded-[20px] bg-white px-4 py-4">
            <p className="text-sm font-bold leading-7 text-slate-700">{report.summary || report.plate_comment}</p>
          </div>

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 space-y-4">
                  <div className="border-t border-black/6 pt-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-black/35">优点</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {strengths.map((item) => (
                        <span key={item} className="rounded-full bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-700">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-black/6 pt-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-black/35">缺点</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {weaknesses.map((item) => (
                        <span key={item} className="rounded-full bg-rose-100 px-3 py-2 text-xs font-bold text-rose-700">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-black/6 pt-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-black/35">营养建议</p>
                    <div className="mt-3 space-y-3">
                      {improvements.map((item) => (
                        <p key={item} className="text-sm font-bold leading-7 text-slate-700">
                          {item}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-black/6 pt-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-black/35">营养科普</p>
                    <p className="mt-3 text-sm font-bold leading-7 text-slate-700">{report.education_tip}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

