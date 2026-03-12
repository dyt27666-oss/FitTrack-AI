import { LLMManager, type LLMConfig } from "../services/llmManager";

export type AIProvider = "gemini" | "zhipu" | "tongyi" | "silra";
export type ProxyErrorType = "network_error" | "model_error" | "business_parse_error";

export interface FoodExtractionResult {
  name: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fats_per_100g: number;
  cooking_method: string;
  is_edible: boolean;
  confidence: number;
  default_unit_name: string;
  grams_per_unit: number;
}

export interface FoodUnitSuggestionResult {
  unit_name: string;
  grams_per_unit: number;
  calories_per_unit: number;
  confidence: number;
  explanation?: string;
}

export interface ImageRecognitionCandidate {
  name: string;
  confidence: number;
  estimated_weight_g: number;
  estimated_calories: number;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fats_per_100g: number;
  is_edible: boolean;
}

export interface BalancedDietAnalysisReport {
  summary?: string;
  plate_comment: string;
  vegetables_fruits_ratio: number;
  whole_grains_ratio: number;
  healthy_protein_ratio: number;
  gi_level: "low" | "medium" | "high";
  processing_level: "minimally_processed" | "processed" | "ultra_processed";
  strengths: string[];
  weaknesses?: string[];
  risks: string[];
  improvements?: string[];
  suggestions: string[];
  reasoning?: string;
  education_tip: string;
}

export interface ImageRecognitionResult {
  primary_food_name?: string;
  primary_food: string;
  is_edible: boolean;
  confidence: number;
  estimated_weight_g: number;
  estimated_calories: number;
  estimated_protein_g: number;
  estimated_carbs_g: number;
  estimated_fats_g: number;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fats_per_100g: number;
  estimated_p_c_f?: {
    protein_ratio: number;
    carbs_ratio: number;
    fats_ratio: number;
  };
  health_score?: number;
  alert_level?: "green" | "yellow" | "red";
  analysis_report?: BalancedDietAnalysisReport;
  hint?: string;
  candidates: ImageRecognitionCandidate[];
}

export interface DailyHealthInsightResult {
  title: string;
  status_tag: string;
  summary: string;
  sections: {
    overview: string;
    energy: string;
    diet: string;
    nutrition: string;
    activity: string;
    discipline: string;
    risks: string;
    next_actions: string[];
  };
  metrics: {
    calories_in: number;
    calories_out: number;
    net_calories: number;
    protein_g: number;
    carbs_g: number;
    fats_g: number;
    habit_completion_rate: number;
    completed_habits: number;
    total_habits: number;
  };
}

export interface WeeklyHealthReportResult {
  title: string;
  status_tag: string;
  summary: string;
  week_range: string;
  sections: {
    overview: string;
    diet_trend: string;
    discipline_trend: string;
    high_risk_window: string;
    forecast: string;
    next_week_actions: string[];
  };
  metrics: {
    avg_calories_in: number;
    avg_calories_out: number;
    avg_net_calories: number;
    avg_habit_completion_rate: number;
    total_completed_habits: number;
    total_habits: number;
    max_streaks: Array<{
      habit_id: number;
      name: string;
      max_streak: number;
    }>;
  };
}

export class AIProxyError extends Error {
  constructor(public errorType: ProxyErrorType, message: string) {
    super(message);
    this.name = "AIProxyError";
  }
}

export interface TaskModelProfile {
  textProvider: AIProvider;
  textModel: string;
  visionProvider: AIProvider;
  visionModel: string;
}

export const defaultTaskModelProfile: TaskModelProfile = {
  textProvider: "silra",
  textModel: process.env.SILRA_TEXT_MODEL || "deepseek-v3",
  visionProvider: "tongyi",
  visionModel: process.env.TONGYI_VISION_MODEL || "qwen-vl-plus",
};

export const classifyProxyError = (error: unknown): ProxyErrorType => {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof TypeError || /network|fetch|timeout|ECONN|ENOTFOUND|socket|TLS|abort/i.test(message)) {
    return "network_error";
  }
  return "model_error";
};

export const resolveApiKey = (provider: AIProvider): string | undefined => {
  switch (provider) {
    case "gemini":
      return process.env.GEMINI_API_KEY;
    case "zhipu":
      return process.env.ZHIPU_API_KEY;
    case "tongyi":
      return process.env.TONGYI_API_KEY;
    case "silra":
      return process.env.SILRA_API_KEY;
    default:
      return undefined;
  }
};

export const resolveBaseUrl = (provider: AIProvider): string | undefined => {
  switch (provider) {
    case "gemini":
      return process.env.GEMINI_BASE_URL;
    case "zhipu":
      return process.env.ZHIPU_BASE_URL;
    case "tongyi":
      return process.env.TONGYI_BASE_URL;
    case "silra":
      return process.env.SILRA_BASE_URL || "https://api.silra.cn/v1";
    default:
      return undefined;
  }
};

