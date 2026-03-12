import test from "node:test";
import assert from "node:assert/strict";
import { normalizeVoiceExtractCandidates, resolveVoiceParsedTime } from "../voiceService";

test("resolveVoiceParsedTime maps same-day phrases to expected time buckets", () => {
  assert.equal(resolveVoiceParsedTime("我今天上午吃了一个鸡蛋", "2026-03-12"), "2026-03-12T09:00:00.000Z");
  assert.equal(resolveVoiceParsedTime("晚上跑步30分钟", "2026-03-12"), "2026-03-12T19:00:00.000Z");
});

test("resolveVoiceParsedTime maps yesterday to previous date", () => {
  assert.equal(resolveVoiceParsedTime("昨天中午吃了两个苹果", "2026-03-12"), "2026-03-11T12:30:00.000Z");
});

test("normalizeVoiceExtractCandidates assigns ids and fills defaults", () => {
  const items = normalizeVoiceExtractCandidates([
    { type: "food", name: "苹果", amount: 2, calories: 104 },
    { type: "exercise", name: "跑步", amount: 30, calories: 300, parsed_time: "2026-03-12T15:30:00.000Z" },
  ], "吃了两个苹果，跑步30分钟", "2026-03-12");

  assert.equal(items.length, 2);
  assert.equal(items[0].type, "food");
  assert.equal(items[0].unit, "份");
  assert.equal(items[0].parsed_time, "2026-03-12T12:00:00.000Z");
  assert.ok(items[0].id);
  assert.equal(items[1].type, "exercise");
  assert.equal(items[1].unit, "分钟");
});
