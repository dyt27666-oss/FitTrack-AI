import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Activity,
  Archive,
  Book,
  Brain,
  Bike,
  Camera,
  Check,
  CheckCircle2,
  CircleX,
  Code,
  Coffee,
  CupSoda,
  Droplets,
  Flame,
  Heart,
  Moon,
  MoreHorizontal,
  Pencil,
  Plus,
  Smile,
  Sparkles,
  Sun,
  Target,
  Utensils,
} from "lucide-react";
import type { Habit, HabitHeatmapCell, HabitHistorySeries, HabitTodayItem } from "../types";
import { HabitHeatmap } from "../components/HabitHeatmap";
import { HabitTrendCurve } from "../components/HabitTrendCurve";

interface SelfDisciplinePageProps {
  date: string;
  habits: HabitTodayItem[];
  habitCatalog: Habit[];
  heatmap: HabitHeatmapCell[];
  habitHistory: Record<number, HabitHistorySeries>;
  isLoading?: boolean;
  onCheckIn: (habitId: number, status: "done" | "missed") => Promise<void>;
  onCreateHabit: (payload: {
    name: string;
    icon?: string;
    color?: string;
    frequencyType?: "daily" | "weekly";
    frequencyValue?: number;
    targetValue?: number;
    unit?: string;
  }) => Promise<void>;
  onUpdateHabit: (
    habitId: number,
    payload: {
      name: string;
      icon?: string;
      color?: string;
      frequencyType?: "daily" | "weekly";
      frequencyValue?: number;
      targetValue?: number;
      unit?: string;
    }
  ) => Promise<void>;
  onArchiveHabit: (habitId: number) => Promise<void>;
  onLoadHabitHistory: (habitId: number) => Promise<void>;
}

const DEFAULT_DRAFT = {
  name: "",
  icon: "target",
  color: "#16a34a",
  frequencyType: "daily" as const,
  frequencyValue: 1,
  targetValue: 1,
  unit: "次",
};

const ICON_OPTIONS = [
  { key: "check", Icon: Check, label: "完成" },
  { key: "flame", Icon: Flame, label: "燃烧" },
  { key: "book", Icon: Book, label: "阅读" },
  { key: "cup", Icon: CupSoda, label: "饮品" },
  { key: "bike", Icon: Bike, label: "骑行" },
  { key: "heart", Icon: Heart, label: "健康" },
  { key: "brain", Icon: Brain, label: "专注" },
  { key: "moon", Icon: Moon, label: "睡眠" },
  { key: "sun", Icon: Sun, label: "早起" },
  { key: "camera", Icon: Camera, label: "记录" },
  { key: "code", Icon: Code, label: "编码" },
  { key: "coffee", Icon: Coffee, label: "咖啡" },
  { key: "utensils", Icon: Utensils, label: "饮食" },
  { key: "smile", Icon: Smile, label: "情绪" },
  { key: "pencil", Icon: Pencil, label: "写作" },
  { key: "target", Icon: Target, label: "目标" },
] as const;

const ICON_MAP = Object.fromEntries(ICON_OPTIONS.map((item) => [item.key, item.Icon])) as Record<string, typeof Activity>;

