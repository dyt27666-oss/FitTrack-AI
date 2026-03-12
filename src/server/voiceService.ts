export type VoiceCandidateType = "food" | "exercise";

export interface VoiceExtractCandidateInput {
  type?: VoiceCandidateType;
  name?: string;
  amount?: number;
  unit?: string | null;
  calories?: number;
  parsed_time?: string;
  confidence?: number;
}

export interface VoiceExtractCandidateEntity {
  id: string;
  type: VoiceCandidateType;
  name: string;
  amount: number;
  unit: string | null;
  calories: number;
  parsed_time: string;
  confidence?: number;
}

const TIME_BUCKETS: Record<string, string> = {
  MORNING: "09:00:00.000Z",
  NOON: "12:30:00.000Z",
  AFTERNOON: "15:30:00.000Z",
  EVENING: "19:00:00.000Z",
  NIGHT: "22:30:00.000Z",
};

const isoWithTime = (date: string, time: string) => `${date}T${time}`;

const shiftDate = (date: string, deltaDays: number) => {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + deltaDays);
  return next.toISOString().slice(0, 10);
};

const inferTimeBucket = (text: string) => {
  if (/(夜宵|深夜|凌晨)/.test(text)) return TIME_BUCKETS.NIGHT;
  if (/(晚上|晚饭|晚餐)/.test(text)) return TIME_BUCKETS.EVENING;
  if (/(下午)/.test(text)) return TIME_BUCKETS.AFTERNOON;
  if (/(中午|午饭|午餐)/.test(text)) return TIME_BUCKETS.NOON;
  if (/(上午|早上|早餐|早饭)/.test(text)) return TIME_BUCKETS.MORNING;
  return "12:00:00.000Z";
};

export const resolveVoiceParsedTime = (sourceText: string, selectedDate: string) => {
  const normalized = sourceText.trim();
  const targetDate = /(昨天|昨晚)/.test(normalized) ? shiftDate(selectedDate, -1) : selectedDate;
  return isoWithTime(targetDate, inferTimeBucket(normalized));
};

const normalizeType = (value: unknown): VoiceCandidateType => (value === "exercise" ? "exercise" : "food");

const normalizeName = (value: unknown, type: VoiceCandidateType) => {
  if (typeof value === "string" && value.trim()) return value.trim();
  return type === "exercise" ? "未命名运动" : "未命名食物";
};

const normalizeAmount = (value: unknown, type: VoiceCandidateType) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  return type === "exercise" ? 30 : 1;
};

const normalizeUnit = (value: unknown, type: VoiceCandidateType) => {
  if (typeof value === "string" && value.trim()) return value.trim();
  return type === "exercise" ? "分钟" : "份";
};

const normalizeCalories = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
  return 0;
};

export const normalizeVoiceExtractCandidates = (
  candidates: VoiceExtractCandidateInput[],
  transcript: string,
  selectedDate: string
): VoiceExtractCandidateEntity[] =>
  candidates.map((candidate, index) => {
    const type = normalizeType(candidate.type);
    return {
      id: `voice-${Date.now()}-${index}`,
      type,
      name: normalizeName(candidate.name, type),
      amount: normalizeAmount(candidate.amount, type),
      unit: normalizeUnit(candidate.unit, type),
      calories: normalizeCalories(candidate.calories),
      parsed_time:
        typeof candidate.parsed_time === "string" && candidate.parsed_time.trim()
          ? candidate.parsed_time
          : resolveVoiceParsedTime(transcript, selectedDate),
      confidence: typeof candidate.confidence === "number" ? candidate.confidence : undefined,
    };
  });
