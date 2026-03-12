import crypto from "crypto";
import { AIProxyError, callProvider, parseJson, type AIProvider } from "./aiService";
import { db } from "./db";

export interface VoiceExtractCandidate {
  id: string;
  type: "food" | "exercise";
  name: string;
  amount: number;
  unit: string | null;
  calories: number;
  parsed_time: string;
  confidence?: number;
  explanation?: string;
  food_id?: number | null;
  protein?: number;
  carbs?: number;
  fats?: number;
}

interface RawVoiceCandidate {
  type: "food" | "exercise";
  name: string;
  amount: number;
  unit?: string | null;
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  confidence?: number;
  explanation?: string;
  time_phrase?: string;
}

interface VoiceExtractResult {
  candidates: RawVoiceCandidate[];
}

const COMMON_FOOD_ESTIMATES: Record<
  string,
  { canonical: string; unit: string; amount: number; calories: number; protein: number; carbs: number; fats: number }
> = {
  鸡蛋: { canonical: "鸡蛋", unit: "个", amount: 1, calories: 78, protein: 6.3, carbs: 0.6, fats: 5.3 },
  苹果: { canonical: "苹果", unit: "个", amount: 1, calories: 52, protein: 0.3, carbs: 14, fats: 0.2 },
  橙: { canonical: "橙子", unit: "个", amount: 1, calories: 62, protein: 1.2, carbs: 15.4, fats: 0.2 },
  橙子: { canonical: "橙子", unit: "个", amount: 1, calories: 62, protein: 1.2, carbs: 15.4, fats: 0.2 },
  香蕉: { canonical: "香蕉", unit: "根", amount: 1, calories: 105, protein: 1.3, carbs: 27, fats: 0.3 },
  梨: { canonical: "梨", unit: "个", amount: 1, calories: 80, protein: 0.5, carbs: 21, fats: 0.2 },
  桃子: { canonical: "桃子", unit: "个", amount: 1, calories: 59, protein: 1, carbs: 14, fats: 0.4 },
  榴莲: { canonical: "榴莲", unit: "份", amount: 1, calories: 150, protein: 1.5, carbs: 27, fats: 5 },
};

const EXERCISE_ESTIMATES: Record<string, { canonical: string; caloriesPerMinute: number }> = {
  跑步: { canonical: "跑步", caloriesPerMinute: 10 },
  爬坡: { canonical: "爬坡", caloriesPerMinute: 8 },
  羽毛球: { canonical: "羽毛球", caloriesPerMinute: 7 },
  打羽毛球: { canonical: "羽毛球", caloriesPerMinute: 7 },
  散步: { canonical: "散步", caloriesPerMinute: 4 },
  骑车: { canonical: "骑车", caloriesPerMinute: 6 },
};

const TIME_BUCKETS: Record<string, string> = {
  上午: "09:00:00",
  早上: "08:30:00",
  早餐: "08:00:00",
  中午: "12:30:00",
  午餐: "12:30:00",
  下午: "15:30:00",
  晚上: "19:00:00",
  晚餐: "19:00:00",
  夜宵: "22:30:00",
  深夜: "22:30:00",
};

const normalizeUnit = (value?: string | null): string | null => {
  if (!value) return null;
  const next = value.trim();
  return next || null;
};

const toIsoFromDateAndTime = (date: string, time: string) => `${date}T${time}`;

