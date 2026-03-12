import test from "node:test";
import assert from "node:assert/strict";
import { buildAudioDataUrl, transcribeAudio } from "../voiceTranscriptionService";

test("buildAudioDataUrl wraps raw base64 into a data URL", () => {
  const result = buildAudioDataUrl("AAAA", "audio/webm;codecs=opus");
  assert.equal(result, "data:audio/webm;base64,AAAA");
});

test("transcribeAudio falls back to the second model when the first fails", async () => {
  process.env.VOICE_ASR_PROVIDER = "silra";
  process.env.VOICE_ASR_MODELS = "qwen3-asr-flash,gemini-2.5-flash";
  process.env.SILRA_API_KEY = "sk-test-value";
  process.env.SILRA_BASE_URL = "https://api.silra.cn/v1";

  const calls: string[] = [];
  const originalFetch = global.fetch;
  global.fetch = (async (_input: any, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || "{}"));
    calls.push(body.model);
    if (body.model === "qwen3-asr-flash") {
      return new Response("bad request", { status: 400 });
    }
    return new Response(
      JSON.stringify({ choices: [{ message: { content: "吃了两个苹果" } }] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;

  try {
    const result = await transcribeAudio({ audioBase64: "AAAA", mimeType: "audio/webm" });
    assert.equal(result.model, "gemini-2.5-flash");
    assert.equal(result.transcript, "吃了两个苹果");
    assert.deepEqual(calls, ["qwen3-asr-flash", "gemini-2.5-flash"]);
  } finally {
    global.fetch = originalFetch;
  }
});
