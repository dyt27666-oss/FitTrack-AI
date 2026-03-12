import React from "react";
import { AnimatePresence, motion } from "motion/react";
import type { BodyMetric } from "../types";
import { resolveAssetUrl } from "../utils/runtimeUrls";

interface SideBySideViewProps {
  metrics: [BodyMetric, BodyMetric];
  onClose: () => void;
}

function formatDelta(current?: number | null, previous?: number | null) {
  if (current == null || previous == null) return "--";
  const delta = Number((current - previous).toFixed(1));
  if (delta === 0) return "0.0kg";
  return `${delta > 0 ? "+" : ""}${delta.toFixed(1)}kg`;
}

export function SideBySideView({ metrics, onClose }: SideBySideViewProps) {
  const [left, right] = metrics;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/75 backdrop-blur-md"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          className="relative w-full max-w-6xl overflow-hidden rounded-[36px] bg-white shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-black/5 px-6 py-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-black/35">Side By Side</p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">身体照片双栏对比</h3>
            </div>
            <button type="button" onClick={onClose} className="rounded-full bg-black/5 px-4 py-2 text-xs font-black text-black/55">
              关闭
            </button>
          </div>

          <div className="grid gap-0 lg:grid-cols-2">
            {[left, right].map((item, index) => (
              <div key={item.id} className="border-b border-black/5 last:border-b-0 lg:border-b-0 lg:border-r last:lg:border-r-0 border-black/5">
                <div className="bg-[#F8F9FA] px-6 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-black/35">{index === 0 ? "较早记录" : "较新记录"}</p>
                  <div className="mt-2 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-lg font-black text-slate-950">{item.date}</p>
                      <p className="mt-1 text-xs font-bold text-black/45">
                        体重 {item.weight ?? "--"}kg · 腰围 {item.waist ?? "--"}cm · 胸围 {item.chest ?? "--"}cm
                      </p>
                    </div>
                    <div className="rounded-full bg-white px-3 py-1 text-xs font-black text-black/55">
                      对比差值 {index === 0 ? formatDelta(left.weight, right.weight) : formatDelta(right.weight, left.weight)}
                    </div>
                  </div>
                </div>
                <div className="bg-black">
                  {item.photoUrl ? (
                    <img src={resolveAssetUrl(item.photoUrl) || item.photoUrl || ""} alt={item.date} className="h-[60vh] w-full object-cover" />
                  ) : (
                    <div className="flex h-[60vh] items-center justify-center bg-[#F8F9FA] text-sm font-bold text-black/35">暂无照片</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
