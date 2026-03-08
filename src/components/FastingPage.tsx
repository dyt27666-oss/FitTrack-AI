import React, { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Flame, Hourglass, MoonStar, PartyPopper, Play, Square } from "lucide-react";

export interface FastingStatusView {
  active: boolean;
  currentLog: {
    id: number;
    planType: string;
    startTime: string;
    targetEndTime: string;
    status: "fasting" | "completed" | "failed";
  } | null;
  elapsedMinutes: number;
  remainingMinutes: number;
  progressPercent: number;
  phase: string;
  status: "idle" | "fasting" | "completed" | "failed";
}

interface FastingPageProps {
  fastingStatus: FastingStatusView | null;
  selectedPlan: string;
  isSubmitting: boolean;
  onSelectPlan: (plan: string) => void;
  onStart: () => Promise<void>;
  onEnd: () => Promise<void>;
  onRefresh: () => Promise<void>;
}

const PLAN_OPTIONS = ["14-10", "16-8", "18-6"];

function formatDurationFromSeconds(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`;
}

export function FastingPage({
  fastingStatus,
  selectedPlan,
  isSubmitting,
  onSelectPlan,
  onStart,
  onEnd,
  onRefresh,
}: FastingPageProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!fastingStatus?.active || !fastingStatus.currentLog) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [fastingStatus?.active, fastingStatus?.currentLog?.id]);

  const liveMetrics = useMemo(() => {
    if (!fastingStatus) {
      return { elapsedSeconds: 0, remainingSeconds: 0, progressPercent: 0 };
    }

    if (!fastingStatus.active || !fastingStatus.currentLog) {
      return {
        elapsedSeconds: fastingStatus.elapsedMinutes * 60,
        remainingSeconds: fastingStatus.remainingMinutes * 60,
        progressPercent: fastingStatus.progressPercent,
      };
    }

    const startMs = new Date(fastingStatus.currentLog.startTime).getTime();
    const targetMs = new Date(fastingStatus.currentLog.targetEndTime).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((now - startMs) / 1000));
    const remainingSeconds = Math.max(0, Math.ceil((targetMs - now) / 1000));
    const totalSeconds = Math.max(1, Math.floor((targetMs - startMs) / 1000));
    const progressPercent = Math.min(100, Number(((elapsedSeconds / totalSeconds) * 100).toFixed(1)));
    return { elapsedSeconds, remainingSeconds, progressPercent };
  }, [fastingStatus, now]);

  const progress = liveMetrics.progressPercent;
  const elapsed = formatDurationFromSeconds(liveMetrics.elapsedSeconds);
  const remaining = formatDurationFromSeconds(liveMetrics.remainingSeconds);
  const radius = 108;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress / 100);
  const isCompleted = fastingStatus?.status === "completed";

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="relative overflow-hidden rounded-[40px] border border-emerald-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(236,253,245,0.95),_rgba(236,253,245,0.72)_35%,_rgba(17,24,39,0.06)_100%)] p-6 shadow-[0_28px_80px_-36px_rgba(16,185,129,0.55)]">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(16,185,129,0.14),transparent_30%,rgba(15,23,42,0.08)_100%)]" />
        <div className="relative z-10 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.32em] text-emerald-700/70">Intermittent Fasting</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">轻断食控制台</h2>
              <p className="mt-2 max-w-sm text-sm font-bold text-slate-600">
                环形进度、阶段判断和秒级计时合在一起，打开页面就能看到自己是否真正进入节律。
              </p>
            </div>
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-full border border-white/70 bg-white/80 px-4 py-2 text-xs font-black text-slate-700 shadow-sm backdrop-blur"
            >
              刷新状态
            </button>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[32px] bg-slate-950 px-6 py-8 text-white shadow-[0_24px_60px_-28px_rgba(15,23,42,0.9)]">
              <div className="mx-auto flex max-w-[320px] flex-col items-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="relative flex h-[280px] w-[280px] items-center justify-center"
                >
                  <div className={`absolute inset-0 rounded-full blur-2xl ${isCompleted ? "bg-[radial-gradient(circle,_rgba(250,204,21,0.24),transparent_62%)]" : "bg-[radial-gradient(circle,_rgba(16,185,129,0.18),transparent_62%)]"}`} />
                  <svg viewBox="0 0 260 260" className="h-full w-full -rotate-90">
                    <circle cx="130" cy="130" r={radius} stroke="rgba(148,163,184,0.18)" strokeWidth="16" fill="none" />
                    <motion.circle
                      cx="130"
                      cy="130"
                      r={radius}
                      stroke="url(#fasting-gradient)"
                      strokeWidth="16"
                      strokeLinecap="round"
                      fill="none"
                      strokeDasharray={circumference}
                      animate={{ strokeDashoffset: offset }}
                      transition={{ duration: 0.65, ease: "easeOut" }}
                    />
                    <defs>
                      <linearGradient id="fasting-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={isCompleted ? "#facc15" : "#34d399"} />
                        <stop offset="60%" stopColor={isCompleted ? "#fb923c" : "#22c55e"} />
                        <stop offset="100%" stopColor={isCompleted ? "#f43f5e" : "#facc15"} />
                      </linearGradient>
                    </defs>
                  </svg>

                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-200/70">已断食时长</p>
                    <p className="mt-3 text-4xl font-black tracking-tight">{elapsed}</p>
                    <p className="mt-4 rounded-full bg-white/10 px-4 py-2 text-sm font-black text-emerald-200">
                      {fastingStatus?.phase || "未开始"}
                    </p>
                    {isCompleted && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 flex items-center gap-2 rounded-full bg-amber-300/15 px-4 py-2 text-sm font-black text-amber-200"
                      >
                        <PartyPopper size={16} />
                        已完成本轮断食
                      </motion.div>
                    )}
                  </div>
                </motion.div>

                <div className="mt-4 grid w-full grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-white/6 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">计划</p>
                    <p className="mt-1 text-lg font-black">{fastingStatus?.currentLog?.planType || selectedPlan}</p>
                  </div>
                  <div className="rounded-2xl bg-white/6 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">剩余</p>
                    <p className="mt-1 text-sm font-black">{remaining}</p>
                  </div>
                  <div className="rounded-2xl bg-white/6 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">进度</p>
                    <p className="mt-1 text-lg font-black">{progress.toFixed(0)}%</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[28px] border border-black/5 bg-white/85 p-5 shadow-lg shadow-black/5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <MoonStar size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-black/35">当前生理阶段</p>
                    <p className="text-lg font-black text-slate-900">{fastingStatus?.phase || "未开始"}</p>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl bg-[#F8F9FA] p-4">
                  <div className="flex items-center justify-between text-sm font-bold">
                    <span className="text-black/45">状态</span>
                    <span className={`rounded-full px-3 py-1 ${
                      fastingStatus?.status === "fasting"
                        ? "bg-emerald-100 text-emerald-700"
                        : fastingStatus?.status === "completed"
                          ? "bg-amber-100 text-amber-700"
                          : fastingStatus?.status === "failed"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-slate-100 text-slate-600"
                    }`}>
                      {fastingStatus?.status === "fasting"
                        ? "进行中"
                        : fastingStatus?.status === "completed"
                          ? "已完成"
                          : fastingStatus?.status === "failed"
                            ? "未达标"
                            : "待开始"}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm font-bold">
                    <span className="text-black/45">断食窗口</span>
                    <span>{fastingStatus?.currentLog?.startTime ? new Date(fastingStatus.currentLog.startTime).toLocaleString() : "--"}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm font-bold">
                    <span className="text-black/45">目标结束</span>
                    <span>{fastingStatus?.currentLog?.targetEndTime ? new Date(fastingStatus.currentLog.targetEndTime).toLocaleString() : "--"}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-black/5 bg-white/85 p-5 shadow-lg shadow-black/5">
                <p className="text-[10px] font-black uppercase tracking-[0.26em] text-black/35">方案选择</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {PLAN_OPTIONS.map((plan) => (
                    <button
                      key={plan}
                      type="button"
                      onClick={() => onSelectPlan(plan)}
                      className={`rounded-full px-4 py-2 text-sm font-black transition-all ${
                        selectedPlan === plan ? "bg-slate-950 text-white shadow-lg" : "bg-[#F5F7F4] text-black/55"
                      }`}
                    >
                      {plan}
                    </button>
                  ))}
                </div>

                <div className="mt-5 grid gap-3">
                  <button
                    type="button"
                    onClick={onStart}
                    disabled={isSubmitting || Boolean(fastingStatus?.active)}
                    className="flex items-center justify-center gap-2 rounded-[22px] bg-gradient-to-r from-emerald-500 to-lime-500 px-5 py-4 text-sm font-black text-white shadow-[0_20px_45px_-22px_rgba(34,197,94,0.75)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Play size={16} />
                    开始断食
                  </button>
                  <button
                    type="button"
                    onClick={onEnd}
                    disabled={isSubmitting || !fastingStatus?.active}
                    className="flex items-center justify-center gap-2 rounded-[22px] border border-slate-200 bg-white px-5 py-4 text-sm font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Square size={15} />
                    提前结束
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-[24px] bg-white/85 p-5 shadow-lg shadow-black/5">
                  <div className="flex items-center gap-2 text-black/40">
                    <Hourglass size={16} />
                    <p className="text-[10px] font-black uppercase tracking-[0.22em]">剩余时间</p>
                  </div>
                  <p className="mt-3 text-lg font-black">{remaining}</p>
                </div>
                <div className="rounded-[24px] bg-white/85 p-5 shadow-lg shadow-black/5">
                  <div className="flex items-center gap-2 text-black/40">
                    <Flame size={16} />
                    <p className="text-[10px] font-black uppercase tracking-[0.22em]">燃脂进度</p>
                  </div>
                  <p className="mt-3 text-2xl font-black">{progress.toFixed(0)}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
