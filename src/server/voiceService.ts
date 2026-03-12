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

export const resolveParsedTime = (phrase: string | undefined, selectedDate: string): string => {
  const base = phrase?.trim() || "";
  let date = selectedDate;
  if (base.includes("昨天")) {
    const next = new Date(`${selectedDate}T00:00:00`);
    next.setDate(next.getDate() - 1);
    date = next.toISOString().slice(0, 10);
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

const findFoodId = (name: string): number | null => {
  const exact = db.getFoodByNormalizedName(1, name);
  if (exact) return exact.id;
  const fuzzy = db.searchFoods(1, name, 1)[0];
  return fuzzy ? fuzzy.id : null;
};

const buildVoiceExtractionPrompt = (transcript: string, date: string) => ({
  prompt: `请从下面这段中文自然语言中提取饮食和运动条目。\n日期上下文：${date}\n原文：${transcript}`,
  systemInstruction:
    '你是一名日志抽取助手。只输出严格 JSON，结构为 {"candidates":[...]}。每个 candidate 必须包含 type(food|exercise), name, amount, unit, calories, protein, carbs, fats, confidence, explanation, time_phrase。支持一句话内多个条目；支持中文数量词和时长词，例如 一个、两个、半碗、50分钟；支持时间短语，例如 今天上午、中午、晚上、昨天。饮食条目的 calories/protein/carbs/fats 应为该次摄入总量估算；运动条目 calories 为本次消耗估算，protein/carbs/fats 固定为 0。没有把握时也要给保守估算，不要输出空数组，除非原文确实没有可记录条目。',
});

const heuristicExtraction = (transcript: string, selectedDate: string): VoiceExtractCandidate[] => {
  const candidates: VoiceExtractCandidate[] = [];
  const normalized = transcript.replace(/[，。,.]/g, " ");
  const eggMatch = normalized.match(/(一|1)个鸡蛋/);
  if (eggMatch) {
    candidates.push({
      id: crypto.randomUUID(),
      type: "food",
      name: "鸡蛋",
      amount: 1,
      unit: "个",
      calories: 78,
      protein: 6.3,
      carbs: 0.6,
      fats: 5.3,
      parsed_time: resolveParsedTime(transcript, selectedDate),
      confidence: 60,
      explanation: "基于常见鸡蛋热量估算",
      food_id: findFoodId("鸡蛋"),
    });
  }
  const appleMatch = normalized.match(/(两|2)个苹果/);
  if (appleMatch) {
    candidates.push({
      id: crypto.randomUUID(),
      type: "food",
      name: "苹果",
      amount: 2,
      unit: "个",
      calories: 104,
      protein: 0.6,
      carbs: 28,
      fats: 0.4,
      parsed_time: resolveParsedTime(transcript, selectedDate),
      confidence: 60,
      explanation: "基于常见苹果热量估算",
      food_id: findFoodId("苹果"),
    });
  }
  const runMatch = normalized.match(/跑步\s*(\d+)\s*分钟/);
  if (runMatch) {
    const minutes = Number(runMatch[1]);
    candidates.push({
      id: crypto.randomUUID(),
      type: "exercise",
      name: "跑步",
      amount: minutes,
      unit: "分钟",
      calories: Math.round(minutes * 10),
      protein: 0,
      carbs: 0,
      fats: 0,
      parsed_time: resolveParsedTime(transcript, selectedDate),
      confidence: 55,
      explanation: "基于常见中等强度跑步热量估算",
    });
  }
  const climbMatch = normalized.match(/爬坡(?:爬)?\s*(\d+)\s*分钟/);
  if (climbMatch) {
    const minutes = Number(climbMatch[1]);
    candidates.push({
      id: crypto.randomUUID(),
      type: "exercise",
      name: "爬坡",
      amount: minutes,
      unit: "分钟",
      calories: Math.round(minutes * 8),
      protein: 0,
      carbs: 0,
      fats: 0,
      parsed_time: resolveParsedTime(transcript, selectedDate),
      confidence: 55,
      explanation: "基于常见爬坡运动热量估算",
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

  const fallback = heuristicExtraction(transcript, selectedDate);
  if (fallback.length) return fallback;
  throw new AIProxyError("business_parse_error", "未提取到可写入条目");
};
