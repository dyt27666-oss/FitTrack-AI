import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Activity, Camera, ChevronDown, ChevronUp, Sparkles, Utensils } from "lucide-react";
import type { Food, Profile, CustomUnit, BalancedDietAnalysisReport } from "../types";
import { FoodSearchSelect } from "./FoodSearchSelect";
import { NutritionInsightCard } from "./NutritionInsightCard";

interface MacroPreview {
  protein: number;
  carbs: number;
  fats: number;
}

interface LogFormProps {
  mode: "create" | "edit";
  type: "food" | "exercise" | null;
  profile: Profile | null;
  itemName: string;
  itemAmount: string;
  exerciseType: string;
  selectedFood: Food | null;
  selectedFoodId: number | null;
  selectedUnit: string;
  selectedUnitName: string | null;
  customUnits: CustomUnit[];
  estimatedCalories: number | null;
  estimatedMacros: MacroPreview | null;
  estimatedWeight: number | null;
  previewCalories: number | null;
  previewMacros: MacroPreview | null;
  previewMacroRatio?: { protein: number; carbs: number; fats: number } | null;
  previewWeight: number | null;
  confidenceHint: string | null;
  analysisReport?: BalancedDietAnalysisReport | null;
  healthScore?: number | null;
  alertLevel?: "green" | "yellow" | "red" | null;
  isEstimating: boolean;
  isImageAnalyzing: boolean;
  onClose: () => void;
  onOpenUnitModal: () => void;
  onItemNameChange: (value: string) => void;
  onItemAmountChange: (value: string) => void;
  onExerciseTypeChange: (value: string) => void;
  onSelectedUnitChange: (value: string) => void;
  onSelectedFoodChange: (food: Food) => void;
  onManualEstimateChange: (value: number) => void;
  onAddCustomFood: (payload: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  }) => Promise<void>;
  onSubmit: () => Promise<void>;
}

const EXERCISE_OPTIONS = ["跑步", "慢跑", "游泳", "骑行", "瑜伽", "力量训练", "台球", "爬坡", "爬楼梯", "篮球", "足球", "羽毛球", "跳绳"];

