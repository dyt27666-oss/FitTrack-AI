import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import archiver from "archiver";
import dotenv from "dotenv";
import { db } from "./src/server/db";
import {
  AIProxyError,
  type AIProvider,
  type DailyHealthInsightResult,
  type FoodExtractionResult,
  type ImageRecognitionResult,
  type TaskModelProfile,
  type VoiceExtractResult,
  type WeeklyHealthReportResult,
  buildDailyHolisticInsightPrompt,
  buildFoodExtractionPrompt,
  buildImageStructuringPrompt,
  buildVoiceExtractionPrompt,
  buildVoiceTranscriptionPrompt,
  buildVisionDescriptionPrompt,
  buildWeeklyHealthReportPrompt,
  callProvider,
  defaultTaskModelProfile,
  parseJson,
} from "./src/server/aiService";
import { calculateNutritionFromWeight } from "./src/utils/nutritionCalculator";
import { createBodyMetric, deleteBodyMetric, listBodyMetrics } from "./src/server/bodyMetricsService";
import { endFasting, getCurrentFastingStatus, startFasting } from "./src/server/fastingService";
import { normalizeVoiceExtractCandidates, resolveVoiceParsedTime } from "./src/server/voiceService";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USER_ID = 1;

type ProxyErrorType = "network_error" | "model_error" | "business_parse_error";

interface AIGenerateRequest {
  provider?: AIProvider;
  model?: string;
  prompt?: string;
  systemInstruction?: string;
  imageBase64?: string;
  task?: "generic" | "food_lookup" | "image_recognition";
  query?: string;
  useCache?: boolean;
}

interface AIGenerateSuccessResponse {
  ok: true;
  text?: string;
  task?: string;
  source?: "cache" | "ai";
  data?: unknown;
}

interface AIGenerateErrorResponse {
  ok: false;
  errorType: ProxyErrorType;
  message: string;
}

interface EngineHealthStatus {
  kind: "text" | "vision";
  provider: AIProvider;
  model: string;
  ok: boolean;
  latencyMs?: number;
  errorType?: ProxyErrorType;
  message?: string;
  responseSnippet?: string;
}

interface DualHealthResponse {
  ok: boolean;
  text: EngineHealthStatus;
  vision: EngineHealthStatus;
}

interface VoiceTranscribeRequest {
  audioBase64?: string;
  mimeType?: string;
}

interface VoiceExtractRequest {
  transcript?: string;
  date?: string;
}

interface VoiceCommitRequest {
  date?: string;
  candidates?: Array<{
    id?: string;
    type?: "food" | "exercise";
    name?: string;
    amount?: number;
    unit?: string | null;
    calories?: number;
    protein?: number;
    carbs?: number;
    fats?: number;
    parsed_time?: string;
    confidence?: number;
  }>;
}

const toProxyError = (error: unknown): AIGenerateErrorResponse => {
  if (error instanceof AIProxyError) {
    return { ok: false, errorType: error.errorType, message: error.message };
  }
  return {
    ok: false,
    errorType: "model_error",
    message: error instanceof Error ? error.message : "Unknown server error",
  };
};

const mapProfileForFrontend = (profile: ReturnType<typeof db.getProfile>) => ({
  id: profile.id,
  name: profile.name,
  sex: profile.sex,
  age: profile.age,
  heightCm: profile.heightCm,
  weightKg: profile.weightKg,
  activityLevel: profile.activityLevel,
  goal: profile.goal,
  goalCalories: profile.goalCalories,
  text_ai_provider: profile.textAiProvider,
  text_ai_model: profile.textAiModel,
  vision_ai_provider: profile.visionAiProvider,
  vision_ai_model: profile.visionAiModel,
  ai_provider: profile.textAiProvider,
  ai_model: profile.textAiModel,
  gender: profile.sex,
  height: profile.heightCm,
  weight: profile.weightKg,
  activity_level: profile.activityLevel,
  goal_calories: profile.goalCalories,
});

const resolveTaskModelProfile = (profile: ReturnType<typeof db.getProfile>): TaskModelProfile => ({
  textProvider: profile.textAiProvider || defaultTaskModelProfile.textProvider,
  textModel: profile.textAiModel || defaultTaskModelProfile.textModel,
  visionProvider: profile.visionAiProvider || defaultTaskModelProfile.visionProvider,
  visionModel: profile.visionAiModel || defaultTaskModelProfile.visionModel,
});

const mapFoodForFrontend = (food: any) => ({
  id: food.id,
  name: food.name,
  calories: food.caloriesPer100g,
  calories_per_100g: food.caloriesPer100g,
  protein: food.proteinPer100g,
  protein_per_100g: food.proteinPer100g,
  carbs: food.carbsPer100g,
  carbs_per_100g: food.carbsPer100g,
  fats: food.fatsPer100g,
  fats_per_100g: food.fatsPer100g,
  unit: "g",
  cooking_method: food.cookingMethod,
  is_edible: food.isEdible === 1,
  confidence: food.confidence,
});

const mapHabitForFrontend = (habit: any) => ({
  id: habit.id,
  userId: habit.userId,
  name: habit.name,
  icon: habit.icon,
  color: habit.color,
  frequencyType: habit.frequencyType,
  frequencyValue: habit.frequencyValue,
  targetValue: habit.targetValue,
  unit: habit.unit,
  isActive: Boolean(habit.isActive),
  sortOrder: habit.sortOrder,
});

const toDateOnly = (input: Date): string => input.toISOString().slice(0, 10);

const buildDateRange = (days: number) => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return { from: toDateOnly(start), to: toDateOnly(end) };
};

const buildDateRangeEndingAt = (days: number, endDate: Date) => {
  const end = new Date(endDate);
  const start = new Date(endDate);
  start.setDate(end.getDate() - (days - 1));
  return { from: toDateOnly(start), to: toDateOnly(end) };
};

const shiftDate = (date: string, deltaDays: number) => {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + deltaDays);
  return toDateOnly(next);
};

