import test from "node:test";
import assert from "node:assert/strict";
import { quickExtractCandidates, resolveParsedTime } from "../voiceService";

test("resolveParsedTime maps afternoon phrases to the selected date afternoon bucket", () => {
  const result = resolveParsedTime("今天下午", "2026-03-12");
  assert.equal(result, "2026-03-12T15:30:00");
});

test("quickExtractCandidates extracts mixed food and exercise entries from common spoken Chinese", () => {
  const result = quickExtractCandidates("今天下午我吃了一个橙然后打了半个小时羽毛球", "2026-03-12");

  assert.equal(result.length, 2);
  assert.equal(result[0].type, "food");
  assert.equal(result[0].name, "橙子");
  assert.equal(result[0].amount, 1);
  assert.equal(result[0].unit, "个");

  assert.equal(result[1].type, "exercise");
  assert.equal(result[1].name, "羽毛球");
  assert.equal(result[1].amount, 30);
  assert.equal(result[1].unit, "分钟");
});

test("quickExtractCandidates supports durian and running duration phrases", () => {
  const result = quickExtractCandidates("昨天晚上我吃了一个榴莲，跑步30分钟", "2026-03-12");

  assert.equal(result.length, 2);
  const food = result.find((item) => item.type === "food");
  const exercise = result.find((item) => item.type === "exercise");

  assert.ok(food);
  assert.equal(food?.name, "榴莲");
  assert.equal(food?.unit, "个");
  assert.equal(food?.parsed_time, "2026-03-11T19:00:00");

  assert.ok(exercise);
  assert.equal(exercise?.name, "跑步");
  assert.equal(exercise?.amount, 30);
});
