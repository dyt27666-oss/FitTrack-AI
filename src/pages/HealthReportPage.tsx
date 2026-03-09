import React, { useMemo, useRef, useState } from "react";
import { Brain, ChevronLeft, Clipboard, Clock3, Printer, ShieldAlert, Sparkles } from "lucide-react";
import type { DailyHealthInsightReport, WeeklyHealthReport } from "../types";

interface HealthReportPageProps {
  mode: "daily" | "weekly";
  dailyReport: DailyHealthInsightReport | null;
  weeklyReport: WeeklyHealthReport | null;
  isLoading: boolean;
  onRefresh: (mode: "daily" | "weekly") => Promise<void>;
  onBack: () => void;
}

const sectionTitleClass = "text-[11px] font-black uppercase tracking-[0.24em] text-emerald-600 report-text-safe";

const toneClass = (label: string) => {
  if (label.includes("加速") || label.includes("稳态")) return "bg-emerald-100 text-emerald-700";
  if (label.includes("失衡") || label.includes("高危")) return "bg-rose-100 text-rose-700";
  return "bg-amber-100 text-amber-700";
};

async function waitForImages(container: HTMLElement | null) {
  if (!container) return;
  const images = Array.from(container.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        })
    )
  );
}

function buildDailyMarkdown(report: DailyHealthInsightReport) {
  return [
    "# 今日健康洞察 🩺",
    `**状态标签：** ${report.status_tag}`,
    "",
    `> ${report.summary}`,
    "",
    "## 综合评估",
    report.sections.overview,
    "",
    "## 热量分析 🔥",
    `- 摄入热量：\`${report.metrics.calories_in.toFixed(1)} kcal\``,
    `- 支出热量：\`${report.metrics.calories_out.toFixed(1)} kcal\``,
    `- 净摄入：\`${report.metrics.net_calories.toFixed(1)} kcal\``,
    report.sections.energy,
    "",
    "## 饮食分析 🍽️",
    report.sections.diet,
    "",
    "## 营养分析 🧪",
    `- 蛋白质：\`${report.metrics.protein_g.toFixed(1)} g\``,
    `- 碳水：\`${report.metrics.carbs_g.toFixed(1)} g\``,
    `- 脂肪：\`${report.metrics.fats_g.toFixed(1)} g\``,
    report.sections.nutrition,
    "",
    "## 运动分析 🏃",
    report.sections.activity,
    "",
    "## 自律分析 ✅",
    `- 完成率：\`${Math.round(report.metrics.habit_completion_rate * 100)}%\``,
    `- 已完成 / 总数：\`${report.metrics.completed_habits} / ${report.metrics.total_habits}\``,
    report.sections.discipline,
    "",
    "## 健康风险提示 ⚠️",
    report.sections.risks,
    "",
    "## 个性化建议 ✨",
    ...report.sections.next_actions.map((item) => `- ${item}`),
  ].join("\n");
}

function buildWeeklyMarkdown(report: WeeklyHealthReport) {
  return [
    "# 本周健康周报 📘",
    `**状态标签：** ${report.status_tag}`,
    `**周期：** ${report.week_range}`,
    "",
    `> ${report.summary}`,
    "",
    "## 本周综合评估",
    report.sections.overview,
    "",
    "## 趋势总结 📈",
    report.sections.diet_trend,
    "",
    "## 行为风险预警 🚨",
    report.sections.high_risk_window,
    "",
    "## 自律分析 ✅",
    report.sections.discipline_trend,
    "",
    "## 下周预测 🔭",
    report.sections.forecast,
    "",
    "## 下周建议 ✨",
    ...report.sections.next_week_actions.map((item) => `- ${item}`),
    "",
    "## 核心指标",
    `- 平均摄入：\`${report.metrics.avg_calories_in.toFixed(1)} kcal\``,
    `- 平均支出：\`${report.metrics.avg_calories_out.toFixed(1)} kcal\``,
    `- 平均净摄入：\`${report.metrics.avg_net_calories.toFixed(1)} kcal\``,
    `- 平均完成率：\`${Math.round(report.metrics.avg_habit_completion_rate * 100)}%\``,
  ].join("\n");
}