export function SelfDisciplinePage({
  date,
  habits,
  habitCatalog,
  heatmap,
  habitHistory,
  isLoading = false,
  onCheckIn,
  onCreateHabit,
  onUpdateHabit,
  onArchiveHabit,
  onLoadHabitHistory,
}: SelfDisciplinePageProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [expandedHabitId, setExpandedHabitId] = useState<number | null>(null);
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [celebratingHabitId, setCelebratingHabitId] = useState<number | null>(null);

  const completed = habits.filter((item) => item.status === "done").length;
  const missed = habits.filter((item) => item.status === "missed").length;
  const rate = habits.length ? Math.round((completed / habits.length) * 100) : 0;
  const selectedWeek = useMemo(() => heatmap.slice(-7), [heatmap]);
  const habitMap = useMemo(() => new Map(habitCatalog.map((habit) => [habit.id, habit])), [habitCatalog]);

  const openCreateModal = () => {
    setEditingHabit(null);
    setDraft(DEFAULT_DRAFT);
    setShowModal(true);
  };

  const openEditModal = (habit: Habit) => {
    setEditingHabit(habit);
    setDraft({
      name: habit.name,
      icon: habit.icon,
      color: habit.color,
      frequencyType: habit.frequencyType,
      frequencyValue: habit.frequencyValue,
      targetValue: habit.targetValue,
      unit: habit.unit,
    });
    setShowModal(true);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="rounded-[40px] border border-black/5 bg-white p-6 shadow-[0_28px_80px_-44px_rgba(15,23,42,0.35)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.32em] text-black/35">Self Discipline</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">自律模块</h2>
            <p className="mt-2 text-sm font-bold text-slate-500">把习惯完成率做成可视反馈，才能真正看到长期执行的趋势。</p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white"
          >
            <Plus size={14} />
            新增目标
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[28px] bg-emerald-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700/60">已完成</p>
            <p className="mt-3 text-3xl font-black text-emerald-700">{completed}</p>
          </div>
          <div className="rounded-[28px] bg-rose-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-700/60">已放弃</p>
            <p className="mt-3 text-3xl font-black text-rose-700">{missed}</p>
          </div>
          <div className="rounded-[28px] bg-slate-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-700/60">今日达成率</p>
            <p className="mt-3 text-3xl font-black text-slate-900">{rate}%</p>
            <p className="mt-1 text-xs font-bold text-black/40">{date}</p>
          </div>
        </div>
      </div>

      <div className="rounded-[36px] border border-black/5 bg-white p-6 shadow-[0_22px_64px_-48px_rgba(15,23,42,0.4)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-black/35">Today List</p>
            <h3 className="mt-2 text-2xl font-black text-slate-900">今日任务列表</h3>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-[#F8F9FA] px-4 py-2 text-xs font-black text-black/45">
            <Sparkles size={14} />
            点击习惯卡片可展开趋势图
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {habits.map((habit) => {
            const meta = habitMap.get(habit.habitId);
            const isExpanded = expandedHabitId === habit.habitId;
            const historySeries = habitHistory[habit.habitId] || { points: [], max_streak: 0 };
            const HabitIcon = ICON_MAP[habit.icon] || Activity;

            return (
              <motion.div
                key={habit.habitId}
                animate={celebratingHabitId === habit.habitId ? { scale: [1, 1.03, 1] } : { scale: 1 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="relative rounded-[24px] border border-black/5 bg-[#F8F9FA] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      if (expandedHabitId === habit.habitId) {
                        setExpandedHabitId(null);
                        return;
                      }
                      await onLoadHabitHistory(habit.habitId);
                      setExpandedHabitId(habit.habitId);
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
                        style={{ backgroundColor: habit.color || "#16a34a" }}
                      >
                        <HabitIcon size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900">{habit.name}</p>
                        <p className="mt-1 text-xs font-bold text-black/40">
                          目标 {habit.targetValue} {habit.unit} · 当前状态 {habit.status}
                        </p>
                        <p className="mt-1 text-[11px] font-black text-emerald-700/80">连续打卡 {habit.current_streak || 0} 天</p>
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={async () => {
                        await onCheckIn(habit.habitId, "done");
                        setCelebratingHabitId(habit.habitId);
                        window.setTimeout(() => {
                          setCelebratingHabitId((current) => (current === habit.habitId ? null : current));
                        }, 550);
                      }}
                      className={`rounded-full p-2 transition-all ${habit.status === "done" ? "bg-emerald-500 text-white" : "bg-white text-emerald-600"}`}
                      aria-label={`完成 ${habit.name}`}
                    >
                      <CheckCircle2 size={18} />
                    </button>
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => onCheckIn(habit.habitId, "missed")}
                      className={`rounded-full p-2 transition-all ${habit.status === "missed" ? "bg-rose-500 text-white" : "bg-white text-rose-600"}`}
                      aria-label={`放弃 ${habit.name}`}
                    >
                      <CircleX size={18} />
                    </button>
                    {meta && (
                      <details className="relative">
                        <summary className="list-none cursor-pointer rounded-full bg-white p-2 text-black/45">
                          <MoreHorizontal size={18} />
                        </summary>
                        <div className="absolute right-0 top-12 z-10 w-36 rounded-2xl border border-black/5 bg-white p-2 shadow-xl">
                          <button
                            type="button"
                            onClick={() => openEditModal(meta)}
                            className="block w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-[#F8F9FA]"
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            onClick={() => onArchiveHabit(meta.id)}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold text-rose-600 hover:bg-rose-50"
                          >
                            <Archive size={14} />
                            归档
                          </button>
                        </div>
                      </details>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 border-t border-black/5 pt-4">
                        <div className="mb-3 flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-black/35">历史概览</p>
                          <p className="text-sm font-black text-emerald-700">
                            最长连胜 {historySeries.max_streak} 天
                          </p>
                        </div>
                        <HabitTrendCurve points={historySeries.points} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {celebratingHabitId === habit.habitId && (
                    <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center gap-2">
                      {[0, 1, 2, 3, 4].map((index) => (
                        <motion.span
                          key={index}
                          initial={{ opacity: 0, y: 0, scale: 0.4 }}
                          animate={{ opacity: [0, 1, 0], y: -18 - index * 3, scale: [0.4, 1, 0.7] }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.55, delay: index * 0.03 }}
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: habit.color || "#16a34a" }}
                        />
                      ))}
                    </div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
          {habits.length === 0 && (
            <div className="rounded-[24px] border border-dashed border-black/10 p-8 text-center text-sm font-bold text-black/35">
              还没有任何自律目标。先点击右上角“新增目标”建立第一条习惯。
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[36px] border border-black/5 bg-white p-6 shadow-[0_22px_64px_-48px_rgba(15,23,42,0.4)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-black/35">Heatmap</p>
            <h3 className="mt-2 text-2xl font-black text-slate-900">时间热力图</h3>
          </div>
          <div className="text-right text-xs font-bold text-black/40">
            <p>最近 7 天平均 {selectedWeek.length ? Math.round((selectedWeek.reduce((sum, cell) => sum + cell.rate, 0) / selectedWeek.length) * 100) : 0}%</p>
            <p>最近 {heatmap.length} 天追踪</p>
          </div>
        </div>

        <div className="mt-5">
          <HabitHeatmap data={heatmap} />
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-md rounded-t-[40px] bg-white p-6 shadow-2xl sm:rounded-[40px]"
            >
              <h3 className="text-2xl font-black">{editingHabit ? "编辑目标" : "新增目标"}</h3>
              <div className="mt-5 space-y-4">
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))}
                  placeholder="目标名称"
                  className="w-full rounded-2xl bg-[#F8F9FA] px-4 py-4 font-bold"
                />

                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/35">图标</p>
                  <div className="grid grid-cols-4 gap-3">
                    {ICON_OPTIONS.map(({ key, Icon, label }) => {
                      const selected = draft.icon === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setDraft((current) => ({ ...current, icon: key }))}
                          className={`flex flex-col items-center justify-center rounded-2xl border px-2 py-3 text-center transition-all ${
                            selected ? "border-slate-950 bg-slate-950 text-white" : "border-black/5 bg-[#F8F9FA] text-black/55"
                          }`}
                          title={label}
                        >
                          <Icon size={18} />
                          <span className="mt-2 text-[10px] font-black">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={draft.color}
                    onChange={(e) => setDraft((current) => ({ ...current, color: e.target.value }))}
                    placeholder="#16a34a"
                    className="w-full rounded-2xl bg-[#F8F9FA] px-4 py-4 font-bold"
                  />
                  <input
                    type="number"
                    value={draft.frequencyValue}
                    onChange={(e) => setDraft((current) => ({ ...current, frequencyValue: Number(e.target.value || 1) }))}
                    placeholder="频次"
                    className="w-full rounded-2xl bg-[#F8F9FA] px-4 py-4 font-bold"
                  />
                  <input
                    type="number"
                    value={draft.targetValue}
                    onChange={(e) => setDraft((current) => ({ ...current, targetValue: Number(e.target.value || 1) }))}
                    placeholder="目标值"
                    className="w-full rounded-2xl bg-[#F8F9FA] px-4 py-4 font-bold"
                  />
                  <input
                    value={draft.unit}
                    onChange={(e) => setDraft((current) => ({ ...current, unit: e.target.value }))}
                    placeholder="单位"
                    className="w-full rounded-2xl bg-[#F8F9FA] px-4 py-4 font-bold"
                  />
                </div>

                <button
                  type="button"
                  disabled={!draft.name.trim() || isLoading}
                  onClick={async () => {
                    const payload = {
                      name: draft.name.trim(),
                      icon: draft.icon,
                      color: draft.color,
                      frequencyType: draft.frequencyType,
                      frequencyValue: draft.frequencyValue,
                      targetValue: draft.targetValue,
                      unit: draft.unit,
                    };
                    if (editingHabit) {
                      await onUpdateHabit(editingHabit.id, payload);
                    } else {
                      await onCreateHabit(payload);
                    }
                    setShowModal(false);
                    setEditingHabit(null);
                    setDraft(DEFAULT_DRAFT);
                  }}
                  className="w-full rounded-[22px] bg-slate-950 py-4 text-sm font-black text-white disabled:opacity-50"
                >
                  {editingHabit ? "保存修改" : "创建目标"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
