import { AIProxyError, classifyProxyError, resolveApiKey, resolveBaseUrl, type AIProvider } from "./aiService";

export interface VoiceTranscriptionResult {
  transcript: string;
  provider: string;
  model: string;
}

interface AudioPayload {
  audioBase64: string;
  mimeType: string;
}

const MASK = (key?: string) => {
  if (!key) return "missing";
  return key.length < 10 ? `${key.slice(0, 2)}***${key.slice(-2)}` : `${key.slice(0, 4)}***${key.slice(-4)}`;
};

const normalizeMimeType = (mimeType?: string) => {
  if (!mimeType) return "audio/webm";
  return mimeType.split(";")[0].trim() || "audio/webm";
};

export const buildAudioDataUrl = (audioBase64: string, mimeType: string) => {
  if (audioBase64.startsWith("data:audio/")) return audioBase64;
  return `data:${normalizeMimeType(mimeType)};base64,${audioBase64}`;
};

const getModelChain = () => {
  const configured = (process.env.VOICE_ASR_MODELS || "qwen3-asr-flash,gemini-2.5-flash")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return configured.length ? configured : ["qwen3-asr-flash", "gemini-2.5-flash"];
};

const getProvider = (): AIProvider => (process.env.VOICE_ASR_PROVIDER as AIProvider) || "silra";

const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs = 90_000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

export async function transcribeAudio(payload: AudioPayload): Promise<VoiceTranscriptionResult> {
  if (!payload.audioBase64) {
    throw new AIProxyError("business_parse_error", "audioBase64 is required");
  }

  const provider = getProvider();
  if (provider !== "silra") {
    throw new AIProxyError("business_parse_error", `当前仅支持 silra 语音转写，收到 provider=${provider}`);
  }

  const apiKey = resolveApiKey(provider);
  if (!apiKey) {
    throw new AIProxyError("business_parse_error", "Missing SILRA_API_KEY for voice transcription");
  }

  const baseUrl = (resolveBaseUrl(provider) || "https://api.silra.cn/v1").replace(/\/+$/, "");
  const endpoint = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`;
  const audioUrl = buildAudioDataUrl(payload.audioBase64, payload.mimeType);
  const mimeType = normalizeMimeType(payload.mimeType);

  const attempts: string[] = [];
  for (const model of getModelChain()) {
    console.log(`[VoiceSTT] provider=${provider} model=${model} mimeType=${mimeType} baseUrl=${baseUrl} key=${MASK(apiKey)}`);
    try {
      const response = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            {
              role: "system",
              content: "你是中文语音转写助手。只输出转写后的简体中文文本，不要解释，不要加标点修饰，不要返回 JSON。",
            },
            {
              role: "user",
              content: [
                { type: "text", text: "请将这段音频转写成中文文本，尽量保留原句中的食物、数量、运动项目和时长。" },
                { type: "input_audio", input_audio: { data: audioUrl, format: mimeType.split("/")[1] || "webm" } },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        attempts.push(`${model}: ${err}`);
        continue;
      }

      const data = (await response.json()) as any;
      const content = data?.choices?.[0]?.message?.content;
      const transcript = typeof content === "string"
        ? content.trim()
        : Array.isArray(content)
          ? content.map((item: any) => typeof item?.text === "string" ? item.text : "").join("").trim()
          : "";

      if (!transcript) {
        attempts.push(`${model}: empty transcript`);
        continue;
      }

      return { transcript, provider, model };
    } catch (error) {
      attempts.push(`${model}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new AIProxyError(
    classifyProxyError(new Error(attempts.join(" | "))),
    `Silra 音频转写失败：当前网关可能不兼容该音频输入格式。已尝试模型：${getModelChain().join(", ")}`
  );
}