const maskKey = (key?: string): string => {
  if (!key) return "missing";
  if (key.length < 10) return `${key.slice(0, 2)}***${key.slice(-2)}`;
  return `${key.slice(0, 4)}***${key.slice(-4)}`;
};

const normalizeModel = (provider: AIProvider, inputModel: string, isVision: boolean): string => {
  const isVisionModel = (model?: string) => {
    if (!model) return false;
    const lowered = model.toLowerCase();
    return (
      lowered.includes("vl") ||
      lowered.includes("4.5v") ||
      lowered.includes("4v") ||
      lowered.includes("vision") ||
      lowered.includes("image") ||
      lowered.includes("gemini-3.1-pro-preview")
    );
  };
  if (provider === "zhipu") {
    return isVision
      ? inputModel || process.env.ZHIPU_VISION_MODEL || "glm-4.5v"
      : inputModel || process.env.ZHIPU_TEXT_MODEL || "glm-4";
  }
  if (provider === "tongyi") {
    if (!inputModel || inputModel.startsWith("gemini") || inputModel.startsWith("glm") || inputModel.startsWith("deepseek")) {
      return isVision
        ? process.env.TONGYI_VISION_MODEL || "qwen-vl-plus"
        : process.env.TONGYI_TEXT_MODEL || "qwen-mt-plus";
    }
    return inputModel;
  }
  if (provider === "silra") {
    if (isVision) {
      if (!isVisionModel(inputModel)) {
        return process.env.SILRA_VISION_MODEL || "qwen-vl-plus";
      }
      return inputModel || process.env.SILRA_VISION_MODEL || "qwen-vl-plus";
    }
    return inputModel || process.env.SILRA_TEXT_MODEL || "deepseek-v3";
  }
  if (!inputModel || inputModel.startsWith("glm") || inputModel.startsWith("qwen") || inputModel.startsWith("deepseek")) {
    return isVision ? "gemini-2.5-pro" : "gemini-2.5-flash";
  }
  return inputModel;
};

export const callProvider = async (input: {
  provider: AIProvider;
  model: string;
  prompt: string;
  systemInstruction?: string;
  imageBase64?: string;
}): Promise<string> => {
  const apiKey = resolveApiKey(input.provider);
  if (!apiKey) {
    throw new AIProxyError("business_parse_error", `Missing API key for provider: ${input.provider}`);
  }

  const baseUrl = resolveBaseUrl(input.provider);
  const normalizedModel = normalizeModel(input.provider, input.model, Boolean(input.imageBase64));

  console.log(
    `[AIProxy] provider=${input.provider} model=${normalizedModel} baseUrl=${baseUrl || "(default)"} key=${maskKey(apiKey)}`
  );

  const config: LLMConfig = {
    provider: input.provider,
    model: normalizedModel,
    apiKey,
    baseUrl,
  };

  try {
    const llm = LLMManager.createProvider(config);
    return await llm.generate(input.prompt, input.systemInstruction, input.imageBase64);
  } catch (error) {
    throw new AIProxyError(classifyProxyError(error), error instanceof Error ? error.message : "Unknown AI error");
  }
};

export const parseJson = <T>(raw: string): T => {
  const match = raw.match(/\{[\s\S]*\}/);
  try {
    return JSON.parse(match ? match[0] : raw) as T;
  } catch (error) {
    throw new AIProxyError(
      "business_parse_error",
      `Failed to parse AI JSON: ${error instanceof Error ? error.message : "Unknown parse error"}`
    );
  }
};

export const buildFoodExtractionPrompt = (
  foodName: string
): { prompt: string; systemInstruction: string } => ({
  prompt: `Estimate nutrition for "${foodName}" per 100g. Infer calories, protein, carbs, fats, and one common serving unit with grams_per_unit.`,
  systemInstruction:
    "You are a nutrition database assistant. Return valid JSON only. Required fields: name, calories_per_100g, protein_per_100g, carbs_per_100g, fats_per_100g, cooking_method, is_edible, confidence, default_unit_name, grams_per_unit. All nutrition fields must be numeric and must never be omitted.",
});

export const buildFoodUnitSuggestionPrompt = (
  foodName: string,
  unitName: string,
  caloriesPer100g: number
): { prompt: string; systemInstruction: string } => ({
  prompt: `请为食物“${foodName}”估算单位“${unitName}”对应的克数和热量。已知该食物每100g约 ${caloriesPer100g} kcal。`,
  systemInstruction:
    "你是一名营养数据库助手。只输出严格 JSON，字段必须包含：unit_name, grams_per_unit, calories_per_unit, confidence, explanation。grams_per_unit 和 calories_per_unit 必须为正数；calories_per_unit 应与已知每100g热量大体一致。若单位存在不确定性，也必须给出保守估算，不要拒答。",
});

