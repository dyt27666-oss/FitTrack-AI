import type {
  AIHealthCheckSummary,
  BalancedDietAnalysisReport,
  CalorieEstimation,
  DailyHealthInsightReport,
  Habit,
  HabitHistorySeries,
  HabitHeatmapCell,
  HabitHistoryPoint,
  HabitTodayItem,
  WeeklyHealthReport,
} from "../types";

export type AIProvider = "gemini" | "zhipu" | "tongyi" | "silra";
export type AIErrorType = "network_error" | "model_error" | "business_parse_error";

export interface FoodCandidate {
  name: string;
  confidence: number;
  estimated_weight_g: number;
  estimated_calories: number;
  calories_per_100g: number;
  protein_per_100g?: number;
  carbs_per_100g?: number;
  fats_per_100g?: number;
  is_edible?: boolean;
}

export interface FoodImageRecognition {
  primary_food_name?: string;
  primary_food: string;
  is_edible: boolean;
  confidence: number;
  estimated_weight_g: number;
  estimated_calories: number;
  estimated_protein_g: number;
  estimated_carbs_g: number;
  estimated_fats_g: number;
  estimated_p_c_f?: {
    protein_ratio: number;
    carbs_ratio: number;
    fats_ratio: number;
  };
  hint?: string;
  calories_per_100g: number;
  protein_per_100g?: number;
  carbs_per_100g?: number;
  fats_per_100g?: number;
  health_score?: number;
  alert_level?: "green" | "yellow" | "red";
  analysis_report?: BalancedDietAnalysisReport;
  candidates: FoodCandidate[];
}

interface AIGenerateSuccessResponse {
  ok: true;
  task?: string;
  source?: "cache" | "ai";
  text?: string;
  data?: unknown;
}

interface AIGenerateErrorResponse {
  ok: false;
  errorType: AIErrorType;
  message: string;
}

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

const normalizeStringArray = (value: unknown, fallback: string[]): string[] => {
  if (!Array.isArray(value)) return fallback;
  const next = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return next.length ? next : fallback;
};