function ActionToolbar({
  onCopy,
  onPrint,
  isPrinting,
}: {
  onCopy: () => Promise<void>;
  onPrint: () => Promise<void>;
  isPrinting: boolean;
}) {
  return (
    <div className="report-print-hidden flex items-center gap-2">
      <button
        type="button"
        onClick={() => void onCopy()}
        className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
      >
        <Clipboard size={15} />
        复制 Markdown
      </button>
      <button
        type="button"
        onClick={() => void onPrint()}
        disabled={isPrinting}
        className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-black text-white transition disabled:opacity-50"
      >
        <Printer size={15} />
        {isPrinting ? "准备导出..." : "导出 PDF"}
      </button>
    </div>
  );
}

export function HealthReportPage({ mode, dailyReport, weeklyReport, isLoading, onRefresh, onBack }: HealthReportPageProps) {
  const report = mode === "daily" ? dailyReport : weeklyReport;
  const title = mode === "daily" ? "今日健康洞察" : "本周健康周报";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const markdown = useMemo(() => {
    if (!report) return "";
    return mode === "daily" ? buildDailyMarkdown(report as DailyHealthInsightReport) : buildWeeklyMarkdown(report as WeeklyHealthReport);
  }, [mode, report]);

  const handleCopy = async () => {
    if (!markdown) return;
    await navigator.clipboard.writeText(markdown);
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    await waitForImages(containerRef.current);
    window.print();
    setIsPrinting(false);
  };

  return (
    <div ref={containerRef} className="report-print-root space-y-5">
      <div className="report-print-hidden flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-black/70 shadow-sm"
        >
          <ChevronLeft size={16} />
          返回首页
        </button>
        <div className="flex items-center gap-2">
          <ActionToolbar onCopy={handleCopy} onPrint={handlePrint} isPrinting={isPrinting} />
          <button
            type="button"
            onClick={() => void onRefresh(mode)}
            disabled={isLoading}
            className="rounded-full bg-[#5B35FF] px-4 py-2 text-sm font-black text-white shadow-[0_12px_30px_-18px_rgba(91,53,255,0.85)] disabled:opacity-50"
          >
            {isLoading ? "生成中..." : "重新生成"}
          </button>
        </div>
      </div>

      <section className="report-print-page overflow-hidden rounded-[32px] border border-black/5 bg-white shadow-[0_26px_60px_-36px_rgba(15,23,42,0.18)]">
        <div className="border-b border-black/5 bg-[linear-gradient(135deg,#6A42FF_0%,#7C5CFF_45%,#A95CFF_100%)] px-6 py-6 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/70 report-text-safe">
                {mode === "daily" ? "Daily Health Insight" : "Weekly Health Report"}
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight report-text-safe">{title}</h1>
              <p className="mt-3 max-w-xl text-sm font-bold leading-6 text-white/88 report-text-safe">
                {report?.summary || "系统正在整理你的饮食、运动和自律数据，并生成结构化健康报告。"}
              </p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
              {mode === "daily" ? <Clock3 size={24} /> : <Brain size={24} />}
            </div>
          </div>
          {report?.status_tag ? (
            <div className={`mt-5 inline-flex rounded-full px-3 py-1 text-xs font-black ${toneClass(report.status_tag)}`}>
              {report.status_tag}
            </div>
          ) : null}
        </div>

        {isLoading && !report ? (
          <div className="space-y-4 px-6 py-6">
            <div className="h-5 w-56 animate-pulse rounded-full bg-black/6" />
            <div className="h-24 animate-pulse rounded-3xl bg-black/5" />
            <div className="h-32 animate-pulse rounded-3xl bg-black/5" />
            <div className="h-32 animate-pulse rounded-3xl bg-black/5" />
          </div>
        ) : report ? (
          <div className="px-6 py-6">
            {mode === "daily" ? (
              <div className="space-y-0 report-text-safe">
                <section className="py-5 first:pt-0">
                  <p className={sectionTitleClass}>综合评估</p>
                  <p className="mt-3 text-sm leading-7 text-slate-700">{dailyReport?.sections.overview}</p>
                </section>

                <section className="border-t border-gray-100 py-5">
                  <p className={sectionTitleClass}>热量分析</p>
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-[1fr_auto] gap-4 rounded-2xl bg-[#F8FAF8] px-4 py-3 font-mono text-sm font-semibold text-slate-700">
                      <span>摄入热量</span>
                      <span>{dailyReport?.metrics.calories_in.toFixed(1)} kcal</span>
                    </div>
                    <div className="grid grid-cols-[1fr_auto] gap-4 rounded-2xl bg-[#F8FAF8] px-4 py-3 font-mono text-sm font-semibold text-slate-700">
                      <span>支出热量</span>
                      <span>{dailyReport?.metrics.calories_out.toFixed(1)} kcal</span>
                    </div>
                    <div className="grid grid-cols-[1fr_auto] gap-4 rounded-2xl bg-[#EFF6EF] px-4 py-3 font-mono text-sm font-black text-slate-800">
                      <span>净摄入</span>
                      <span>{dailyReport?.metrics.net_calories.toFixed(1)} kcal</span>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-700">{dailyReport?.sections.energy}</p>
                </section>

                <section className="border-t border-gray-100 py-5">
                  <p className={sectionTitleClass}>饮食分析</p>
                  <p className="mt-3 text-sm leading-7 text-slate-700">{dailyReport?.sections.diet}</p>
                </section>

                <section className="border-t border-gray-100 py-5">
                  <p className={sectionTitleClass}>营养分析</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-[#F8FAF8] px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/35">蛋白质</p>
                      <p className="mt-2 font-mono text-sm font-semibold text-slate-700">{dailyReport?.metrics.protein_g.toFixed(1)} g</p>
                    </div>
                    <div className="rounded-2xl bg-[#F8FAF8] px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/35">碳水</p>
                      <p className="mt-2 font-mono text-sm font-semibold text-slate-700">{dailyReport?.metrics.carbs_g.toFixed(1)} g</p>
                    </div>
                    <div className="rounded-2xl bg-[#F8FAF8] px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/35">脂肪</p>
                      <p className="mt-2 font-mono text-sm font-semibold text-slate-700">{dailyReport?.metrics.fats_g.toFixed(1)} g</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-700">{dailyReport?.sections.nutrition}</p>
                </section>

                <section className="border-t border-gray-100 py-5">
                  <p className={sectionTitleClass}>运动分析</p>
                  <p className="mt-3 text-sm leading-7 text-slate-700">{dailyReport?.sections.activity}</p>
                </section>

                <section className="border-t border-gray-100 py-5">
                  <p className={sectionTitleClass}>自律分析</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-[#F8FAF8] px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/35">今日完成率</p>
                      <p className="mt-2 font-mono text-sm font-semibold text-slate-700">{Math.round((dailyReport?.metrics.habit_completion_rate || 0) * 100)}%</p>
                    </div>
                    <div className="rounded-2xl bg-[#F8FAF8] px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/35">已完成 / 总数</p>
                      <p className="mt-2 font-mono text-sm font-semibold text-slate-700">{dailyReport?.metrics.completed_habits} / {dailyReport?.metrics.total_habits}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-700">{dailyReport?.sections.discipline}</p>
                </section>

                <section className="border-t border-gray-100 py-5">
                  <p className={sectionTitleClass}>健康风险提示</p>
                  <div className="mt-3 flex gap-3 rounded-2xl bg-amber-50 px-4 py-4">
                    <ShieldAlert className="mt-0.5 shrink-0 text-amber-600" size={18} />
                    <p className="text-sm leading-7 text-slate-700">{dailyReport?.sections.risks}</p>
                  </div>
                </section>

                <section className="border-t border-gray-100 py-5">
                  <p className={sectionTitleClass}>个性化建议</p>
                  <div className="mt-3 space-y-3">
                    {dailyReport?.sections.next_actions.map((item) => (
                      <div key={item} className="flex gap-3 rounded-2xl bg-emerald-50 px-4 py-3">
                        <Sparkles size={16} className="mt-1 shrink-0 text-emerald-600" />
                        <p className="text-sm leading-7 text-slate-700">{item}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            ) : (
              <div className="space-y-0 report-text-safe">
                <section className="py-5 first:pt-0">
                  <p className={sectionTitleClass}>本周综合评估</p>
                  <p className="mt-3 text-sm leading-7 text-slate-700">{weeklyReport?.sections.overview}</p>
                </section>

                <section className="border-t border-gray-100 py-5">
                  <p className={sectionTitleClass}>趋势总结</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-[#F8FAF8] px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/35">周范围</p>
                      <p className="mt-2 font-mono text-sm font-semibold text-slate-700">{weeklyReport?.week_range}</p>
                    </div>
                    <div className="rounded-2xl bg-[#F8FAF8] px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/35">平均完成率</p>
                      <p className="mt-2 font-mono text-sm font-semibold text-slate-700">{Math.round((weeklyReport?.metrics.avg_habit_completion_rate || 0) * 100)}%</p>
                    </div>
                    <div className="rounded-2xl bg-[#F8FAF8] px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/35">平均摄入</p>
                      <p className="mt-2 font-mono text-sm font-semibold text-slate-700">{weeklyReport?.metrics.avg_calories_in.toFixed(1)} kcal</p>
                    </div>
                    <div className="rounded-2xl bg-[#F8FAF8] px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/35">平均净值</p>
                      <p className="mt-2 font-mono text-sm font-semibold text-slate-700">{weeklyReport?.metrics.avg_net_calories.toFixed(1)} kcal</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-700">{weeklyReport?.sections.diet_trend}</p>
                </section>

                <section className="border-t border-gray-100 py-5">
                  <p className={sectionTitleClass}>行为风险预警</p>
                  <div className="mt-3 flex gap-3 rounded-2xl bg-amber-50 px-4 py-4">
                    <ShieldAlert className="mt-0.5 shrink-0 text-amber-600" size={18} />
                    <p className="text-sm leading-7 text-slate-700">{weeklyReport?.sections.high_risk_window}</p>
                  </div>
                </section>

                <section className="border-t border-gray-100 py-5">
                  <p className={sectionTitleClass}>自律分析</p>
                  <p className="mt-3 text-sm leading-7 text-slate-700">{weeklyReport?.sections.discipline_trend}</p>
                </section>

                <section className="border-t border-gray-100 py-5">
                  <p className={sectionTitleClass}>下周预测</p>
                  <p className="mt-3 text-sm leading-7 text-slate-700">{weeklyReport?.sections.forecast}</p>
                </section>

                <section className="border-t border-gray-100 py-5">
                  <p className={sectionTitleClass}>个性化建议</p>
                  <div className="mt-3 space-y-3">
                    {weeklyReport?.sections.next_week_actions.map((item) => (
                      <div key={item} className="flex gap-3 rounded-2xl bg-emerald-50 px-4 py-3">
                        <Sparkles size={16} className="mt-1 shrink-0 text-emerald-600" />
                        <p className="text-sm leading-7 text-slate-700">{item}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {weeklyReport?.metrics.max_streaks?.length ? (
                  <section className="border-t border-gray-100 py-5">
                    <p className={sectionTitleClass}>最长连胜</p>
                    <div className="mt-3 space-y-3">
                      {weeklyReport.metrics.max_streaks.slice(0, 5).map((item) => (
                        <div key={`${item.habit_id}-${item.name}`} className="grid grid-cols-[1fr_auto] gap-4 rounded-2xl bg-[#F8FAF8] px-4 py-3 font-mono text-sm font-semibold text-slate-700">
                          <span>{item.name}</span>
                          <span>{item.max_streak} 天</span>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            )}
          </div>
        ) : (
          <div className="px-6 py-10 text-sm font-bold text-slate-500">暂无可展示的分析内容，先补全记录后再生成。</div>
        )}
      </section>
    </div>
  );
}