export function LogForm(props: LogFormProps) {
  const {
    mode,
    type,
    itemName,
    itemAmount,
    exerciseType,
    selectedFood,
    selectedFoodId,
    selectedUnit,
    customUnits,
    previewCalories,
    previewMacros,
    previewMacroRatio,
    previewWeight,
    confidenceHint,
    analysisReport,
    healthScore,
    alertLevel,
    isEstimating,
    isImageAnalyzing,
    onClose,
    onOpenUnitModal,
    onItemNameChange,
    onItemAmountChange,
    onExerciseTypeChange,
    onSelectedUnitChange,
    onSelectedFoodChange,
    onManualEstimateChange,
    onAddCustomFood,
    onSubmit,
  } = props;

  const [showCustomFood, setShowCustomFood] = useState(false);
  const [customFoodDraft, setCustomFoodDraft] = useState({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fats: "",
  });

  const amountNumber = Number(itemAmount || 0);
  const selectedUnitOption = useMemo(
    () => (selectedUnit === "g" ? { id: "g", name: "克", weight_g: 1 } : customUnits.find((u) => u.id.toString() === selectedUnit)),
    [customUnits, selectedUnit]
  );
  const sliderMin = selectedUnit === "g" ? 10 : 0.5;
  const sliderMax = selectedUnit === "g" ? 600 : 5;
  const sliderStep = selectedUnit === "g" ? 10 : 0.1;
  const isFood = type === "food";
  const canSubmit = !isEstimating && ((!isFood && Number(itemAmount) > 0) || (isFood && itemName.trim() && Number(itemAmount) > 0));

  if (!type) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[48px] bg-white p-8 shadow-2xl sm:rounded-[48px]">
        <div className="mb-8 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-2xl font-black">
            {isFood ? <Utensils className="text-emerald-600" /> : <Activity className="text-orange-600" />}
            {mode === "edit" ? "编辑记录" : `添加${isFood ? "饮食" : "运动"}`}
          </h3>
          <button onClick={onClose} className="rounded-full bg-black/5 p-2 text-black/40 transition-all hover:text-black">
            <ChevronDown size={20} />
          </button>
        </div>

        {isFood && (
          <div className="mb-6 space-y-4">
            <FoodSearchSelect
              selectedFood={selectedFood}
              onSelect={onSelectedFoodChange}
              placeholder="搜索食物数据库..."
              helperText="选中食物后，只会加载该 food_id 绑定的单位。"
            />

            <button type="button" onClick={() => setShowCustomFood((value) => !value)} className="flex items-center gap-1 text-xs font-bold text-black/40 hover:text-black">
              {showCustomFood ? "收起自定义食物" : "没有找到？手动添加自定义食物"}
              {showCustomFood ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {showCustomFood && (
              <div className="space-y-4 rounded-3xl border border-black/5 bg-[#F8F9FA] p-6">
                <input value={customFoodDraft.name} onChange={(e) => setCustomFoodDraft((current) => ({ ...current, name: e.target.value }))} placeholder="食物名称" className="w-full rounded-xl bg-white px-4 py-3 text-sm font-bold" />
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" value={customFoodDraft.calories} onChange={(e) => setCustomFoodDraft((current) => ({ ...current, calories: e.target.value }))} placeholder="热量 (kcal/100g)" className="w-full rounded-xl bg-white px-4 py-3 text-sm font-bold" />
                  <input type="number" value={customFoodDraft.protein} onChange={(e) => setCustomFoodDraft((current) => ({ ...current, protein: e.target.value }))} placeholder="蛋白质 (g)" className="w-full rounded-xl bg-white px-4 py-3 text-sm font-bold" />
                  <input type="number" value={customFoodDraft.carbs} onChange={(e) => setCustomFoodDraft((current) => ({ ...current, carbs: e.target.value }))} placeholder="碳水 (g)" className="w-full rounded-xl bg-white px-4 py-3 text-sm font-bold" />
                  <input type="number" value={customFoodDraft.fats} onChange={(e) => setCustomFoodDraft((current) => ({ ...current, fats: e.target.value }))} placeholder="脂肪 (g)" className="w-full rounded-xl bg-white px-4 py-3 text-sm font-bold" />
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const name = customFoodDraft.name.trim();
                    const calories = Number(customFoodDraft.calories);
                    if (!name || !Number.isFinite(calories)) return;
                    await onAddCustomFood({
                      name,
                      calories,
                      protein: Number(customFoodDraft.protein || 0),
                      carbs: Number(customFoodDraft.carbs || 0),
                      fats: Number(customFoodDraft.fats || 0),
                    });
                    setCustomFoodDraft({ name: "", calories: "", protein: "", carbs: "", fats: "" });
                    setShowCustomFood(false);
                  }}
                  className="w-full rounded-xl bg-black py-3 text-sm font-bold text-white"
                >
                  保存并填入表单
                </button>
              </div>
            )}
          </div>
        )}

        <div className="space-y-6">
          {type === "exercise" ? (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-black/30">运动类型</label>
              <select value={exerciseType} onChange={(e) => onExerciseTypeChange(e.target.value)} className="w-full appearance-none rounded-2xl bg-[#F8F9FA] px-4 py-4 font-bold outline-none transition-all focus:ring-2 focus:ring-black">
                {EXERCISE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-black/30">名称</label>
              <div className="relative">
                <input value={itemName} onChange={(e) => onItemNameChange(e.target.value)} placeholder="例如：米饭" className="w-full rounded-2xl bg-[#F8F9FA] px-4 py-4 pr-12 font-bold outline-none transition-all focus:ring-2 focus:ring-black" />
                <Sparkles className="absolute right-4 top-1/2 -translate-y-1/2 text-black/10" size={20} />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-black/30">{isFood ? "数量" : "时长 (分钟)"}</label>
            <div className="flex gap-2">
              <input type="number" value={itemAmount} onChange={(e) => onItemAmountChange(e.target.value)} placeholder={isFood ? "150" : "30"} className="flex-1 rounded-2xl bg-[#F8F9FA] px-4 py-4 font-bold outline-none transition-all focus:ring-2 focus:ring-black" />
              {isFood && (
                <button type="button" onClick={onOpenUnitModal} className="rounded-2xl bg-black px-4 py-4 text-sm font-black text-white">管理单位</button>
              )}
            </div>
          </div>

          {isFood && (
            <div className="space-y-4 rounded-[32px] bg-[#F5F7F4] p-5">
              {isImageAnalyzing ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                      <Camera size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-black">AI 正在看图，预计需要 10-30 秒...</p>
                      <p className="text-xs font-bold text-black/35">识别完成后会自动回填食物、重量、热量和三大营养素。</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-3 animate-pulse rounded-full bg-white/80" />
                    <div className="h-20 animate-pulse rounded-3xl bg-white/80" />
                    <div className="grid grid-cols-3 gap-3">
                      <div className="h-16 animate-pulse rounded-2xl bg-white/80" />
                      <div className="h-16 animate-pulse rounded-2xl bg-white/80" />
                      <div className="h-16 animate-pulse rounded-2xl bg-white/80" />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {selectedFood && (
                    <div className="space-y-4 rounded-[28px] bg-white p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-black">{selectedFood.name}</p>
                          <p className="mt-1 text-xs font-bold text-black/35">
                            {selectedFoodId ? "已匹配库内食物，单位只展示该 food_id 的专属单位。" : `AI 估算：约 ${previewWeight || 0} 克，${previewCalories || 0} 千卡`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-4xl font-black leading-none text-emerald-600">{Math.round(previewCalories || 0)}</p>
                          <p className="mt-1 text-xs font-bold text-black/40">{Math.round(previewWeight || 0)} g</p>
                        </div>
                      </div>

                      {previewMacroRatio && previewMacros && (
                        <div className="space-y-2">
                          <div className="h-3 overflow-hidden rounded-full bg-[#E6ECE8]">
                            <div className="flex h-full w-full">
                              <div className="bg-blue-500" style={{ width: `${previewMacroRatio.carbs}%` }} />
                              <div className="bg-emerald-500" style={{ width: `${previewMacroRatio.protein}%` }} />
                              <div className="bg-amber-400" style={{ width: `${previewMacroRatio.fats}%` }} />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                            <p className="text-blue-600">碳水 {previewMacros.carbs.toFixed(1)}g {previewMacroRatio.carbs}%</p>
                            <p className="text-emerald-600">蛋白质 {previewMacros.protein.toFixed(1)}g {previewMacroRatio.protein}%</p>
                            <p className="text-amber-500">脂肪 {previewMacros.fats.toFixed(1)}g {previewMacroRatio.fats}%</p>
                          </div>
                        </div>
                      )}

                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-xs font-bold text-black/40">
                          <span>AI 估算：约 {Math.round(previewWeight || 0)} 克，{Math.round(previewCalories || 0)} 千卡</span>
                          <span>{amountNumber || 0} {selectedUnit === "g" ? "克" : selectedUnitOption?.name || "份"}</span>
                        </div>
                        <input type="range" min={sliderMin} max={sliderMax} step={sliderStep} value={amountNumber || sliderMin} onChange={(e) => onItemAmountChange(e.target.value)} className="w-full accent-emerald-500" />
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          <button type="button" onClick={() => onSelectedUnitChange("g")} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-black transition-all ${selectedUnit === "g" ? "bg-emerald-500 text-white" : "bg-white text-black/50"}`}>克</button>
                          {customUnits.map((unit) => (
                            <button key={unit.id} type="button" onClick={() => onSelectedUnitChange(unit.id.toString())} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-black transition-all ${selectedUnit === unit.id.toString() ? "bg-emerald-500 text-white" : "bg-white text-black/50"}`}>{unit.name}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {previewCalories !== null && (
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-black/30">热量 (kcal) - AI 预估</label>
                      <input type="number" value={Math.round(previewCalories)} onChange={(e) => onManualEstimateChange(Number(e.target.value || 0))} className="w-full rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 font-bold text-emerald-700 outline-none transition-all focus:ring-2 focus:ring-emerald-500" />
                      <p className="text-[9px] font-bold text-emerald-600/60">可在 AI 预估基础上手动微调。</p>
                      {confidenceHint && <p className="rounded-xl bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-700">{confidenceHint}</p>}
                      {previewMacros && (
                        <div className="grid grid-cols-3 gap-2">
                          <div className="rounded-2xl bg-[#F8F9FA] p-3"><p className="text-[9px] font-bold uppercase text-black/30">P</p><p className="text-sm font-bold">{previewMacros.protein.toFixed(1)}g</p></div>
                          <div className="rounded-2xl bg-[#F8F9FA] p-3"><p className="text-[9px] font-bold uppercase text-black/30">C</p><p className="text-sm font-bold">{previewMacros.carbs.toFixed(1)}g</p></div>
                          <div className="rounded-2xl bg-[#F8F9FA] p-3"><p className="text-[9px] font-bold uppercase text-black/30">F</p><p className="text-sm font-bold">{previewMacros.fats.toFixed(1)}g</p></div>
                        </div>
                      )}
                    </div>
                  )}

                  {analysisReport && healthScore != null && alertLevel && (
                    <NutritionInsightCard
                      healthScore={healthScore}
                      alertLevel={alertLevel}
                      report={analysisReport}
                      macroRatio={previewMacroRatio || null}
                    />
                  )}
                </>
              )}
            </div>
          )}

          <button type="button" disabled={!canSubmit} onClick={onSubmit} className="flex w-full items-center justify-center gap-3 rounded-[10px] bg-gradient-to-r from-emerald-500 to-teal-600 py-5 font-black text-white shadow-md transition-all hover:shadow-lg hover:shadow-emerald-500/20 disabled:opacity-50">
            {isEstimating ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
                {isImageAnalyzing ? "AI 正在看图..." : "AI 估算中..."}
              </>
            ) : (
              <>
                <Sparkles size={20} />
                {mode === "edit" ? "保存修改" : previewCalories !== null ? "确认并记录" : "AI 智能估算"}
              </>
            )}
          </button>
          <p className="text-center text-[9px] font-bold uppercase tracking-[0.2em] text-black/20">Nutrition analysis powered by your configured engine pair</p>
        </div>
      </motion.div>
    </div>
  );
}