const toLocalDateOnly = (input: Date): string => {
  const year = input.getFullYear();
  const month = String(input.getMonth() + 1).padStart(2, "0");
  const day = String(input.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const resolveParsedTime = (phrase: string | undefined, selectedDate: string): string => {
  const base = phrase?.trim() || "";
  let date = selectedDate;
  if (base.includes("昨天")) {
    const next = new Date(`${selectedDate}T00:00:00`);
    next.setDate(next.getDate() - 1);
    date = toLocalDateOnly(next);
  }

  for (const [token, time] of Object.entries(TIME_BUCKETS)) {
    if (base.includes(token)) {
      return toIsoFromDateAndTime(date, time);
    }
  }

  return `${selectedDate}T${new Date().toTimeString().slice(0, 8)}`;
};

const clampPositive = (value: unknown, fallback: number) => {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? next : fallback;
};

const parseChineseAmount = (raw?: string | null): number => {
  const value = (raw || "").trim();
  if (!value) return 1;
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value);
  if (value.includes("半")) return 0.5;
  if (value.includes("两")) return 2;
  if (value.includes("一")) return 1;
  if (value.includes("三")) return 3;
  if (value.includes("四")) return 4;
  if (value.includes("五")) return 5;
  return 1;
};

const parseDurationMinutes = (raw?: string | null): number | null => {
  const value = (raw || "").trim();
  if (!value) return null;
  if (/半个?小时|半小时/.test(value)) return 30;
  const hourMatch = value.match(/(\d+)\s*个?小时/);
  if (hourMatch) return Number(hourMatch[1]) * 60;
  const minuteMatch = value.match(/(\d+)\s*分钟/);
  if (minuteMatch) return Number(minuteMatch[1]);
  return null;
};

const findFoodId = (name: string): number | null => {
  const exact = db.getFoodByNormalizedName(1, name);
  if (exact) return exact.id;
  const fuzzy = db.searchFoods(1, name, 1)[0];
  return fuzzy ? fuzzy.id : null;
};

const buildVoiceExtractionPrompt = (transcript: string, date: string) => ({
  prompt: `请从下面这段中文自然语言中提取饮食和运动条目。\n日期上下文：${date}\n原文：${transcript}`,
  systemInstruction:
    '你是一名日志抽取助手。只输出严格 JSON，结构为 {"candidates":[...]}。每个 candidate 必须包含 type(food|exercise), name, amount, unit, calories, protein, carbs, fats, confidence, explanation, time_phrase。支持一句话内多个条目；支持中文数量词和时长词，例如 一个、两个、半碗、半个小时、50分钟；支持时间短语，例如 今天上午、中午、晚上、昨天。请把“橙”规范成“橙子”，把“打了半个小时羽毛球”识别成 exercise=羽毛球、amount=30、unit=分钟。饮食条目的 calories/protein/carbs/fats 应为该次摄入总量估算；运动条目 calories 为本次消耗估算，protein/carbs/fats 固定为 0。若原文明显包含吃/喝/跑/打球/运动等动作，绝对不要返回空数组，必须给保守估算。',
});

export const quickExtractCandidates = (transcript: string, selectedDate: string): VoiceExtractCandidate[] => {
  const candidates: VoiceExtractCandidate[] = [];
  const normalized = transcript.replace(/[，。,.；;]/g, " ");
  const parsedTime = resolveParsedTime(transcript, selectedDate);

  const foodRegex = /(?:吃了|吃|喝了|喝)\s*([一二两三四五半\d]+)?\s*(个|份|碗|杯|根|片)?\s*(鸡蛋|苹果|橙子?|香蕉|梨|桃子|榴莲)/g;
  let foodMatch: RegExpExecArray | null;
  while ((foodMatch = foodRegex.exec(normalized)) !== null) {
    const [, amountRaw, explicitUnit, rawFood] = foodMatch;
    const estimate = COMMON_FOOD_ESTIMATES[rawFood];
    if (!estimate) continue;
    const amount = parseChineseAmount(amountRaw) * (explicitUnit ? 1 : estimate.amount);
    const unit = explicitUnit || estimate.unit;
    candidates.push({
      id: crypto.randomUUID(),
      type: "food",
      name: estimate.canonical,
      amount,
      unit,
      calories: Number((estimate.calories * amount).toFixed(1)),
      protein: Number((estimate.protein * amount).toFixed(1)),
      carbs: Number((estimate.carbs * amount).toFixed(1)),
      fats: Number((estimate.fats * amount).toFixed(1)),
      parsed_time: parsedTime,
      confidence: 72,
      explanation: "基于常见口语表达的快速提取",
      food_id: findFoodId(estimate.canonical),
    });
  }

  const exercisePatterns: Array<{ regex: RegExp; key: keyof typeof EXERCISE_ESTIMATES; durationFirst?: boolean }> = [
    { regex: /(跑步)\s*(半个?小时|半小时|\d+\s*分钟|\d+\s*个?小时)/, key: "跑步" },
    { regex: /(爬坡(?:爬)?)\s*(半个?小时|半小时|\d+\s*分钟|\d+\s*个?小时)/, key: "爬坡" },
    { regex: /(?:打了?|进行了?)\s*(半个?小时|半小时|\d+\s*分钟|\d+\s*个?小时)\s*(羽毛球)/, key: "羽毛球", durationFirst: true },
    { regex: /(羽毛球)\s*(半个?小时|半小时|\d+\s*分钟|\d+\s*个?小时)/, key: "羽毛球" },
  ];

  for (const pattern of exercisePatterns) {
    const match = normalized.match(pattern.regex);
    if (!match) continue;
    const durationRaw = pattern.durationFirst ? match[1] : match[2];
    const minutes = parseDurationMinutes(durationRaw);
    if (!minutes) continue;
    const estimate = EXERCISE_ESTIMATES[pattern.key];
    candidates.push({
      id: crypto.randomUUID(),
      type: "exercise",
      name: estimate.canonical,
      amount: minutes,
      unit: "分钟",
      calories: Math.round(minutes * estimate.caloriesPerMinute),
      protein: 0,
      carbs: 0,
      fats: 0,
      parsed_time: parsedTime,
      confidence: 70,
      explanation: "基于常见运动口语表达的快速提取",
    });
  }

  return candidates;
};

export const extractVoiceCandidates = async (
  provider: AIProvider,
  model: string,
  transcript: string,
  selectedDate: string
): Promise<VoiceExtractCandidate[]> => {
  if (!transcript.trim()) {
    throw new AIProxyError("business_parse_error", "transcript is required");
  }

  const fastPath = quickExtractCandidates(transcript, selectedDate);
  if (fastPath.length > 0) {
    return fastPath;
  }

  const { prompt, systemInstruction } = buildVoiceExtractionPrompt(transcript, selectedDate);
  try {
    const raw = await callProvider({ provider, model, prompt, systemInstruction });
    const parsed = parseJson<VoiceExtractResult>(raw);
    const candidates = Array.isArray(parsed.candidates) ? parsed.candidates : [];
    const normalized = candidates
      .filter((candidate) => candidate && typeof candidate.name === "string")
      .map((candidate) => {
        const trimmedName = candidate.name.trim();
        const normalizedType = candidate.type === "exercise" ? "exercise" : "food";
        const amount = clampPositive(candidate.amount, normalizedType === "exercise" ? 30 : 1);
        return {
          id: crypto.randomUUID(),
          type: normalizedType,
          name: trimmedName,
          amount,
          unit: normalizeUnit(candidate.unit) || (normalizedType === "exercise" ? "分钟" : null),
          calories: clampPositive(candidate.calories, normalizedType === "exercise" ? Math.round(amount * 8) : 120),
          parsed_time: resolveParsedTime(candidate.time_phrase, selectedDate),
          confidence: typeof candidate.confidence === "number" ? candidate.confidence : 70,
          explanation: candidate.explanation?.trim() || undefined,
          food_id: normalizedType === "food" ? findFoodId(trimmedName) : null,
          protein: normalizedType === "food" ? Number(candidate.protein || 0) : 0,
          carbs: normalizedType === "food" ? Number(candidate.carbs || 0) : 0,
          fats: normalizedType === "food" ? Number(candidate.fats || 0) : 0,
        } as VoiceExtractCandidate;
      })
      .filter((candidate) => candidate.name);

    if (normalized.length > 0) {
      return normalized;
    }
  } catch (error) {
    console.error("[VoiceExtract][fallback]", error);
  }

  const fallback = quickExtractCandidates(transcript, selectedDate);
  if (fallback.length) return fallback;
  throw new AIProxyError("business_parse_error", "未提取到可写入条目");
};
