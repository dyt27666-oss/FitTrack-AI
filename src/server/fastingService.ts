import { AIProxyError } from "./aiService";
import { db, type FastingLogEntity } from "./db";

export interface FastingStatusResponse {
  active: boolean;
  currentLog: FastingLogEntity | null;
  elapsedMinutes: number;
  remainingMinutes: number;
  progressPercent: number;
  phase: string;
  status: "idle" | "fasting" | "completed" | "failed";
}

const MINUTE_MS = 60_000;

function ensureIsoString(value: string, fieldName: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AIProxyError("business_parse_error", `${fieldName} must be a valid ISO 8601 datetime`);
  }
  return date.toISOString();
}

function parsePlanHours(planType: string): { fastingHours: number; eatingHours: number } {
  const match = /^(\d{1,2})-(\d{1,2})$/.exec(planType.trim());
  if (!match) {
    throw new AIProxyError("business_parse_error", "plan_type must match formats like 16-8 or 14-10");
  }
  const fastingHours = Number(match[1]);
  const eatingHours = Number(match[2]);
  if (fastingHours <= 0 || eatingHours <= 0 || fastingHours + eatingHours !== 24) {
    throw new AIProxyError("business_parse_error", "plan_type must sum to 24 hours");
  }
  return { fastingHours, eatingHours };
}

function resolvePhase(elapsedMinutes: number): string {
  if (elapsedMinutes < 60) return "血糖稳定期";
  if (elapsedMinutes < 720) return "血糖下降期";
  if (elapsedMinutes < 960) return "燃脂启动期";
  return "细胞自噬巅峰期";
}

function computeFastingStatus(log: FastingLogEntity | null, now = new Date()): FastingStatusResponse {
  if (!log) {
    return {
      active: false,
      currentLog: null,
      elapsedMinutes: 0,
      remainingMinutes: 0,
      progressPercent: 0,
      phase: "未开始",
      status: "idle",
    };
  }

  if (log.status !== "fasting") {
    return {
      active: false,
      currentLog: log,
      elapsedMinutes: 0,
      remainingMinutes: 0,
      progressPercent: log.status === "completed" ? 100 : 0,
      phase: log.status === "completed" ? "已完成" : "未达目标",
      status: log.status,
    };
  }

  const start = new Date(log.startTime).getTime();
  const target = new Date(log.targetEndTime).getTime();
  const nowMs = now.getTime();
  const elapsedMinutes = Math.max(0, Math.floor((nowMs - start) / MINUTE_MS));
  const totalMinutes = Math.max(1, Math.floor((target - start) / MINUTE_MS));
  const remainingMinutes = Math.max(0, Math.ceil((target - nowMs) / MINUTE_MS));
  const progressPercent = Math.min(100, Number(((elapsedMinutes / totalMinutes) * 100).toFixed(1)));

  return {
    active: true,
    currentLog: log,
    elapsedMinutes,
    remainingMinutes,
    progressPercent,
    phase: resolvePhase(elapsedMinutes),
    status: "fasting",
  };
}

export function getCurrentFastingStatus(userId: number): FastingStatusResponse {
  const current = db.getCurrentFastingLog(userId);
  return computeFastingStatus(current);
}

export function startFasting(userId: number, input: { planType: string; startTime?: string }): FastingStatusResponse {
  const existing = db.getCurrentFastingLog(userId);
  if (existing) {
    throw new AIProxyError("business_parse_error", "A fasting session is already active");
  }

  const { fastingHours } = parsePlanHours(input.planType);
  const startIso = input.startTime ? ensureIsoString(input.startTime, "start_time") : new Date().toISOString();
  const targetDate = new Date(startIso);
  targetDate.setHours(targetDate.getHours() + fastingHours);
  const targetIso = targetDate.toISOString();

  const id = db.createFastingLog({
    userId,
    planType: input.planType,
    startTime: startIso,
    targetEndTime: targetIso,
    actualEndTime: null,
    status: "fasting",
  });
  const current = db.getCurrentFastingLog(userId);
  if (!current || current.id !== id) {
    throw new AIProxyError("model_error", "Failed to start fasting session");
  }
  return computeFastingStatus(current);
}

export function endFasting(userId: number, input?: { endTime?: string }) {
  const current = db.getCurrentFastingLog(userId);
  if (!current) {
    throw new AIProxyError("business_parse_error", "No active fasting session");
  }

  const endIso = input?.endTime ? ensureIsoString(input.endTime, "actual_end_time") : new Date().toISOString();
  const completed = new Date(endIso).getTime() >= new Date(current.targetEndTime).getTime();
  const status = completed ? "completed" : "failed";
  db.updateFastingLogStatus(userId, current.id, {
    actualEndTime: endIso,
    status,
  });

  return {
    log: {
      ...current,
      actualEndTime: endIso,
      status,
    },
    status,
  };
}

export function listFastingLogs(userId: number) {
  return db.listFastingLogs(userId);
}