export const buildVisionDescriptionPrompt = (): { prompt: string; systemInstruction: string } => ({
  prompt:
    "请详细描述图片中的食物名称、大致分量、烹饪方式、是否可食用，以及你看到的关键食材。不要输出 JSON，不要省略细节，直接用自然中文描述。",
  systemInstruction:
    "你是一个食物视觉识别助手。请专注于视觉事实：食物名称、估计分量、烹饪方式、摆盘和明显食材。如果图片模糊，也必须给出一个合理的中文描述，默认按未知混合餐食处理。",
});

export const buildImageStructuringPrompt = (
  visionDescription: string
): { prompt: string; systemInstruction: string } => ({
  prompt: `请基于以下视觉描述，输出严格 JSON：\n${visionDescription}`,
  systemInstruction:
    '你是一名营养分析师。你的任务是把视觉模型返回的中文描述整理成严格 JSON。必须输出这些字段：primary_food_name, primary_food, is_edible, confidence, estimated_weight_g, estimated_calories, estimated_protein_g, estimated_carbs_g, estimated_fats_g, calories_per_100g, protein_per_100g, carbs_per_100g, fats_per_100g, estimated_p_c_f, health_score, alert_level, analysis_report, hint, candidates。alert_level 必须是 green/yellow/red 之一。health_score 必须是 1-100 整数。analysis_report 必须包含：summary, plate_comment, vegetables_fruits_ratio, whole_grains_ratio, healthy_protein_ratio, gi_level, processing_level, strengths, weaknesses, improvements, reasoning, education_tip。summary 必须是 2 句、60-120 个中文字符的总体摘要；plate_comment 必须是 1 段更完整的分析，至少 120 个中文字符，明确说明餐盘结构、烹饪方式、热量来源和主要问题；strengths 至少 3 条，每条都要具体，不能只写“较好”“还行”；weaknesses 至少 3 条，每条都要具体指出不足；improvements 至少 4 条，必须是可执行动作，例如增加什么、减少什么、替换成什么；reasoning 必须是 100-180 个中文字符，解释你为什么给出这个分数和灯色。严格按膳食平衡建议定义：蔬菜+水果目标 50%，全谷物 25%，健康蛋白 25%；土豆不计入蔬菜；精制谷物不计入全谷物；炸鸡、加工肉、含糖饮料、包装零食应视为低质量或超加工食品。绝对禁止输出无法识别、拒答、空字段。若描述不充分，请按未知混合餐食给出保底估算。只输出 JSON。',
});

export const buildImageRecognitionPrompt = (): { prompt: string; systemInstruction: string } => ({
  prompt:
    "Identify the food in this image and estimate nutrition. Absolute rule: you must never reply with 'cannot identify', 'unknown', 'I don't know', or any refusal. If the image is blurry or ambiguous, default to '未知混合餐食 (Mixed Meal)' and force an estimate using the visible volume. You must still output estimated_weight_g, estimated_calories, estimated_protein_g, estimated_carbs_g, estimated_fats_g, estimated_p_c_f, health_score, alert_level, and analysis_report based on balanced diet guidance. Return JSON only.",
  systemInstruction:
    'You are a multimodal nutrition analyst. If Chinese dishes are ambiguous, ground estimates in recent Chinese web restaurant nutrition data. Return valid JSON only. Absolute prohibition: never output any refusal such as "无法识别", "不知道", "cannot identify", or empty content. If uncertain, use primary_food_name="未知混合餐食 (Mixed Meal)" and infer from visible portion size. Required top-level fields: primary_food_name, primary_food, is_edible, confidence, estimated_weight_g, estimated_calories, estimated_protein_g, estimated_carbs_g, estimated_fats_g, calories_per_100g, protein_per_100g, carbs_per_100g, fats_per_100g, estimated_p_c_f, health_score, alert_level, analysis_report, hint, candidates. hint must explain uncertainty in one short Chinese sentence. estimated_p_c_f must be an object with protein_ratio, carbs_ratio, fats_ratio. alert_level must be one of green, yellow, red. health_score must be an integer from 1 to 100. analysis_report must include: summary, plate_comment, vegetables_fruits_ratio, whole_grains_ratio, healthy_protein_ratio, gi_level, processing_level, strengths, weaknesses, improvements, reasoning, education_tip. summary must be two full Chinese sentences, not bullet fragments. plate_comment must be a detailed paragraph, at least 120 Chinese characters, discussing plate balance, cooking method, calorie sources, likely glycemic load, processing level, and the biggest diet issue. strengths must contain at least 3 concrete points. weaknesses must contain at least 3 concrete points and avoid vague wording. improvements must contain at least 4 specific and actionable suggestions. reasoning must be a 100-180 character explanation of why the health_score and alert_level were assigned. Apply balanced diet guidance strictly: vegetables + fruits target 50%, whole grains 25%, healthy protein 25%; potatoes do NOT count as vegetables because of glycemic impact; refined grains do NOT count as whole grains; fried chicken, processed meat, sugary drinks and packaged snacks should be treated as poor-quality or ultra-processed. If the provider supports web grounding, use recent Chinese internet nutrition references when estimating unfamiliar dishes. candidates must be a non-empty array. Every candidate must include: name, confidence, estimated_weight_g, estimated_calories, calories_per_100g, protein_per_100g, carbs_per_100g, fats_per_100g, is_edible. Do not leave estimated fields blank even when confidence is low.',
});

