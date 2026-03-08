import fs from "fs";
import path from "path";
import { AIProxyError } from "./aiService";
import { db } from "./db";

export interface BodyMetricPayload {
  date: string;
  weight?: number | null;
  chest?: number | null;
  waist?: number | null;
  thigh?: number | null;
  photo_url?: string | null;
}

const uploadDir = path.resolve("./public/uploads/body");

function ensureDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AIProxyError("business_parse_error", "date must be in YYYY-MM-DD format");
  }
  return value;
}

function ensureUploadDir() {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
}

function removeLocalPhoto(photoUrl?: string | null) {
  if (!photoUrl || !photoUrl.startsWith("/uploads/body/")) return;
  const filePath = path.resolve("./public", `.${photoUrl}`.replace(/^\.\//, ""));
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function savePhotoToLocal(photoUrl?: string | null): string | null {
  if (!photoUrl) return null;
  if (!photoUrl.startsWith("data:image/")) {
    return photoUrl;
  }

  ensureUploadDir();
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(photoUrl);
  if (!match) {
    throw new AIProxyError("business_parse_error", "photo_url must be a valid base64 image data URL");
  }
  const mime = match[1];
  const base64 = match[2];
  const ext = mime.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
  const fileName = `body-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filePath = path.join(uploadDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(base64, "base64"));
  return `/uploads/body/${fileName}`;
}

export function listBodyMetrics(userId: number) {
  return db.listBodyMetrics(userId);
}

export function createBodyMetric(userId: number, payload: BodyMetricPayload) {
  const id = db.createBodyMetric({
    userId,
    date: ensureDate(payload.date),
    weight: payload.weight ?? null,
    chest: payload.chest ?? null,
    waist: payload.waist ?? null,
    thigh: payload.thigh ?? null,
    photoUrl: savePhotoToLocal(payload.photo_url),
  });
  const created = db.getBodyMetricById(userId, id);
  if (!created) {
    throw new AIProxyError("model_error", "Failed to create body metric");
  }
  return created;
}

export function deleteBodyMetric(userId: number, id: number) {
  const existing = db.getBodyMetricById(userId, id);
  if (!existing) {
    throw new AIProxyError("business_parse_error", "body metric not found");
  }
  removeLocalPhoto(existing.photoUrl);
  db.deleteBodyMetric(userId, id);
  return { success: true };
}