const normalizeBalancedDietAnalysisReport = (
  report: BalancedDietAnalysisReport | null | undefined
): BalancedDietAnalysisReport => ({
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

const normalizeTextBlock = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim() ? value : fallback;

const normalizeDailyHealthInsight = (report: Partial<DailyHealthInsightReport> | null | undefined): DailyHealthInsightReport => ({
  title: normalizeTextBlock(report?.title, "今日健康洞察"),
  status_tag: normalizeTextBlock(report?.status_tag, "稳态管理日"),
  summary: normalizeTextBlock(report?.summary, "系统已生成今日健康洞察，可结合饮食、运动和自律记录做当日调整。"),
  sections: {
    overview: normalizeTextBlock(report?.sections?.overview, "今天的记录已经可以支持一份基础健康判断，但仍建议持续补全晚餐、活动和习惯完成情况。"),
    energy: normalizeTextBlock(report?.sections?.energy, "当前热量收支分析仍以已记录数据为准，若晚间仍有进食或运动，请以实时更新后的结果复核。"),
    diet: normalizeTextBlock(report?.sections?.diet, "系统会基于今天已记录食物继续分析餐盘结构和主要热量来源。"),
    nutrition: normalizeTextBlock(report?.sections?.nutrition, "蛋白质、碳水和脂肪的结构判断需要结合全天摄入持续修正。"),
    activity: normalizeTextBlock(report?.sections?.activity, "今天的活动建议会结合运动记录和当前自律状态综合生成。"),
    discipline: normalizeTextBlock(report?.sections?.discipline, "今天的习惯完成率和连胜状态会影响后续建议强度。"),
    risks: normalizeTextBlock(report?.sections?.risks, "若记录不完整，系统会以保守方式提示潜在风险。"),
    next_actions: normalizeStringArray(report?.sections?.next_actions, ["先补全今天剩余记录，再根据系统建议调整下一餐。"]),
  },
  metrics: {
    calories_in: typeof report?.metrics?.calories_in === "number" ? report.metrics.calories_in : 0,
    calories_out: typeof report?.metrics?.calories_out === "number" ? report.metrics.calories_out : 0,
    net_calories: typeof report?.metrics?.net_calories === "number" ? report.metrics.net_calories : 0,
    protein_g: typeof report?.metrics?.protein_g === "number" ? report.metrics.protein_g : 0,
    carbs_g: typeof report?.metrics?.carbs_g === "number" ? report.metrics.carbs_g : 0,
    fats_g: typeof report?.metrics?.fats_g === "number" ? report.metrics.fats_g : 0,
    habit_completion_rate: typeof report?.metrics?.habit_completion_rate === "number" ? report.metrics.habit_completion_rate : 0,
    completed_habits: typeof report?.metrics?.completed_habits === "number" ? report.metrics.completed_habits : 0,
    total_habits: typeof report?.metrics?.total_habits === "number" ? report.metrics.total_habits : 0,
  },
});

const normalizeWeeklyHealthReport = (report: Partial<WeeklyHealthReport> | null | undefined): WeeklyHealthReport => ({
  title: normalizeTextBlock(report?.title, "本周健康周报"),
  status_tag: normalizeTextBlock(report?.status_tag, "恢复调整期"),
  summary: normalizeTextBlock(report?.summary, "系统已生成本周健康周报，可用于复盘饮食、自律和行为波动。"),
  week_range: normalizeTextBlock(report?.week_range, ""),
  sections: {
    overview: normalizeTextBlock(report?.sections?.overview, "本周已有基础健康数据，可继续结合更完整的饮食和习惯记录提升判断准确度。"),
    diet_trend: normalizeTextBlock(report?.sections?.diet_trend, "系统会基于一周热量与宏量营养素波动分析饮食趋势。"),
    discipline_trend: normalizeTextBlock(report?.sections?.discipline_trend, "系统会结合习惯完成率和连胜数据分析自律趋势。"),
    high_risk_window: normalizeTextBlock(report?.sections?.high_risk_window, "当前高危时段判断仍以已记录数据为准。"),
    forecast: normalizeTextBlock(report?.sections?.forecast, "下周预测会基于本周行为波动和完成率趋势生成。"),
    next_week_actions: normalizeStringArray(report?.sections?.next_week_actions, ["下周先保持记录完整，再做阈值和时段优化。"]),
  },
  metrics: {
    avg_calories_in: typeof report?.metrics?.avg_calories_in === "number" ? report.metrics.avg_calories_in : 0,
    avg_calories_out: typeof report?.metrics?.avg_calories_out === "number" ? report.metrics.avg_calories_out : 0,
    avg_net_calories: typeof report?.metrics?.avg_net_calories === "number" ? report.metrics.avg_net_calories : 0,
    avg_habit_completion_rate:
      typeof report?.metrics?.avg_habit_completion_rate === "number" ? report.metrics.avg_habit_completion_rate : 0,
    total_completed_habits:
      typeof report?.metrics?.total_completed_habits === "number" ? report.metrics.total_completed_habits : 0,
    total_habits: typeof report?.metrics?.total_habits === "number" ? report.metrics.total_habits : 0,
    max_streaks: Array.isArray(report?.metrics?.max_streaks) ? report.metrics.max_streaks : [],
  },
});

class AIServiceError extends Error {
  constructor(public errorType: AIErrorType, message: string) {
    super(message);
    this.name = "AIServiceError";
  }
}

async function callGenerate(payload: AIGenerateRequest): Promise<AIGenerateSuccessResponse> {
  let response: Response;
  try {
    response = await fetch("/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new AIServiceError("network_error", error instanceof Error ? error.message : "Network request failed");
  }

  const json = (await response.json()) as AIGenerateSuccessResponse | AIGenerateErrorResponse;
  if (!response.ok || !json.ok) {
    const err = json as AIGenerateErrorResponse;
    throw new AIServiceError(err.errorType || "model_error", err.message || "AI provider returned an error");
  }
  return json as AIGenerateSuccessResponse;
}

function parseJsonWithGuard<T>(raw: string): T {
  const match = raw.match(/\{[\s\S]*\}/);
  try {
    return JSON.parse(match ? match[0] : raw) as T;
  } catch (error) {
    throw new AIServiceError(
      "business_parse_error",
      `Failed to parse JSON: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((json as { error?: string }).error || "Request failed");
  }
  return json as T;
}

export async function estimateCalories(
  profile: { weight?: number; weightKg?: number } | null,
  query: string,
  type: "food" | "exercise",
  amount?: number
): Promise<CalorieEstimation | null> {
  const prompt =
    type === "food"
      ? `请估算食物“${query}”在 ${amount || 100} 克条件下的营养，返回热量、蛋白质、碳水、脂肪。`
      : `请估算运动“${query}”持续 ${amount || 30} 分钟的热量消耗，用户体重 ${profile?.weight || profile?.weightKg || 70}kg。`;
  const systemInstruction =
    "只输出 JSON。食物字段：calories, protein, carbs, fats, confidence, explanation。运动字段：calories, confidence, explanation。";

  try {
    const result = await callGenerate({
      task: "generic",
      prompt,
      systemInstruction,
    });
    if (!result.text) return null;
    return parseJsonWithGuard<CalorieEstimation>(result.text);
  } catch (error) {
    console.error("AI estimation failed", error);
    return null;
  }
}

export async function analyzeFoodImage(_profile: unknown, base64Image: string): Promise<CalorieEstimation | null> {
  const fallback: CalorieEstimation = {
    name: "AI 模糊识别餐食",
    calories: 300,
    weight: 200,
    confidence: 35,
    is_edible: true,
    protein: 10,
    carbs: 30,
    fats: 15,
    explanation: "由于图片模糊或网络超时，此为系统默认估算值，请手动微调。",
    health_score: 58,
    alert_level: "yellow",
    analysis_report: normalizeBalancedDietAnalysisReport({
      summary: "系统已提供一份可直接使用的保底分析。这份结果适合在保存记录前先做方向性判断，再结合真实分量微调。",
      plate_comment: "系统当前采用保底估算，因此更适合帮你快速判断这顿饭的大方向是否均衡，而不是替代精确称重。按这份默认结果看，主能量来源仍以主食和复合餐食中的碳水为主，蔬菜和水果比例偏低，蛋白质质量也存在不确定性。如果你准备正式记账，最好先确认份量、烹饪方式和是否包含额外用油或酱料。",
      vegetables_fruits_ratio: 20,
      whole_grains_ratio: 25,
      healthy_protein_ratio: 20,
      gi_level: "medium",
      processing_level: "processed",
      strengths: ["即使图片不清晰，系统仍给出了可继续操作的热量和三大营养素估算。", "这份结果至少能帮助你快速判断这顿饭是否明显偏主食或偏油。", "卡片内容可以直接作为保存前微调的起点，避免出现完全空白的记录页。"],
      weaknesses: ["当前分析高度依赖保底估算，因此真实克数和热量误差可能明显偏大。", "蔬菜、水果和优质蛋白的结构信息不完整，餐盘平衡判断更保守。", "如果实际存在油炸、浓酱或额外配菜，当前结果通常会低估热量密度。"],
      risks: ["当前分析高度依赖保底估算，因此真实克数和热量误差可能明显偏大。", "蔬菜、水果和优质蛋白的结构信息不完整，餐盘平衡判断更保守。", "如果实际存在油炸、浓酱或额外配菜，当前结果通常会低估热量密度。"],
      improvements: ["先确认这份餐食的大致重量，至少把克数调到接近真实份量后再保存。", "如果这是正餐，建议额外补一份深色蔬菜，提高蔬果占比。", "如果主食明显偏精制碳水，可以考虑在下一餐替换成糙米、全麦或杂粮。", "如果蛋白质来源不明确，建议搭配鸡蛋、豆制品、鱼或瘦肉来提高优质蛋白比例。"],
      suggestions: ["先确认这份餐食的大致重量，至少把克数调到接近真实份量后再保存。", "如果这是正餐，建议额外补一份深色蔬菜，提高蔬果占比。", "如果主食明显偏精制碳水，可以考虑在下一餐替换成糙米、全麦或杂粮。", "如果蛋白质来源不明确，建议搭配鸡蛋、豆制品、鱼或瘦肉来提高优质蛋白比例。"],
      reasoning: "这次评分偏保守，不是因为这顿饭一定很差，而是因为系统在图像信息不足时会优先降低乐观判断。当前看到的结构更像是主食占比偏高、蔬果不足、蛋白质信息不完整的一餐，所以健康分不会给得太高。",
      education_tip: "膳食平衡建议更关注长期结构，而不只是单次热量高低。真正影响状态的，通常是蔬果是否稳定充足、主食是否过度精制、蛋白质来源是否优质，以及烹饪方式是否长期偏油偏加工。",
    }),
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
  };

  try {
    const result = await callGenerate({
      task: "image_recognition",
      imageBase64: base64Image,
    });

    const data = result.data as FoodImageRecognition;
    if (!data || typeof data.confidence !== "number") return fallback;

    return {
      name: data.primary_food_name || data.primary_food,
      calories: data.estimated_calories,
      weight: data.estimated_weight_g,
      confidence: data.confidence,
      is_edible: data.is_edible,
      candidates: data.candidates || [],
      protein: data.estimated_protein_g || 0,
      carbs: data.estimated_carbs_g || 0,
      fats: data.estimated_fats_g || 0,
      explanation: data.hint,
      health_score: data.health_score,
      alert_level: data.alert_level,
      analysis_report: normalizeBalancedDietAnalysisReport(data.analysis_report),
    };
  } catch (error) {
    console.error("AI image analysis failed", error);
    return fallback;
  }
}

export async function searchFoods(query: string, useAI = true) {
  const suffix = useAI ? "&use_ai=1" : "";
  const res = await fetch(`/api/foods/search?q=${encodeURIComponent(query)}${suffix}`);
  return (await res.json()) as Array<Record<string, unknown>>;
}

export async function generateDailyAdvice(logs: Array<Record<string, unknown>>, profile: Record<string, unknown>): Promise<string> {
  const summary = logs
    .map((log) => `${log.type === "food" ? "饮食" : "运动"}:${log.name}, ${log.calories}kcal, P${log.protein || 0} C${log.carbs || 0} F${log.fats || 0}`)
    .join("\n");
  const prompt = `用户信息: ${JSON.stringify({
    age: profile?.age,
    sex: profile?.sex || profile?.gender,
    heightCm: profile?.heightCm || profile?.height,
    weightKg: profile?.weightKg || profile?.weight,
    goal: profile?.goal,
    goalCalories: profile?.goalCalories || profile?.goal_calories,
  })}\n日志:\n${summary}\n请给出简洁的中文建议。`;

  try {
    const result = await callGenerate({
      task: "generic",
      prompt,
    });
    return result.text || "建议生成为空";
  } catch (error) {
    return `建议生成失败: ${error instanceof Error ? error.message : "未知错误"}`;
  }
}

export async function fetchDailyHealthInsight(date?: string): Promise<DailyHealthInsightReport> {
  const suffix = date ? `?date=${encodeURIComponent(date)}` : "";
  const json = await requestJson<Partial<DailyHealthInsightReport>>(`/api/analytics/daily${suffix}`);
  return normalizeDailyHealthInsight(json);
}

export async function fetchWeeklyHealthReport(): Promise<WeeklyHealthReport> {
  const json = await requestJson<Partial<WeeklyHealthReport>>("/api/analytics/weekly");
  return normalizeWeeklyHealthReport(json);
}

export async function healthCheckEngines(): Promise<AIHealthCheckSummary> {
  try {
    return await requestJson<AIHealthCheckSummary>("/api/health");
  } catch (error) {
    return {
      ok: false,
      text: {
        kind: "text",
        provider: "unknown",
        model: "unknown",
        ok: false,
        errorType: "network_error",
        message: error instanceof Error ? error.message : "Network request failed",
      },
      vision: {
        kind: "vision",
        provider: "unknown",
        model: "unknown",
        ok: false,
        errorType: "network_error",
        message: error instanceof Error ? error.message : "Network request failed",
      },
    };
  }
}

export async function lookupFoodByAI(_profile: unknown, query: string) {
  const result = await callGenerate({
    task: "food_lookup",
    query,
    useCache: true,
  });
  return result.data;
}

export async function fetchTodayHabits(): Promise<{
  date: string;
  completed: number;
  total: number;
  rate: number;
  habits: HabitTodayItem[];
}> {
  return requestJson("/api/habits/today");
}

export async function checkInHabit(habitId: number, status: "pending" | "done" | "missed") {
  return requestJson(`/api/habits/${habitId}/check-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export async function fetchHabitHeatmap(days = 90): Promise<HabitHeatmapCell[]> {
  const json = await requestJson<{ cells?: HabitHeatmapCell[] }>(`/api/habits/heatmap?days=${days}`);
  return Array.isArray(json.cells) ? json.cells : [];
}

export async function createHabit(payload: {
  name: string;
  icon?: string;
  color?: string;
  frequencyType?: "daily" | "weekly";
  frequencyValue?: number;
  targetValue?: number;
  unit?: string;
}) {
  return requestJson<{ id: number }>("/api/habits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateHabit(
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
) {
  return requestJson<{ success: true }>(`/api/habits/${habitId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function archiveHabit(habitId: number) {
  return requestJson<{ success: true }>(`/api/habits/${habitId}/archive`, {
    method: "PATCH",
  });
}

export async function fetchHabitHistory(habitId: number, days = 30): Promise<HabitHistorySeries> {
  const json = await requestJson<{ points?: HabitHistoryPoint[]; max_streak?: number }>(`/api/habits/${habitId}/history?days=${days}`);
  return {
    points: Array.isArray(json.points) ? json.points : [],
    max_streak: typeof json.max_streak === "number" ? json.max_streak : 0,
  };
}

export async function fetchHabits(): Promise<Habit[]> {
  return requestJson<Habit[]>("/api/habits");
}