export const buildDailyHolisticInsightPrompt = (payload: {
  date: string;
  profile: {
    goal?: string;
    goalCalories?: number;
    sex?: string;
    age?: number;
    heightCm?: number;
    weightKg?: number;
  };
  foods: Array<{
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    amount: number;
    unit_name?: string | null;
  }>;
  exercises: Array<{
    name: string;
    calories: number;
    amount: number;
  }>;
  habits: Array<{
    name: string;
    status: "pending" | "done" | "missed";
    current_streak: number;
  }>;
  metrics: DailyHealthInsightResult["metrics"];
}) => ({
  prompt: `请基于以下今日健康数据生成结构化中文日报。\n日期: ${payload.date}\n用户档案: ${JSON.stringify(
    payload.profile,
    null,
    2
  )}\n今日饮食: ${JSON.stringify(payload.foods, null, 2)}\n今日运动: ${JSON.stringify(
    payload.exercises,
    null,
    2
  )}\n今日自律: ${JSON.stringify(payload.habits, null, 2)}\n今日汇总指标: ${JSON.stringify(payload.metrics, null, 2)}`,
  systemInstruction:
    '你是一名严谨的健康行为分析师。你的任务是分析用户“今天”截至当前的饮食、运动和自律状态，并给出今天剩余时间的具体策略。只输出严格 JSON。字段必须包含：title, status_tag, summary, sections, metrics。sections 必须包含 overview, energy, diet, nutrition, activity, discipline, risks, next_actions。summary 必须是 2-3 句完整中文，总结今天的状态。overview 必须是完整段落，讲清今天总体节奏。energy 必须分析热量收支和平衡。diet 必须分析今天实际吃了什么，不要只讲理论。nutrition 必须分析蛋白质、碳水、脂肪结构。activity 必须结合运动或缺失的活动量。discipline 必须结合习惯完成率和 current_streak。risks 必须指出 1-3 个最值得警惕的问题。next_actions 至少 4 条，且必须具体到“下一餐 / 下午 / 晚上”这一粒度。文风要像专业健康管理日报，不要像闲聊，不要输出 markdown。',
});

export const buildWeeklyHealthReportPrompt = (payload: {
  weekRange: string;
  profile: {
    goal?: string;
    goalCalories?: number;
    sex?: string;
    age?: number;
    heightCm?: number;
    weightKg?: number;
  };
  dailyNutrition: Array<Record<string, unknown>>;
  dailyDiscipline: Array<Record<string, unknown>>;
  maxStreaks: WeeklyHealthReportResult["metrics"]["max_streaks"];
  weeklyMetrics: WeeklyHealthReportResult["metrics"];
}) => ({
  prompt: `请基于以下一周健康数据生成结构化中文周报。\n周范围: ${payload.weekRange}\n用户档案: ${JSON.stringify(
    payload.profile,
    null,
    2
  )}\n饮食趋势: ${JSON.stringify(payload.dailyNutrition, null, 2)}\n自律趋势: ${JSON.stringify(
    payload.dailyDiscipline,
    null,
    2
  )}\n最长连胜: ${JSON.stringify(payload.maxStreaks, null, 2)}\n周汇总指标: ${JSON.stringify(
    payload.weeklyMetrics,
    null,
    2
  )}`,
  systemInstruction:
    '你是一名健康数据分析顾问。你要给用户提供一份真正有复盘价值的一周健康周报。只输出严格 JSON。字段必须包含：title, status_tag, summary, week_range, sections, metrics。sections 必须包含 overview, diet_trend, discipline_trend, high_risk_window, forecast, next_week_actions。status_tag 要像“代谢加速期”“恢复调整期”“结构失衡期”这样可读。overview 必须是完整段落。diet_trend 必须分析饮食结构和热量趋势，不要只给均值。discipline_trend 必须分析完成率波动和习惯连胜变化。high_risk_window 必须指出最容易断更或失控的时段、日期或情境。forecast 必须预测下周健康状态走向。next_week_actions 至少 4 条，且要体现阈值调节思路，例如降低门槛、调整执行时段、替换触发场景。不要输出 markdown，不要输出空话。',
});
