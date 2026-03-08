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
  type FoodExtractionResult,
  type ImageRecognitionResult,
  type TaskModelProfile,
  buildFoodExtractionPrompt,
  buildImageStructuringPrompt,
  buildVisionDescriptionPrompt,
  callProvider,
  defaultTaskModelProfile,
  parseJson,
} from "./src/server/aiService";
import { calculateNutritionFromWeight } from "./src/utils/nutritionCalculator";
import { createBodyMetric, deleteBodyMetric, listBodyMetrics } from "./src/server/bodyMetricsService";
import { endFasting, getCurrentFastingStatus, startFasting } from "./src/server/fastingService";

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

const resolveHeatLevel = (rate: number): 0 | 1 | 2 | 3 | 4 => {
  if (rate <= 0) return 0;
  if (rate <= 0.25) return 1;
  if (rate <= 0.5) return 2;
  if (rate <= 0.75) return 3;
  return 4;
};

const HEALTH_CHECK_IMAGE_BASE64 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAdSURBVDhPY3jv4vKfEsyALkAqHjVg1IBRAwaLAQDnAXYfiKSRsQAAAABJRU5ErkJggg==";

const buildFallbackImageRecognition = (reason: string): ImageRecognitionResult => ({
  primary_food_name: "AI 妯＄硦璇嗗埆椁愰",
  primary_food: "AI 妯＄硦璇嗗埆椁愰",
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
  analysis_report: {
    plate_comment: "这份餐食来自系统保底估算，建议在保存前校正实际重量与食材构成。",
    vegetables_fruits_ratio: 20,
    whole_grains_ratio: 25,
    healthy_protein_ratio: 20,
    gi_level: "medium",
    processing_level: "processed",
    strengths: ["提供了基础热量和三大营养素估算", "避免前端出现空白结果"],
    risks: ["蔬果比例偏低", "识别误差较大时健康评分仅供参考"],
    suggestions: ["补一份深色蔬菜", "主食优先换成全谷物", "保存前微调克数"],
    education_tip: "膳食平衡建议强调蔬菜和水果应占更高比例，土豆不计入蔬菜份额。",
  },
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