const computeCurrentStreak = (
  logs: Array<{ date: string; status: "pending" | "done" | "missed" }>,
  today: string
) => {
  const logMap = new Map(logs.map((log) => [log.date, log.status]));
  const todayStatus = logMap.get(today);
  let cursor = today;

  if (todayStatus !== "done") {
    const yesterday = shiftDate(today, -1);
    if (logMap.get(yesterday) !== "done") {
      return 0;
    }
    cursor = yesterday;
  }

  let streak = 0;
  while (logMap.get(cursor) === "done") {
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
};

const computeMaxStreak = (logs: Array<{ date: string; status: "pending" | "done" | "missed" }>) => {
  if (!logs.length) return 0;
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  let maxStreak = 0;
  let current = 0;
  let previousDate: string | null = null;

  for (const log of sorted) {
    if (log.status !== "done") {
      current = 0;
      previousDate = log.date;
      continue;
    }

    if (previousDate && shiftDate(previousDate, 1) === log.date) {
      current += 1;
    } else {
      current = 1;
    }

    if (current > maxStreak) {
      maxStreak = current;
    }
    previousDate = log.date;
  }

  return maxStreak;
};

const resolveVoiceAsrProfile = (taskProfile: TaskModelProfile) => {
  const envProvider = process.env.VOICE_ASR_PROVIDER as AIProvider | undefined;
  const provider =
    envProvider ||
    (process.env.SILRA_API_KEY
      ? "silra"
      : process.env.GEMINI_API_KEY
        ? "gemini"
        : taskProfile.textProvider);

  const model =
    process.env.VOICE_ASR_MODEL ||
    (provider === "silra"
        ? "qwen3-asr-flash"
        : provider === "gemini"
          ? "gemini-2.5-flash"
          : "glm-4v");

  return { provider, model };
};

const ensureAudioPayload = (body: VoiceTranscribeRequest) => {
  if (!body.audioBase64) {
    throw new AIProxyError("business_parse_error", "audioBase64 is required");
  }
  const mimeType =
    typeof body.mimeType === "string" && body.mimeType.trim() ? body.mimeType : "audio/webm";
  const audioBase64 = body.audioBase64.startsWith("data:")
    ? body.audioBase64.split(",")[1] || ""
    : body.audioBase64;

  if (!audioBase64) {
    throw new AIProxyError("business_parse_error", "Invalid audio payload");
  }

  return { audioBase64, mimeType };
};

const insertVoiceCandidateAsLog = (candidate: NonNullable<VoiceCommitRequest["candidates"]>[number], fallbackDate: string) => {
  const type = candidate.type === "exercise" ? "exercise" : "food";
  const parsedTime =
    typeof candidate.parsed_time === "string" && candidate.parsed_time.trim()
      ? candidate.parsed_time
      : resolveVoiceParsedTime(candidate.name || "", fallbackDate);
  const logDate = parsedTime.slice(0, 10);
  const amount = Number(candidate.amount || 0);

  const id = db.addLog({
    userId: USER_ID,
    date: logDate,
    type,
    foodId: null,
    name: String(candidate.name || (type === "food" ? "未命名食物" : "未命名运动")),
    amount,
    unitName: candidate.unit ? String(candidate.unit) : null,
    grams: null,
    calories: Number(candidate.calories || 0),
    protein: Number(candidate.protein || 0),
    carbs: Number(candidate.carbs || 0),
    fats: Number(candidate.fats || 0),
  });

  return db.getLogById(USER_ID, id);
};

const resolveHeatLevel = (rate: number): 0 | 1 | 2 | 3 | 4 => {
  if (rate <= 0) return 0;
  if (rate <= 0.25) return 1;
  if (rate <= 0.5) return 2;
  if (rate <= 0.75) return 3;
  return 4;
};

const HEALTH_CHECK_IMAGE_BASE64 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAdSURBVDhPY3jv4vKfEsyALkAqHjVg1IBRAwaLAQDnAXYfiKSRsQAAAABJRU5ErkJggg==";

const normalizeStringArray = (value: unknown, fallback: string[]): string[] => {
  if (!Array.isArray(value)) return fallback;
  const next = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return next.length ? next : fallback;
};

const normalizeAnalysisReport = (report: ImageRecognitionResult["analysis_report"]) => ({
  summary:
    typeof report?.summary === "string" && report.summary.trim()
      ? report.summary
      : "这是一份基于图像识别的营养分析，适合先作为记录和调整的参考。",
  plate_comment:
    typeof report?.plate_comment === "string" && report.plate_comment.trim()
      ? report.plate_comment
      : "系统已生成保底营养分析，建议结合实际食材和分量做微调。",
  vegetables_fruits_ratio:
    typeof report?.vegetables_fruits_ratio === "number" ? report.vegetables_fruits_ratio : 20,
  whole_grains_ratio: typeof report?.whole_grains_ratio === "number" ? report.whole_grains_ratio : 25,
  healthy_protein_ratio:
    typeof report?.healthy_protein_ratio === "number" ? report.healthy_protein_ratio : 20,
  gi_level: report?.gi_level || "medium",
  processing_level: report?.processing_level || "processed",
  strengths: normalizeStringArray(report?.strengths, ["提供基础热量与宏量营养素估算"]),
  weaknesses: normalizeStringArray(report?.weaknesses ?? report?.risks, ["图像识别存在误差，结果仅供记录前参考"]),
  risks: normalizeStringArray(report?.risks ?? report?.weaknesses, ["图像识别存在误差，结果仅供记录前参考"]),
  improvements: normalizeStringArray(report?.improvements ?? report?.suggestions, ["建议保存前校正食物种类与重量"]),
  suggestions: normalizeStringArray(report?.suggestions ?? report?.improvements, ["建议保存前校正食物种类与重量"]),
  reasoning:
    typeof report?.reasoning === "string" && report.reasoning.trim()
      ? report.reasoning
      : "当前结论基于图片中的食材结构、估计分量、烹饪方式和膳食平衡建议进行综合判断。",
  education_tip:
    typeof report?.education_tip === "string" && report.education_tip.trim()
      ? report.education_tip
      : "膳食平衡建议强调蔬果、全谷物和优质蛋白的结构平衡。",
});

const normalizeDailyHealthInsight = (
  report: Partial<DailyHealthInsightResult> | null | undefined,
  metrics: DailyHealthInsightResult["metrics"]
): DailyHealthInsightResult => ({
  title: typeof report?.title === "string" && report.title.trim() ? report.title : "今日健康洞察",
  status_tag: typeof report?.status_tag === "string" && report.status_tag.trim() ? report.status_tag : "稳态管理日",
  summary:
    typeof report?.summary === "string" && report.summary.trim()
      ? report.summary
      : "系统已结合今天的饮食、运动和自律记录生成一份健康洞察，可作为今天后续安排的依据。",
  sections: {
    overview:
      typeof report?.sections?.overview === "string" && report.sections.overview.trim()
        ? report.sections.overview
        : "今天的记录已具备基础分析价值，但如果晚间还有进食或运动，建议继续补全后再回看整体状态。",
    energy:
      typeof report?.sections?.energy === "string" && report.sections.energy.trim()
        ? report.sections.energy
        : "系统已根据当前摄入和消耗生成热量收支判断，晚间新增记录会继续影响净值。",
    diet:
      typeof report?.sections?.diet === "string" && report.sections.diet.trim()
        ? report.sections.diet
        : "今日饮食分析会围绕已记录食物的实际结构、烹饪方式和热量来源展开。",
    nutrition:
      typeof report?.sections?.nutrition === "string" && report.sections.nutrition.trim()
        ? report.sections.nutrition
        : "系统会结合蛋白质、碳水和脂肪的实际摄入情况判断今天的营养结构。",
    activity:
      typeof report?.sections?.activity === "string" && report.sections.activity.trim()
        ? report.sections.activity
        : "活动分析会结合今日运动记录和缺失的活动量来生成。",
    discipline:
      typeof report?.sections?.discipline === "string" && report.sections.discipline.trim()
        ? report.sections.discipline
        : "自律分析会结合完成率和当前连胜状态，判断今天的执行稳定性。",
    risks:
      typeof report?.sections?.risks === "string" && report.sections.risks.trim()
        ? report.sections.risks
        : "若当前记录仍不完整，系统会用更保守的方式提示今天的潜在问题。",
    next_actions: normalizeStringArray(report?.sections?.next_actions, [
      "下一餐先补足优质蛋白和蔬菜，再决定是否追加主食。",
      "下午优先安排一次轻到中等强度活动，避免长时间久坐。",
      "晚上补全剩余记录，确认今天的热量收支是否仍在目标范围内。",
      "如果今天自律完成率偏低，先降低任务门槛，优先保住连续性。",
    ]),
  },
  metrics,
});

const normalizeWeeklyHealthReport = (
  report: Partial<WeeklyHealthReportResult> | null | undefined,
  weekRange: string,
  metrics: WeeklyHealthReportResult["metrics"]
): WeeklyHealthReportResult => ({
  title: typeof report?.title === "string" && report.title.trim() ? report.title : "本周健康周报",
  status_tag:
    typeof report?.status_tag === "string" && report.status_tag.trim() ? report.status_tag : "恢复调整期",
  summary:
    typeof report?.summary === "string" && report.summary.trim()
      ? report.summary
      : "系统已结合本周饮食、自律与行为数据生成一份周报，用于复盘和下周阈值调整。",
  week_range: weekRange,
  sections: {
    overview:
      typeof report?.sections?.overview === "string" && report.sections.overview.trim()
        ? report.sections.overview
        : "本周已有可用于复盘的基础数据，但仍建议持续保持饮食与习惯记录完整。",
    diet_trend:
      typeof report?.sections?.diet_trend === "string" && report.sections.diet_trend.trim()
        ? report.sections.diet_trend
        : "系统会围绕一周热量和营养结构波动总结饮食趋势。",
    discipline_trend:
      typeof report?.sections?.discipline_trend === "string" && report.sections.discipline_trend.trim()
        ? report.sections.discipline_trend
        : "系统会围绕本周完成率和连胜变化总结自律趋势。",
    high_risk_window:
      typeof report?.sections?.high_risk_window === "string" && report.sections.high_risk_window.trim()
        ? report.sections.high_risk_window
        : "系统会结合断更和低完成率日期识别高危时段。",
    forecast:
      typeof report?.sections?.forecast === "string" && report.sections.forecast.trim()
        ? report.sections.forecast
        : "下周预测会基于本周行为波动和执行稳定性给出判断。",
    next_week_actions: normalizeStringArray(report?.sections?.next_week_actions, [
      "下周先把最容易中断的习惯降到更容易完成的门槛。",
      "将高危时段前置设置提醒或替代动作，减少断更概率。",
      "维持饮食记录完整度，优先修复热量和蛋白质波动最大的时段。",
      "把周中最容易失控的一餐提前设计替代方案，降低随机性。",
    ]),
  },
  metrics,
});

const summarizeHabitStatus = (habits: Array<{ name: string; status: "pending" | "done" | "missed"; current_streak: number }>) => {
  const completed = habits.filter((habit) => habit.status === "done").length;
  const missed = habits.filter((habit) => habit.status === "missed").length;
  const total = habits.length;
  return { completed, missed, total, rate: total ? Number((completed / total).toFixed(3)) : 0 };
};

const aggregateLogsByDate = (logs: any[]) => {
  const map = new Map<
    string,
    {
      caloriesIn: number;
      caloriesOut: number;
      protein: number;
      carbs: number;
      fats: number;
      foodCount: number;
      exerciseCount: number;
    }
  >();
  for (const log of logs) {
    const current = map.get(log.date) || {
      caloriesIn: 0,
      caloriesOut: 0,
      protein: 0,
      carbs: 0,
      fats: 0,
      foodCount: 0,
      exerciseCount: 0,
    };
    if (log.type === "food") {
      current.caloriesIn += Number(log.calories || 0);
      current.protein += Number(log.protein || 0);
      current.carbs += Number(log.carbs || 0);
      current.fats += Number(log.fats || 0);
      current.foodCount += 1;
    } else {
      current.caloriesOut += Number(log.calories || 0);
      current.exerciseCount += 1;
    }
    map.set(log.date, current);
  }
  return map;
};

const buildWeeklyStatusTag = (avgCompletionRate: number, avgNetCalories: number) => {
  if (avgCompletionRate >= 0.75 && avgNetCalories <= 200) return "代谢加速期";
  if (avgCompletionRate >= 0.5) return "恢复调整期";
  return "结构失衡期";
};

const buildFallbackImageRecognition = (reason: string): ImageRecognitionResult => ({
  primary_food_name: "AI 模糊识别餐食",
  primary_food: "AI 模糊识别餐食",
  is_edible: true,
  confidence: 35,
  estimated_weight_g: 200,
  estimated_calories: 300,
  estimated_protein_g: 10,
  estimated_carbs_g: 30,
  estimated_fats_g: 15,
  calories_per_100g: 150,
  protein_per_100g: 5,
  carbs_per_100g: 15,
  fats_per_100g: 7.5,
  estimated_p_c_f: {
    protein_ratio: 18.2,
    carbs_ratio: 54.5,
    fats_ratio: 27.3,
  },
  health_score: 58,
  alert_level: "yellow",
  analysis_report: normalizeAnalysisReport({
    summary: "系统已生成一份保底营养分析。这份结果适合先帮助你完成记录，再结合真实分量做进一步修正。",
    plate_comment: "这份餐食当前来自系统保底估算，因此更适合作为方向性参考，而不是最终精确值。按照默认判断，这顿饭的主能量来源仍以主食或混合餐食中的碳水为主，蔬菜和水果占比不足，优质蛋白来源也不够明确。如果这份餐食实际包含更多用油、浓酱或油炸元素，那么真实热量通常会比现在更高。",
    vegetables_fruits_ratio: 20,
    whole_grains_ratio: 25,
    healthy_protein_ratio: 20,
    gi_level: "medium",
    processing_level: "processed",
    strengths: ["即使识别失败，系统仍保留了可继续使用的热量和三大营养素结果。", "这份分析至少能帮助用户先判断餐盘结构大方向，而不是停留在空白页面。", "保底估算能让后续手动微调更高效，避免从零开始输入。"],
    weaknesses: ["当前结果的准确性依赖保底估算，克数和热量误差可能较大。", "蔬果比例和优质蛋白比例都偏保守，不能代表真实最佳情况。", "若实际烹饪更油、更咸或含更多配菜，这份估算会低估热量密度。"],
    risks: ["当前结果的准确性依赖保底估算，克数和热量误差可能较大。", "蔬果比例和优质蛋白比例都偏保守，不能代表真实最佳情况。", "若实际烹饪更油、更咸或含更多配菜，这份估算会低估热量密度。"],
    improvements: ["保存前先校正这份餐食的大致重量，至少让克数更接近真实值。", "如果这是正餐，建议补一份深色蔬菜，让餐盘结构更完整。", "如果主食是精制碳水，下一餐可尝试替换为全谷物或杂粮。", "如果优质蛋白不足，可补充鸡蛋、鱼、虾、豆腐或瘦肉。"],
    suggestions: ["保存前先校正这份餐食的大致重量，至少让克数更接近真实值。", "如果这是正餐，建议补一份深色蔬菜，让餐盘结构更完整。", "如果主食是精制碳水，下一餐可尝试替换为全谷物或杂粮。", "如果优质蛋白不足，可补充鸡蛋、鱼、虾、豆腐或瘦肉。"],
    reasoning: "这次评分偏保守，主要因为系统是在图像信息不足的前提下给出保底估算。当前最明显的问题不是单一热量高低，而是餐盘结构信息不完整、蔬果比例偏低、优质蛋白判断不稳定，所以灯色和得分都会更谨慎。",
    education_tip: "膳食平衡建议强调的是长期结构：蔬果是否稳定充足、主食是否过度精制、蛋白质来源是否优质、加工度是否过高。单次热量并不等于整体健康质量。",
  }),
  hint: `由于图片模糊、识别失败或网络超时，此为系统默认估算值，请手动微调。原因: ${reason}`,
  candidates: [
    {
      name: "未知混合餐食 (Mixed Meal)",
      confidence: 35,
      estimated_weight_g: 200,
      estimated_calories: 300,
      calories_per_100g: 150,
      protein_per_100g: 5,
      carbs_per_100g: 15,
      fats_per_100g: 7.5,
      is_edible: true,
    },
  ],
});

const computeLogNutrition = (body: any, type: "food" | "exercise") => {
  let calories = Number(body.calories || 0);
  let protein = Number(body.protein || 0);
  let carbs = Number(body.carbs || 0);
  let fats = Number(body.fats || 0);
  let grams = body.grams ? Number(body.grams) : null;
  const foodId = body.food_id ? Number(body.food_id) : null;
  const unitName = body.unit_name ? String(body.unit_name) : null;
  const amount = Number(body.amount || 0);

  if (type === "food" && foodId && unitName && amount > 0) {
    const food = db.getFoodById(foodId);
    const unit = unitName === "g" ? { gramsPerUnit: 1 } : db.getFoodUnitByName(foodId, unitName);
    if (!food || !unit) {
      throw new AIProxyError("business_parse_error", "Food-specific unit not found for this food_id");
    }
    const totals = calculateNutritionFromWeight(amount, unit.gramsPerUnit, {
      caloriesPer100g: food.caloriesPer100g,
      proteinPer100g: food.proteinPer100g,
      carbsPer100g: food.carbsPer100g,
      fatsPer100g: food.fatsPer100g,
    });
    grams = totals.totalWeight;
    calories = totals.totalCalories;
    protein = totals.totalProtein;
    carbs = totals.totalCarbs;
    fats = totals.totalFats;
  }

  return { calories, protein, carbs, fats, grams, foodId, unitName, amount };
};

const toHealthStatus = async (kind: "text" | "vision", provider: AIProvider, model: string): Promise<EngineHealthStatus> => {
  const started = Date.now();
  try {
    const text =
      kind === "text"
        ? await callProvider({
            provider,
            model,
            prompt: "请只回复 pong，不要输出其他内容。",
            systemInstruction: "你在执行健康检查，只允许输出 pong。",
          })
        : await callProvider({
            provider,
            model,
            prompt: "这是一张纯色小图。请只回答一个中文颜色词，例如：红色。",
            systemInstruction: "你在执行视觉健康检查，只允许输出一个中文颜色词，不要解释。",
            imageBase64: HEALTH_CHECK_IMAGE_BASE64,
          });

    return {
      kind,
      provider,
      model,
      ok: true,
      latencyMs: Date.now() - started,
      message: kind === "text" ? "文本引擎可用" : "视觉引擎可用",
      responseSnippet: text.trim().slice(0, 40),
    };
  } catch (error) {
    const proxy = toProxyError(error);
    return {
      kind,
      provider,
      model,
      ok: false,
      latencyMs: Date.now() - started,
      errorType: proxy.errorType,
      message: proxy.message,
    };
  }
};

const runFoodLookupTask = async (provider: AIProvider, model: string, query: string, useCache = true) => {
  if (!query?.trim()) {
    throw new AIProxyError("business_parse_error", "food query is required");
  }

  if (useCache) {
    const cached = db.getFoodByNormalizedName(USER_ID, query);
    if (cached) {
      return {
        source: "cache" as const,
        data: mapFoodForFrontend(cached),
      };
    }
  }

  const { prompt, systemInstruction } = buildFoodExtractionPrompt(query);
  const raw = await callProvider({ provider, model, prompt, systemInstruction });
  const parsed = parseJson<FoodExtractionResult>(raw);

  if (
    !parsed.name ||
    typeof parsed.calories_per_100g !== "number" ||
    typeof parsed.protein_per_100g !== "number" ||
    typeof parsed.carbs_per_100g !== "number" ||
    typeof parsed.fats_per_100g !== "number"
  ) {
    throw new AIProxyError("business_parse_error", "AI food extraction missing macro nutrient fields");
  }

  const savedFood = db.createOrUpdateFood(
    {
      userId: USER_ID,
      name: parsed.name,
      caloriesPer100g: parsed.calories_per_100g,
      proteinPer100g: parsed.protein_per_100g || 0,
      carbsPer100g: parsed.carbs_per_100g || 0,
      fatsPer100g: parsed.fats_per_100g || 0,
      cookingMethod: parsed.cooking_method || "",
      isEdible: parsed.is_edible !== false,
      source: "ai",
      confidence: parsed.confidence ?? 70,
    },
    JSON.stringify(parsed)
  );

  if (parsed.default_unit_name && parsed.grams_per_unit > 0) {
    db.upsertFoodUnit({
      foodId: savedFood.id,
      unitName: parsed.default_unit_name,
      gramsPerUnit: parsed.grams_per_unit,
      isDefault: true,
      source: "ai",
      confidence: parsed.confidence ?? 70,
    });
  }

  return {
    source: "ai" as const,
    data: mapFoodForFrontend(savedFood),
  };
};

const normalizeImageRecognitionResult = (parsed: ImageRecognitionResult): ImageRecognitionResult => {
  parsed.primary_food = parsed.primary_food || parsed.primary_food_name || "?????? (Mixed Meal)";
  parsed.primary_food_name = parsed.primary_food_name || parsed.primary_food;

  const weight = parsed.estimated_weight_g || parsed.candidates?.[0]?.estimated_weight_g || 200;
  const cal100 = parsed.calories_per_100g || parsed.candidates?.[0]?.calories_per_100g || 150;
  const p100 = parsed.protein_per_100g || parsed.candidates?.[0]?.protein_per_100g || 5;
  const c100 = parsed.carbs_per_100g || parsed.candidates?.[0]?.carbs_per_100g || 15;
  const f100 = parsed.fats_per_100g || parsed.candidates?.[0]?.fats_per_100g || 7.5;
  if (!parsed.estimated_calories || parsed.estimated_calories <= 0) parsed.estimated_calories = Math.round((cal100 * weight) / 100);
  if (!parsed.estimated_protein_g || parsed.estimated_protein_g < 0) parsed.estimated_protein_g = Number(((p100 * weight) / 100).toFixed(1));
  if (!parsed.estimated_carbs_g || parsed.estimated_carbs_g < 0) parsed.estimated_carbs_g = Number(((c100 * weight) / 100).toFixed(1));
  if (!parsed.estimated_fats_g || parsed.estimated_fats_g < 0) parsed.estimated_fats_g = Number(((f100 * weight) / 100).toFixed(1));
  parsed.calories_per_100g = cal100;
  parsed.protein_per_100g = p100;
  parsed.carbs_per_100g = c100;
  parsed.fats_per_100g = f100;
  const macroCalories = { protein: parsed.estimated_protein_g * 4, carbs: parsed.estimated_carbs_g * 4, fats: parsed.estimated_fats_g * 9 };
  const totalMacroCalories = macroCalories.protein + macroCalories.carbs + macroCalories.fats;
  parsed.analysis_report = normalizeAnalysisReport(parsed.analysis_report);
  parsed.estimated_p_c_f = totalMacroCalories > 0
    ? {
        protein_ratio: Number(((macroCalories.protein / totalMacroCalories) * 100).toFixed(1)),
        carbs_ratio: Number(((macroCalories.carbs / totalMacroCalories) * 100).toFixed(1)),
        fats_ratio: Number(((macroCalories.fats / totalMacroCalories) * 100).toFixed(1)),
      }
    : { protein_ratio: 18.2, carbs_ratio: 54.5, fats_ratio: 27.3 };
  parsed.hint = parsed.hint || (parsed.confidence < 80 ? "??????????? AI ??????????" : "AI ??????");
  if (!parsed.candidates.length) {
    parsed.candidates = [{
      name: parsed.primary_food_name, confidence: parsed.confidence, estimated_weight_g: parsed.estimated_weight_g || weight,
      estimated_calories: parsed.estimated_calories, calories_per_100g: parsed.calories_per_100g, protein_per_100g: parsed.protein_per_100g,
      carbs_per_100g: parsed.carbs_per_100g, fats_per_100g: parsed.fats_per_100g, is_edible: parsed.is_edible,
    }];
  }
  if (parsed.is_edible && parsed.primary_food) {
    const bestCalories = parsed.calories_per_100g || (parsed.estimated_weight_g > 0 ? (parsed.estimated_calories / parsed.estimated_weight_g) * 100 : 0);
    if (bestCalories > 0) {
      db.createOrUpdateFood({
        userId: USER_ID,
        name: parsed.primary_food_name || parsed.primary_food,
        caloriesPer100g: bestCalories, proteinPer100g: parsed.protein_per_100g || 0, carbsPer100g: parsed.carbs_per_100g || 0, fatsPer100g: parsed.fats_per_100g || 0,
        cookingMethod: "", isEdible: parsed.is_edible, source: "ai", confidence: parsed.confidence,
      }, JSON.stringify(parsed));
    }
  }
  return parsed;
};

const runImageRecognitionTask = async (taskProfile: TaskModelProfile, imageBase64?: string): Promise<ImageRecognitionResult> => {
  if (!imageBase64) return buildFallbackImageRecognition("missing imageBase64");
  try {
    const visionStage = buildVisionDescriptionPrompt();
    const visionDescription = await callProvider({
      provider: taskProfile.visionProvider,
      model: taskProfile.visionModel,
      prompt: visionStage.prompt,
      systemInstruction: visionStage.systemInstruction,
      imageBase64,
    });
    const textStage = buildImageStructuringPrompt(visionDescription);
    const raw = await callProvider({
      provider: taskProfile.textProvider,
      model: taskProfile.textModel,
      prompt: textStage.prompt,
      systemInstruction: textStage.systemInstruction,
    });
    const parsed = parseJson<ImageRecognitionResult>(raw);
    if (typeof parsed.confidence !== "number" || !Array.isArray(parsed.candidates)) {
      throw new AIProxyError("business_parse_error", "image recognition payload is invalid");
    }
    return normalizeImageRecognitionResult(parsed);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown image recognition failure";
    console.error("[AIProxy][image_recognition][fallback] " + reason);
    return buildFallbackImageRecognition(reason);
  }
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "20mb" }));
  app.use(express.urlencoded({ limit: "20mb", extended: true }));
  app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));

  // Reserved mobile STT entry. Web v1 currently uses browser speech recognition.
  // Future Android / Capacitor clients can upload audio to this stable contract.
  app.post("/api/voice/transcribe", async (req, res) => {
    try {
      const profile = db.getProfile(USER_ID);
      const taskProfile = resolveTaskModelProfile(profile);
      const { audioBase64, mimeType } = ensureAudioPayload(req.body || {});
      const asrProfile = resolveVoiceAsrProfile(taskProfile);
      if (asrProfile.provider === "tongyi") {
        throw new AIProxyError(
          "business_parse_error",
          "Tongyi 音频转写在当前兼容模式下未启用。请改用 Silra + qwen3-asr-flash，或在 .env 中显式配置 VOICE_ASR_PROVIDER=silra。"
        );
      }
      const { prompt, systemInstruction } = buildVoiceTranscriptionPrompt();
      const transcript = await callProvider({
        provider: asrProfile.provider,
        model: asrProfile.model,
        prompt,
        systemInstruction,
        audioBase64,
        audioMimeType: mimeType,
      });

      res.json({
        transcript: transcript.trim(),
        provider: asrProfile.provider,
        model: asrProfile.model,
        mimeType,
      });
    } catch (error) {
      const pe = toProxyError(error);
      res.status(pe.errorType === "business_parse_error" ? 400 : 500).json({ error: pe.message });
    }
  });

  app.post("/api/voice/extract", async (req, res) => {
    try {
      const body = req.body as VoiceExtractRequest;
      const transcript = String(body?.transcript || "").trim();
      const selectedDate = String(body?.date || toDateOnly(new Date()));
      if (!transcript) {
        throw new AIProxyError("business_parse_error", "transcript is required");
      }

      const profile = db.getProfile(USER_ID);
      const taskProfile = resolveTaskModelProfile(profile);
      const { prompt, systemInstruction } = buildVoiceExtractionPrompt(transcript, selectedDate);
      const raw = await callProvider({
        provider: taskProfile.textProvider,
        model: taskProfile.textModel,
        prompt,
        systemInstruction,
      });
      const parsed = parseJson<VoiceExtractResult>(raw);
      const items = normalizeVoiceExtractCandidates(Array.isArray(parsed.items) ? parsed.items : [], transcript, selectedDate);
      res.json({ transcript, candidates: items });
    } catch (error) {
      const pe = toProxyError(error);
      res.status(pe.errorType === "business_parse_error" ? 400 : 500).json({ error: pe.message });
    }
  });

  app.post("/api/voice/commit", (req, res) => {
    try {
      const body = (req.body || {}) as VoiceCommitRequest;
      const fallbackDate = String(body.date || toDateOnly(new Date()));
      const candidates = Array.isArray(body.candidates) ? body.candidates : [];
      if (!candidates.length) {
        throw new AIProxyError("business_parse_error", "candidates are required");
      }

      const insertedLogs = candidates.map((candidate) => insertVoiceCandidateAsLog(candidate, fallbackDate)).filter(Boolean);
      res.json({ inserted: insertedLogs.length, logs: insertedLogs });
    } catch (error) {
      const pe = toProxyError(error);
      res.status(pe.errorType === "business_parse_error" ? 400 : 500).json({ error: pe.message });
    }
  });

  app.get("/api/profile", (_req, res) => {
    try {
      const profile = db.getProfile(USER_ID);
      res.json(mapProfileForFrontend(profile));
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch profile" });
    }
  });

  app.post("/api/profile", (req, res) => {
    try {
      const p = req.body || {};
      db.updateProfile(USER_ID, {
        name: p.name,
        sex: p.sex || p.gender,
        age: Number(p.age),
        heightCm: Number(p.heightCm ?? p.height),
        weightKg: Number(p.weightKg ?? p.weight),
        activityLevel: Number(p.activityLevel ?? p.activity_level),
        goal: p.goal || "??",
        goalCalories: Number(p.goalCalories ?? p.goal_calories),
        textAiProvider: p.text_ai_provider || p.ai_provider || "silra",
        textAiModel: p.text_ai_model || p.ai_model || "deepseek-v3",
        visionAiProvider: p.vision_ai_provider || "tongyi",
        visionAiModel: p.vision_ai_model || "qwen-vl-plus",
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update profile" });
    }
  });

  app.post("/api/ai/generate", async (req, res) => {
    const payload = req.body as AIGenerateRequest;
    const task = payload.task || "generic";
    const profile = db.getProfile(USER_ID);
    const taskProfile = resolveTaskModelProfile(profile);
    const provider = (payload.provider || (task === "image_recognition" ? taskProfile.visionProvider : taskProfile.textProvider)) as AIProvider;
    const model = payload.model || (task === "image_recognition" ? taskProfile.visionModel : taskProfile.textModel);

    try {
      if (task === "food_lookup") {
        const result = await runFoodLookupTask(taskProfile.textProvider, taskProfile.textModel, payload.query || "", payload.useCache !== false);
        const response: AIGenerateSuccessResponse = {
          ok: true,
          task,
          source: result.source,
          data: result.data,
        };
        res.json(response);
        return;
      }

      if (task === "image_recognition") {
        const result = await runImageRecognitionTask(taskProfile, payload.imageBase64);
        const response: AIGenerateSuccessResponse = { ok: true, task, source: "ai", data: result };
        res.json(response);
        return;
      }

      if (!payload.prompt) {
        throw new AIProxyError("business_parse_error", "prompt is required");
      }
      const text = await callProvider({
        provider,
        model,
        prompt: payload.prompt,
        systemInstruction: payload.systemInstruction,
        imageBase64: payload.imageBase64,
      });
      const response: AIGenerateSuccessResponse = { ok: true, task, source: "ai", text };
      res.json(response);
    } catch (error) {
      if (task === "image_recognition") {
        const fallback = buildFallbackImageRecognition(error instanceof Error ? error.message : "route-level image recognition failure");
        const response: AIGenerateSuccessResponse = { ok: true, task, source: "ai", data: fallback };
        res.status(200).json(response);
        return;
      }
      const response: AIGenerateErrorResponse = toProxyError(error);
      const status = response.errorType === "business_parse_error" ? 400 : 502;
      res.status(status).json(response);
    }
  });

  app.get("/api/health", async (_req, res) => {
    try {
      const profile = db.getProfile(USER_ID);
      const taskProfile = resolveTaskModelProfile(profile);
      const [text, vision] = await Promise.all([
        toHealthStatus("text", taskProfile.textProvider, taskProfile.textModel),
        toHealthStatus("vision", taskProfile.visionProvider, taskProfile.visionModel),
      ]);

      const response: DualHealthResponse = {
        ok: text.ok && vision.ok,
        text,
        vision,
      };
      res.status(response.ok ? 200 : 207).json(response);
    } catch (error) {
      res.status(500).json({
        ok: false,
        text: {
          kind: "text",
          provider: "silra",
          model: defaultTaskModelProfile.textModel,
          ok: false,
          errorType: "model_error",
          message: error instanceof Error ? error.message : "Failed to run text health check",
        },
        vision: {
          kind: "vision",
          provider: "tongyi",
          model: defaultTaskModelProfile.visionModel,
          ok: false,
          errorType: "model_error",
          message: error instanceof Error ? error.message : "Failed to run vision health check",
        },
      } satisfies DualHealthResponse);
    }
  });

  app.get("/api/ai/health-check", async (req, res) => {
    const requested = ((req.query.provider as string) || "all").toLowerCase();
    const model = (req.query.model as string) || "";
    const validProviders: AIProvider[] = ["gemini", "zhipu", "tongyi", "silra"];
    if (requested !== "all" && !validProviders.includes(requested as AIProvider)) {
      res.status(400).json({ ok: false, errorType: "business_parse_error", message: "invalid provider" });
      return;
    }
    const providers: AIProvider[] =
      requested === "all"
        ? validProviders
        : [requested as AIProvider];

    const results: any[] = [];
    for (const provider of providers) {
      const started = Date.now();
      try {
        await callProvider({ provider, model, prompt: "Reply with: OK" });
        results.push({
          provider,
          ok: true,
          latencyMs: Date.now() - started,
          message: "healthy",
        });
      } catch (error) {
        const pe = toProxyError(error);
        results.push({
          provider,
          ok: false,
          errorType: pe.errorType,
          message: pe.message,
        });
      }
    }

    if (requested === "all") {
      const ok = results.every((r) => r.ok);
      res.status(ok ? 200 : 207).json({ ok, results });
      return;
    }

    const single = results[0];
    if (!single) {
      res.status(400).json({ ok: false, errorType: "business_parse_error", message: "invalid provider" });
      return;
    }
    res.status(single.ok ? 200 : 502).json(single);
  });

  app.get("/api/analytics/daily", async (req, res) => {
    const date = typeof req.query.date === "string" && req.query.date.trim() ? req.query.date : toDateOnly(new Date());
    try {
      const profile = db.getProfile(USER_ID);
      const taskProfile = resolveTaskModelProfile(profile);
      const logs = db.getLogs(USER_ID, date);
      const habits = db.listHabits(USER_ID).map((habit) => {
        const todayLog = db.getHabitLog(USER_ID, habit.id, date);
        const streakLogs = db.listHabitLogsForHabitBeforeDate(USER_ID, habit.id, date, 366);
        return {
          name: habit.name,
          status: (todayLog?.status || "pending") as "pending" | "done" | "missed",
          current_streak: computeCurrentStreak(streakLogs, date),
        };
      });

      const foods = logs
        .filter((log) => log.type === "food")
        .map((log) => ({
          name: log.name,
          calories: Number(log.calories || 0),
          protein: Number(log.protein || 0),
          carbs: Number(log.carbs || 0),
          fats: Number(log.fats || 0),
          amount: Number(log.amount || 0),
          unit_name: log.unit_name || null,
        }));
      const exercises = logs
        .filter((log) => log.type === "exercise")
        .map((log) => ({
          name: log.name,
          calories: Number(log.calories || 0),
          amount: Number(log.amount || 0),
        }));
      const habitSummary = summarizeHabitStatus(habits);
      const metrics: DailyHealthInsightResult["metrics"] = {
        calories_in: Number(foods.reduce((sum, item) => sum + item.calories, 0).toFixed(1)),
        calories_out: Number(exercises.reduce((sum, item) => sum + item.calories, 0).toFixed(1)),
        net_calories: 0,
        protein_g: Number(foods.reduce((sum, item) => sum + item.protein, 0).toFixed(1)),
        carbs_g: Number(foods.reduce((sum, item) => sum + item.carbs, 0).toFixed(1)),
        fats_g: Number(foods.reduce((sum, item) => sum + item.fats, 0).toFixed(1)),
        habit_completion_rate: habitSummary.rate,
        completed_habits: habitSummary.completed,
        total_habits: habitSummary.total,
      };
      metrics.net_calories = Number((metrics.calories_in - metrics.calories_out).toFixed(1));

      const { prompt, systemInstruction } = buildDailyHolisticInsightPrompt({
        date,
        profile: {
          goal: profile.goal,
          goalCalories: profile.goalCalories,
          sex: profile.sex,
          age: profile.age,
          heightCm: profile.heightCm,
          weightKg: profile.weightKg,
        },
        foods,
        exercises,
        habits,
        metrics,
      });

      try {
        const raw = await callProvider({
          provider: taskProfile.textProvider,
          model: taskProfile.textModel,
          prompt,
          systemInstruction,
        });
        const parsed = parseJson<DailyHealthInsightResult>(raw);
        res.json(normalizeDailyHealthInsight(parsed, metrics));
      } catch (error) {
        res.json(
          normalizeDailyHealthInsight(
            {
              status_tag: habitSummary.rate >= 0.7 ? "稳态管理日" : "调整修复日",
              summary: "系统已基于今天的饮食、运动和自律记录生成一份保底洞察。若继续补全记录，后续建议会更具体。",
              sections: {
                overview:
                  "从当前记录看，今天已经形成了基本的健康行为轨迹，但仍可能因为晚间摄入或活动变化而改变整体判断。现阶段最重要的不是追求绝对精确，而是确保剩余时间的策略更稳健。",
                energy:
                  "当前热量净值会受到剩余餐次和活动量影响。如果今天摄入已经偏高，后续更适合通过控制晚餐结构和增加轻活动来修正，而不是单纯依赖极端节食补救。",
                diet:
                  "今天的饮食判断会优先看已记录食物的种类、分量和烹饪方式。若当前主食或高能量食物占比偏高，下一餐更适合用蔬菜和优质蛋白拉回结构。",
                nutrition:
                  "三大营养素的分布需要跟全天背景一起看。若蛋白质偏低，晚上应优先补蛋白；若碳水偏高，则下一餐应控制精制主食并增加蔬菜体积。",
                activity:
                  exercises.length > 0
                    ? "今天已经有运动记录，后续重点是避免长时间静坐，并把活动安排得更平稳。"
                    : "今天尚未形成明确运动消耗，下午到晚上更适合安排一次轻到中等强度活动，至少打断久坐状态。",
                discipline:
                  habitSummary.total > 0
                    ? `当前习惯完成率为 ${Math.round(habitSummary.rate * 100)}%。如果完成率偏低，今天最重要的是保住连续性，而不是一次性追求过高目标。`
                    : "当前尚无足够自律数据，建议至少完成一项可执行的小目标，帮助建立节奏。",
                risks:
                  "今天最值得警惕的问题通常来自两个方向：一是热量摄入与活动量不匹配，二是晚间因为疲劳或放松导致记录中断和进食失控。",
                next_actions: [
                  "下一餐优先安排一份优质蛋白和一份蔬菜，再决定主食量。",
                  "下午或傍晚安排 20-30 分钟轻到中等强度活动，先打断久坐。",
                  "如果今天还有未完成习惯，先完成最容易的一项，优先保住连续性。",
                  "晚上睡前回看今天记录，确认是否需要补蛋白、减主食或减少夜间加餐。",
                ],
              },
            },
            metrics
          )
        );
      }
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to build daily analytics" });
    }
  });

  app.get("/api/analytics/weekly", async (_req, res) => {
    const end = new Date();
    const { from, to } = buildDateRangeEndingAt(7, end);
    const weekRange = `${from} ~ ${to}`;
    try {
      const profile = db.getProfile(USER_ID);
      const taskProfile = resolveTaskModelProfile(profile);
      const habits = db.listAllHabits(USER_ID);
      const weeklyLogs: any[] = [];
      for (let cursor = new Date(from); toDateOnly(cursor) <= to; cursor.setDate(cursor.getDate() + 1)) {
        weeklyLogs.push(...db.getLogs(USER_ID, toDateOnly(cursor)));
      }
      const weeklyHabitLogs = db.listHabitLogsInRange(USER_ID, from, to);
      const logsByDate = aggregateLogsByDate(weeklyLogs);
      const habitLogsByDate = new Map<string, Array<{ habitId: number; status: string }>>();
      for (const log of weeklyHabitLogs) {
        const current = habitLogsByDate.get(log.date) || [];
        current.push({ habitId: log.habitId, status: log.status });
        habitLogsByDate.set(log.date, current);
      }

      const dailyNutrition: Array<Record<string, unknown>> = [];
      const dailyDiscipline: Array<Record<string, unknown>> = [];
      let totalCaloriesIn = 0;
      let totalCaloriesOut = 0;
      let totalCompletedHabits = 0;
      let totalHabitSlots = 0;

      for (let cursor = new Date(from); toDateOnly(cursor) <= to; cursor.setDate(cursor.getDate() + 1)) {
        const date = toDateOnly(cursor);
        const nutrition = logsByDate.get(date) || {
          caloriesIn: 0,
          caloriesOut: 0,
          protein: 0,
          carbs: 0,
          fats: 0,
          foodCount: 0,
          exerciseCount: 0,
        };
        const dailyHabitLogs = habitLogsByDate.get(date) || [];
        const doneCount = dailyHabitLogs.filter((log) => log.status === "done").length;
        const totalCount = habits.length;
        totalCaloriesIn += nutrition.caloriesIn;
        totalCaloriesOut += nutrition.caloriesOut;
        totalCompletedHabits += doneCount;
        totalHabitSlots += totalCount;
        dailyNutrition.push({
          date,
          calories_in: Number(nutrition.caloriesIn.toFixed(1)),
          calories_out: Number(nutrition.caloriesOut.toFixed(1)),
          net_calories: Number((nutrition.caloriesIn - nutrition.caloriesOut).toFixed(1)),
          protein_g: Number(nutrition.protein.toFixed(1)),
          carbs_g: Number(nutrition.carbs.toFixed(1)),
          fats_g: Number(nutrition.fats.toFixed(1)),
          food_count: nutrition.foodCount,
          exercise_count: nutrition.exerciseCount,
        });
        dailyDiscipline.push({
          date,
          completed: doneCount,
          total: totalCount,
          completion_rate: totalCount ? Number((doneCount / totalCount).toFixed(3)) : 0,
        });
      }

      const maxStreaks = habits.map((habit) => ({
        habit_id: habit.id,
        name: habit.name,
        max_streak: computeMaxStreak(db.listHabitLogsForHabitAll(USER_ID, habit.id)),
      }));
      const avgCompletionRate = totalHabitSlots ? Number((totalCompletedHabits / totalHabitSlots).toFixed(3)) : 0;
      const avgCaloriesIn = Number((totalCaloriesIn / 7).toFixed(1));
      const avgCaloriesOut = Number((totalCaloriesOut / 7).toFixed(1));
      const avgNetCalories = Number((avgCaloriesIn - avgCaloriesOut).toFixed(1));
      const lowestDays = [...dailyDiscipline]
        .sort((a, b) => Number(a.completion_rate) - Number(b.completion_rate))
        .slice(0, 2)
        .map((item) => `${item.date}（完成率 ${Math.round(Number(item.completion_rate) * 100)}%）`);
      const metrics: WeeklyHealthReportResult["metrics"] = {
        avg_calories_in: avgCaloriesIn,
        avg_calories_out: avgCaloriesOut,
        avg_net_calories: avgNetCalories,
        avg_habit_completion_rate: avgCompletionRate,
        total_completed_habits: totalCompletedHabits,
        total_habits: totalHabitSlots,
        max_streaks: maxStreaks,
      };
      const { prompt, systemInstruction } = buildWeeklyHealthReportPrompt({
        weekRange,
        profile: {
          goal: profile.goal,
          goalCalories: profile.goalCalories,
          sex: profile.sex,
          age: profile.age,
          heightCm: profile.heightCm,
          weightKg: profile.weightKg,
        },
        dailyNutrition,
        dailyDiscipline,
        maxStreaks,
        weeklyMetrics: metrics,
      });

      try {
        const raw = await callProvider({
          provider: taskProfile.textProvider,
          model: taskProfile.textModel,
          prompt,
          systemInstruction,
        });
        const parsed = parseJson<WeeklyHealthReportResult>(raw);
        res.json(normalizeWeeklyHealthReport(parsed, weekRange, metrics));
      } catch (error) {
        res.json(
          normalizeWeeklyHealthReport(
            {
              status_tag: buildWeeklyStatusTag(avgCompletionRate, avgNetCalories),
              summary: "系统已基于一周饮食、自律和行为记录生成保底周报，用于帮助你复盘本周并调整下周目标。",
              sections: {
                overview:
                  "本周的核心问题通常不在于某一天单独失控，而在于饮食和自律波动是否具有重复性。只要能识别出波动最大的时段和最容易中断的目标，下周就有机会明显提高稳定性。",
                diet_trend:
                  "从本周的摄入和宏量营养素波动看，更值得关注的是结构是否稳定，而不是单日是否绝对完美。如果高能量餐次频繁集中在固定日期或晚间，就应优先改那个场景，而不是一味压低总热量。",
                discipline_trend:
                  `本周平均完成率约为 ${Math.round(avgCompletionRate * 100)}%。真正影响下周状态的，不只是总完成率，而是哪些习惯最容易中断，以及中断后是否能快速恢复。`,
                high_risk_window:
                  lowestDays.length > 0
                    ? `本周最值得警惕的低完成窗口主要集中在 ${lowestDays.join("、")}。这些日期通常代表情境性压力、疲劳或日程打乱，是下周最需要提前布防的高危时段。`
                    : "当前数据不足以锁定明确高危窗口，但建议优先观察工作日后半段和晚间是否更容易断更。",
                forecast:
                  "如果下周继续沿用当前节奏而不做阈值调整，最可能出现的是中段完成率回落、饮食结构松动和连胜被打断。相反，如果你能先降低高难度目标，再保住记录完整度，下周整体稳定性会更高。",
                next_week_actions: [
                  "把最容易断更的目标门槛先降低，优先保证连续完成。",
                  "提前为高危时段准备替代动作，例如低门槛运动或简化版打卡。",
                  "下周优先控制最容易失衡的一餐，而不是试图同时修正所有餐次。",
                  "把一项最关键习惯固定到每天同一时段，减少随机执行成本。",
                ],
              },
            },
            weekRange,
            metrics
          )
        );
      }
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to build weekly analytics" });
    }
  });

  app.get("/api/logs/:date", (req, res) => {
    try {
      const rows = db.getLogs(USER_ID, req.params.date);
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch logs" });
    }
  });

  app.post("/api/logs/:type", (req, res) => {
    try {
      const body = req.body || {};
      const type = req.params.type === "exercise" ? "exercise" : "food";
      const { calories, protein, carbs, fats, grams, foodId, unitName, amount } = computeLogNutrition(body, type);

      const id = db.addLog({
        userId: USER_ID,
        date: body.date,
        type,
        foodId,
        name: body.name,
        amount,
        unitName,
        grams,
        calories,
        protein,
        carbs,
        fats,
      });
      res.json({ id });
    } catch (error) {
      const pe = toProxyError(error);
      res.status(pe.errorType === "business_parse_error" ? 400 : 500).json({ error: pe.message });
    }
  });

  app.put("/api/logs/:id", (req, res) => {
    try {
      const existing = db.getLogById(USER_ID, Number(req.params.id));
      if (!existing) {
        throw new AIProxyError("business_parse_error", "log not found");
      }
      const body = req.body || {};
      const type = body.type === "exercise" ? "exercise" : "food";
      const { calories, protein, carbs, fats, grams, foodId, unitName, amount } = computeLogNutrition(body, type);

      db.updateLog({
        id: Number(req.params.id),
        userId: USER_ID,
        date: String(body.date || existing.date),
        type,
        foodId,
        name: String(body.name || existing.name),
        amount,
        unitName,
        grams,
        calories,
        protein,
        carbs,
        fats,
      });
      res.json({ success: true });
    } catch (error) {
      const pe = toProxyError(error);
      res.status(pe.errorType === "business_parse_error" ? 400 : 500).json({ error: pe.message });
    }
  });

  app.delete("/api/logs/:id", (req, res) => {
    try {
      db.deleteLog(USER_ID, Number(req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete log" });
    }
  });

  app.get("/api/foods/search", async (req, res) => {
    const q = String(req.query.q || "").trim();
    const useAI = String(req.query.use_ai || "") === "1";
    if (!q) {
      res.json([]);
      return;
    }
    try {
      const found = db.searchFoods(USER_ID, q, 10).map(mapFoodForFrontend);
      if (found.length > 0) {
        res.json(found);
        return;
      }
      if (!useAI) {
        res.json([]);
        return;
      }
      const profile = db.getProfile(USER_ID);
      const taskProfile = resolveTaskModelProfile(profile);
      const ai = await runFoodLookupTask(taskProfile.textProvider, taskProfile.textModel, q, true);
      res.json(ai.data ? [ai.data] : []);
    } catch (error) {
      const response = toProxyError(error);
      res.status(response.errorType === "business_parse_error" ? 400 : 502).json({ error: response.message });
    }
  });

  app.post("/api/foods", (req, res) => {
    try {
      const body = req.body || {};
      const food = db.createOrUpdateFood({
        userId: USER_ID,
        name: body.name,
        caloriesPer100g: Number(body.calories || 0),
        proteinPer100g: Number(body.protein || 0),
        carbsPer100g: Number(body.carbs || 0),
        fatsPer100g: Number(body.fats || 0),
        cookingMethod: body.cooking_method || "",
        isEdible: body.is_edible !== false,
        source: "user",
        confidence: 100,
      });
      res.json({ id: food.id });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to add food" });
    }
  });

  app.get("/api/foods/:id", (req, res) => {
    try {
      const food = db.getFoodById(Number(req.params.id));
      if (!food) {
        throw new AIProxyError("business_parse_error", "food not found");
      }
      res.json(mapFoodForFrontend(food));
    } catch (error) {
      const pe = toProxyError(error);
      res.status(pe.errorType === "business_parse_error" ? 404 : 500).json({ error: pe.message });
    }
  });

  app.get("/api/units", (req, res) => {
    try {
      const foodId = req.query.food_id ? Number(req.query.food_id) : NaN;
      if (!Number.isFinite(foodId) || foodId <= 0) {
        throw new AIProxyError("business_parse_error", "food_id is required for unit lookup");
      }
      const units = db.getFoodUnitsByFoodId(foodId).map((u) => ({
        id: u.id,
        food_id: u.foodId,
        name: u.unitName,
        weight_g: u.gramsPerUnit,
        confidence: u.confidence,
      }));
      res.json(units);
    } catch (error) {
      const pe = toProxyError(error);
      res.status(pe.errorType === "business_parse_error" ? 400 : 500).json({ error: pe.message });
    }
  });

  app.post("/api/units", (req, res) => {
    try {
      const body = req.body || {};
      if (!Number(body.food_id)) {
        throw new AIProxyError("business_parse_error", "food_id is required when creating a unit");
      }
      const unit = db.upsertFoodUnit({
        foodId: Number(body.food_id),
        unitName: String(body.name),
        gramsPerUnit: Number(body.weight_g),
        isDefault: Boolean(body.is_default),
        source: "user",
        confidence: 100,
      });
      res.json({ id: unit.id });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to add unit" });
    }
  });

  app.delete("/api/units/:id", (req, res) => {
    try {
      db.deleteFoodUnit(Number(req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete unit" });
    }
  });

  app.get("/api/habits/today", (_req, res) => {
    try {
      const today = toDateOnly(new Date());
      const habits = db.listHabits(USER_ID);
      const items = habits.map((habit) => {
        const log = db.getHabitLog(USER_ID, habit.id, today);
        const streakLogs = db.listHabitLogsForHabitBeforeDate(USER_ID, habit.id, today, 366);
        return {
          habitId: habit.id,
          name: habit.name,
          icon: habit.icon,
          color: habit.color,
          status: log?.status || "pending",
          actualValue: log?.actualValue ?? 0,
          targetValue: habit.targetValue,
          unit: habit.unit,
          current_streak: computeCurrentStreak(streakLogs, today),
          date: today,
        };
      });

      const completed = items.filter((item) => item.status === "done").length;
      res.json({
        date: today,
        completed,
        total: items.length,
        rate: items.length ? Number((completed / items.length).toFixed(2)) : 0,
        habits: items,
      });
    } catch (error) {
      const pe = toProxyError(error);
      res.status(pe.errorType === "business_parse_error" ? 400 : 500).json({ error: pe.message });
    }
  });

  app.get("/api/habits", (_req, res) => {
    try {
      res.json(db.listHabits(USER_ID).map(mapHabitForFrontend));
    } catch (error) {
      const pe = toProxyError(error);
      res.status(pe.errorType === "business_parse_error" ? 400 : 500).json({ error: pe.message });
    }
  });

  app.post("/api/habits", (req, res) => {
    try {
      const body = req.body || {};
      if (!String(body.name || "").trim()) {
        throw new AIProxyError("business_parse_error", "habit name is required");
      }
      const id = db.createHabit({
        userId: USER_ID,
        name: String(body.name).trim(),
        icon: body.icon,
        color: body.color,
        frequencyType: body.frequencyType || "daily",
        frequencyValue: Number(body.frequencyValue ?? 1),
        targetValue: Number(body.targetValue ?? 1),
        unit: body.unit || "次",
        sortOrder: Number(body.sortOrder ?? Date.now()),
      });
      res.json({ id });
    } catch (error) {
      const pe = toProxyError(error);
      res.status(pe.errorType === "business_parse_error" ? 400 : 500).json({ error: pe.message });
    }
  });

  app.put("/api/habits/:id", (req, res) => {
    try {
      const habitId = Number(req.params.id);
      const existing = db.getHabitById(USER_ID, habitId);
      if (!existing) {
        throw new AIProxyError("business_parse_error", "habit not found");
      }
      const body = req.body || {};
      db.updateHabit({
        id: habitId,
        userId: USER_ID,
        name: String(body.name || existing.name).trim(),
        icon: body.icon || existing.icon,
        color: body.color || existing.color,
        frequencyType: body.frequencyType || existing.frequencyType,
        frequencyValue: Number(body.frequencyValue ?? existing.frequencyValue),
        targetValue: Number(body.targetValue ?? existing.targetValue),
        unit: body.unit || existing.unit,
        sortOrder: Number(body.sortOrder ?? existing.sortOrder),
      });
      res.json({ success: true });
    } catch (error) {
      const pe = toProxyError(error);
      res.status(pe.errorType === "business_parse_error" ? 400 : 500).json({ error: pe.message });
    }
  });

  app.patch("/api/habits/:id/archive", (req, res) => {
    try {
      const habitId = Number(req.params.id);
      const existing = db.getHabitById(USER_ID, habitId);
      if (!existing) {
        throw new AIProxyError("business_parse_error", "habit not found");
      }
      db.archiveHabit(USER_ID, habitId);
      res.json({ success: true });
    } catch (error) {
      const pe = toProxyError(error);
      res.status(pe.errorType === "business_parse_error" ? 400 : 500).json({ error: pe.message });
    }
  });

  app.post("/api/habits/:id/check-in", (req, res) => {
    try {
      const habitId = Number(req.params.id);
      const habit = db.getHabitById(USER_ID, habitId);
      if (!habit) {
        throw new AIProxyError("business_parse_error", "habit not found");
      }
      const date = String(req.body?.date || toDateOnly(new Date()));
      const status = String(req.body?.status || "done") as "pending" | "done" | "missed";
      if (!["pending", "done", "missed"].includes(status)) {
        throw new AIProxyError("business_parse_error", "invalid habit status");
      }
      db.upsertHabitLog({
        userId: USER_ID,
        habitId,
        date,
        status,
        actualValue: Number(req.body?.actualValue ?? (status === "done" ? habit.targetValue : 0)),
      });
      res.json({ success: true });
    } catch (error) {
      const pe = toProxyError(error);
      res.status(pe.errorType === "business_parse_error" ? 400 : 500).json({ error: pe.message });
    }
  });

  app.get("/api/habits/heatmap", (req, res) => {
    try {
      const days = Math.max(7, Math.min(365, Number(req.query.days || 90)));
      const { from, to } = buildDateRange(days);
      const habits = db.listAllHabits(USER_ID);
      const logs = db.listHabitLogsInRange(USER_ID, from, to);
      const totalHabits = habits.length;
      const map = new Map<string, { completed: number }>();

      for (const log of logs) {
        if (!map.has(log.date)) {
          map.set(log.date, { completed: 0 });
        }
        if (log.status === "done") {
          map.get(log.date)!.completed += 1;
        }
      }

      const cells = [];
      const cursor = new Date(from);
      const end = new Date(to);
      while (cursor <= end) {
        const date = toDateOnly(cursor);
        const completed = map.get(date)?.completed || 0;
        const rate = totalHabits > 0 ? completed / totalHabits : 0;
        cells.push({
          date,
          completed,
          total: totalHabits,
          rate: Number(rate.toFixed(2)),
          level: resolveHeatLevel(rate),
        });
        cursor.setDate(cursor.getDate() + 1);
      }

      res.json({
        from,
        to,
        days,
        cells,
      });
    } catch (error) {
      const pe = toProxyError(error);
      res.status(pe.errorType === "business_parse_error" ? 400 : 500).json({ error: pe.message });
    }
  });

  app.get("/api/habits/:id/history", (req, res) => {
    try {
      const habitId = Number(req.params.id);
      const days = Math.max(7, Math.min(365, Number(req.query.days || 30)));
      const habit = db.getHabitById(USER_ID, habitId);
      if (!habit) {
        throw new AIProxyError("business_parse_error", "habit not found");
      }
      const { from, to } = buildDateRangeEndingAt(days, new Date());
      const logs = db.listHabitLogsForHabit(USER_ID, habitId, from, to);
      const allLogs = db.listHabitLogsForHabitAll(USER_ID, habitId);
      const map = new Map(logs.map((log) => [log.date, log]));
      const points = [];
      const cursor = new Date(from);
      const end = new Date(to);
      while (cursor <= end) {
        const date = toDateOnly(cursor);
        const log = map.get(date);
        points.push({
          date,
          status: log?.status || "pending",
          value: log?.status === "done" ? 1 : 0,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      res.json({
        habit: mapHabitForFrontend(habit),
        from,
        to,
        days,
        max_streak: computeMaxStreak(allLogs),
        points,
      });
    } catch (error) {
      const pe = toProxyError(error);
      res.status(pe.errorType === "business_parse_error" ? 400 : 500).json({ error: pe.message });
    }
  });

  app.get("/api/body-metrics", (_req, res) => {
    try {
      const items = listBodyMetrics(USER_ID);
      res.json(items);
    } catch (error) {
      const pe = toProxyError(error);
      res.status(pe.errorType === "business_parse_error" ? 400 : 500).json({ error: pe.message });
    }
  });

  app.post("/api/body-metrics", (req, res) => {
    try {
      const item = createBodyMetric(USER_ID, req.body || {});
      res.json(item);
    } catch (error) {
      const pe = toProxyError(error);
      res.status(pe.errorType === "business_parse_error" ? 400 : 500).json({ error: pe.message });
    }
  });

  app.delete("/api/body-metrics/:id", (req, res) => {
    try {
      const result = deleteBodyMetric(USER_ID, Number(req.params.id));
      res.json(result);
    } catch (error) {
      const pe = toProxyError(error);
      res.status(pe.errorType === "business_parse_error" ? 404 : 500).json({ error: pe.message });
    }
  });

  app.get("/api/fasting/current", (_req, res) => {
    try {
      const current = getCurrentFastingStatus(USER_ID);
      res.json(current);
    } catch (error) {
      const pe = toProxyError(error);
      res.status(pe.errorType === "business_parse_error" ? 400 : 500).json({ error: pe.message });
    }
  });

  app.post("/api/fasting/start", (req, res) => {
    try {
      const result = startFasting(USER_ID, {
        planType: String(req.body?.plan_type || req.body?.planType || ""),
        startTime: req.body?.start_time || req.body?.startTime,
      });
      res.json(result);
    } catch (error) {
      const pe = toProxyError(error);
      res.status(pe.errorType === "business_parse_error" ? 400 : 500).json({ error: pe.message });
    }
  });

  app.post("/api/fasting/end", (req, res) => {
    try {
      const result = endFasting(USER_ID, {
        endTime: req.body?.actual_end_time || req.body?.actualEndTime,
      });
      res.json(result);
    } catch (error) {
      const pe = toProxyError(error);
      res.status(pe.errorType === "business_parse_error" ? 400 : 500).json({ error: pe.message });
    }
  });

  app.get("/api/backup", (req, res) => {
    try {
      const archive = archiver("zip", { zlib: { level: 9 } });
      res.attachment("fittrack-backup.zip");
      archive.pipe(res);
      archive.glob("**/*", {
        cwd: __dirname,
        ignore: ["node_modules/**", "dist/**", ".git/**", "db/*.db-journal"],
      });
      archive.finalize();
    } catch (error) {
      res.status(500).send("Backup failed");
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

