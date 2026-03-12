import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Camera, CheckSquare, ChevronDown, Dumbbell, Plus, Ruler, Square, Trash2, Weight } from "lucide-react";
import type { BodyMetric } from "../types";
import { SideBySideView } from "./SideBySideView";

interface BodyMetricsPageProps {
  metrics: BodyMetric[];
  isSaving: boolean;
  onCreate: (payload: {
    date: string;
    weight?: number | null;
    chest?: number | null;
    waist?: number | null;
    thigh?: number | null;
    photo_url?: string | null;
  }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

const today = new Date().toISOString().slice(0, 10);

export function BodyMetricsPage({ metrics, isSaving, onCreate, onDelete }: BodyMetricsPageProps) {
  const [showModal, setShowModal] = useState(false);
  const [previewMetric, setPreviewMetric] = useState<BodyMetric | null>(null);
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [draft, setDraft] = useState({
    date: today,
    weight: "",
    chest: "",
    waist: "",
    thigh: "",
    photo_url: "",
  });

  const latest = metrics[0] || null;
  const cards = useMemo(
    () => [
      { label: "体重", value: latest?.weight, unit: "kg", icon: <Weight size={16} /> },
      { label: "胸围", value: latest?.chest, unit: "cm", icon: <Ruler size={16} /> },
      { label: "腰围", value: latest?.waist, unit: "cm", icon: <Ruler size={16} /> },
      { label: "腿围", value: latest?.thigh, unit: "cm", icon: <Dumbbell size={16} /> },
    ],
    [latest]
  );

  const compareMetrics = useMemo(() => {
    const selected = metrics.filter((item) => compareIds.includes(item.id) && item.photoUrl);
    if (selected.length !== 2) return null;
    const ordered = [...selected].sort((a, b) => a.date.localeCompare(b.date));
    return [ordered[0], ordered[1]] as [BodyMetric, BodyMetric];
  }, [compareIds, metrics]);

  const toggleCompare = (item: BodyMetric) => {
    if (!item.photoUrl) return;
    setCompareIds((current) => {
      if (current.includes(item.id)) return current.filter((id) => id !== item.id);
      if (current.length >= 2) return [current[1], item.id];
      return [...current, item.id];
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="rounded-[40px] border border-black/5 bg-white p-6 shadow-[0_28px_80px_-44px_rgba(15,23,42,0.35)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.32em] text-black/35">Body Metrics</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">身体档案</h2>
            <p className="mt-2 text-sm font-bold text-slate-500">把体重和围度放进统一时间轴，才能看见稳定变化。</p>
          </div>
          <button type="button" onClick={() => setShowModal(true)} className="flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white">
            <Plus size={14} />
            添加
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {cards.map((card) => (
            <div key={card.label} className="rounded-[28px] bg-[#F8F9FA] p-5">
              <div className="flex items-center gap-2 text-black/40">
                {card.icon}
                <p className="text-[10px] font-black uppercase tracking-[0.22em]">{card.label}</p>
              </div>
              <p className="mt-4 text-3xl font-black tracking-tight text-slate-900">
                {card.value ?? "--"}
                <span className="ml-1 text-base text-black/35">{card.value != null ? card.unit : ""}</span>
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[32px] border border-black/5 bg-[#F6F9F7] p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-black/35">最新对比照</p>
              <div className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-black/45">
                已选 {compareIds.length} / 2
              </div>
            </div>
            {latest?.photoUrl ? (
              <button type="button" onClick={() => setPreviewMetric(latest)} className="mt-4 block w-full overflow-hidden rounded-[24px]">
                <img src={latest.photoUrl} alt="latest body metric" className="h-[280px] w-full object-cover" />
              </button>
            ) : (
              <div className="mt-4 flex h-[280px] items-center justify-center rounded-[24px] border border-dashed border-black/10 bg-white text-sm font-bold text-black/35">
                暂无对比照片
              </div>
            )}
            <p className="mt-4 text-xs font-bold text-black/40">勾选两条带照片的历史记录后，会自动弹出双栏对比视图。</p>
          </div>

          <div className="rounded-[32px] border border-black/5 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-black/35">历史时间轴</p>
              <p className="text-xs font-black text-black/35">{metrics.length} 条记录</p>
            </div>
            <div className="mt-4 space-y-3">
              {metrics.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-black/10 p-8 text-center text-sm font-bold text-black/35">
                  还没有身体档案记录，先录入第一条数据。
                </div>
              ) : (
                metrics.map((item) => {
                  const checked = compareIds.includes(item.id);
                  const selectable = Boolean(item.photoUrl);
                  return (
                    <div key={item.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[24px] border border-black/5 bg-[#F8F9FA] p-4">
                      <button
                        type="button"
                        disabled={!selectable}
                        onClick={() => toggleCompare(item)}
                        className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${
                          checked ? 'bg-emerald-500 text-white' : 'bg-white text-black/35'
                        } ${!selectable ? 'cursor-not-allowed opacity-35' : ''}`}
                        aria-label={`选择 ${item.date} 用于对比`}
                      >
                        {checked ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>
                      <button type="button" onClick={() => item.photoUrl && setPreviewMetric(item)} className="text-left">
                        <p className="text-sm font-black text-slate-900">{item.date}</p>
                        <p className="mt-1 text-xs font-bold text-black/45">
                          体重 {item.weight ?? "--"}kg · 胸围 {item.chest ?? "--"}cm · 腰围 {item.waist ?? "--"}cm · 腿围 {item.thigh ?? "--"}cm
                        </p>
                        <p className="mt-1 text-[10px] font-black text-black/25">{selectable ? '可加入双栏对比' : '无照片，无法对比'}</p>
                      </button>
                      <div className="flex items-center gap-2">
                        <div className="overflow-hidden rounded-2xl bg-white">
                          {item.photoUrl ? (
                            <img src={item.photoUrl} alt={item.date} className="h-16 w-16 object-cover" />
                          ) : (
                            <div className="flex h-16 w-16 items-center justify-center text-black/20">
                              <Camera size={18} />
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => onDelete(item.id)}
                          className="rounded-full bg-rose-100 p-2 text-rose-600 transition-all hover:bg-rose-200 disabled:opacity-50"
                          aria-label={`删除 ${item.date} 的身体档案`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="relative w-full max-w-md rounded-t-[40px] bg-white p-6 shadow-2xl sm:rounded-[40px]">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-2xl font-black">添加身体档案</h3>
                <button onClick={() => setShowModal(false)} className="rounded-full bg-black/5 p-2 text-black/45">
                  <ChevronDown size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <input type="date" value={draft.date} onChange={(e) => setDraft((current) => ({ ...current, date: e.target.value }))} className="w-full rounded-2xl bg-[#F8F9FA] px-4 py-4 font-bold" />
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" placeholder="体重 (kg)" value={draft.weight} onChange={(e) => setDraft((current) => ({ ...current, weight: e.target.value }))} className="w-full rounded-2xl bg-[#F8F9FA] px-4 py-4 font-bold" />
                  <input type="number" placeholder="胸围 (cm)" value={draft.chest} onChange={(e) => setDraft((current) => ({ ...current, chest: e.target.value }))} className="w-full rounded-2xl bg-[#F8F9FA] px-4 py-4 font-bold" />
                  <input type="number" placeholder="腰围 (cm)" value={draft.waist} onChange={(e) => setDraft((current) => ({ ...current, waist: e.target.value }))} className="w-full rounded-2xl bg-[#F8F9FA] px-4 py-4 font-bold" />
                  <input type="number" placeholder="腿围 (cm)" value={draft.thigh} onChange={(e) => setDraft((current) => ({ ...current, thigh: e.target.value }))} className="w-full rounded-2xl bg-[#F8F9FA] px-4 py-4 font-bold" />
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onloadend = () => setDraft((current) => ({ ...current, photo_url: String(reader.result || "") }));
                    reader.readAsDataURL(file);
                  }}
                  className="block w-full text-sm font-bold text-black/55"
                />
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={async () => {
                    await onCreate({
                      date: draft.date,
                      weight: draft.weight ? Number(draft.weight) : null,
                      chest: draft.chest ? Number(draft.chest) : null,
                      waist: draft.waist ? Number(draft.waist) : null,
                      thigh: draft.thigh ? Number(draft.thigh) : null,
                      photo_url: draft.photo_url || null,
                    });
                    setDraft({ date: today, weight: "", chest: "", waist: "", thigh: "", photo_url: "" });
                    setShowModal(false);
                  }}
                  className="w-full rounded-[22px] bg-slate-950 py-4 text-sm font-black text-white disabled:opacity-50"
                >
                  {isSaving ? "保存中..." : "保存档案"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {previewMetric?.photoUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPreviewMetric(null)} className="absolute inset-0 bg-black/70 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} className="relative max-w-3xl overflow-hidden rounded-[32px] bg-white shadow-2xl">
              <img src={previewMetric.photoUrl} alt={previewMetric.date} className="max-h-[80vh] w-full object-cover" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {compareMetrics && <SideBySideView metrics={compareMetrics} onClose={() => setCompareIds([])} />}
    </motion.div>
  );
}
