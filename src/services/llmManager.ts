export interface LLMConfig {
  provider: "gemini" | "zhipu" | "tongyi" | "silra";
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

abstract class LLMProvider {
  protected config: LLMConfig;
  protected static readonly TIMEOUT_MS = 90_000;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  protected maskKey(key?: string): string {
    if (!key) return "missing";
    if (key.length < 10) return `${key.slice(0, 2)}***${key.slice(-2)}`;
    return `${key.slice(0, 4)}***${key.slice(-4)}`;
  }

  protected ensureImageDataUrl(imageBase64?: string, mime = "image/jpeg"): string | undefined {
    if (!imageBase64) return undefined;
    if (imageBase64.startsWith("data:image/")) return imageBase64;
    return `data:${mime};base64,${imageBase64}`;
  }

  protected normalizeBaseUrl(raw: string): string {
    return raw.replace(/\/+$/, "");
  }

  protected async fetchWithTimeout(input: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLMProvider.TIMEOUT_MS);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  abstract generate(prompt: string, systemInstruction?: string, imageBase64?: string): Promise<string>;
}

class GeminiProvider extends LLMProvider {
  async generate(prompt: string, systemInstruction?: string, imageBase64?: string): Promise<string> {
    const apiKey = this.config.apiKey;
    if (!apiKey) throw new Error("Gemini API Key is missing");

    const model = this.config.model || "gemini-2.5-flash";
    const baseUrl = this.normalizeBaseUrl(this.config.baseUrl || "https://generativelanguage.googleapis.com/v1beta");
    const endpoint = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;

    console.log(
      `[LLM][gemini] model=${model} baseUrl=${baseUrl} key=${this.maskKey(apiKey)} timeoutMs=${LLMProvider.TIMEOUT_MS}`
    );

    const imageData = this.ensureImageDataUrl(imageBase64, "image/jpeg");
    const parts: Array<Record<string, unknown>> = [{ text: prompt }];
    if (imageData) {
      parts.unshift({
        inlineData: {
          mimeType: imageData.substring(5, imageData.indexOf(";")) || "image/jpeg",
          data: imageData.split(",")[1] || "",
        },
      });
    }

    const response = await this.fetchWithTimeout(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        generationConfig: { responseMimeType: "application/json" },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      const proxyHint = process.env.HTTPS_PROXY
        ? "HTTPS_PROXY is set."
        : "HTTPS_PROXY is not set. If you are in restricted network, check HTTPS_PROXY.";
      throw new Error(`Gemini API Error(${response.status}): ${err}. ${proxyHint}`);
    }

    const data = (await response.json()) as any;
    if (data.error?.message) throw new Error(data.error.message);
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }
}

class OpenAICompatibleProvider extends LLMProvider {
  private readonly providerName: "zhipu" | "tongyi" | "silra";

  constructor(config: LLMConfig, providerName: "zhipu" | "tongyi" | "silra") {
    super(config);
    this.providerName = providerName;
  }

  private isVisionCapableModel(model?: string): boolean {
    if (!model) return false;
    const lowered = model.toLowerCase();
    return (
      lowered.includes("vl") ||
      lowered.includes("4.5v") ||
      lowered.includes("4v") ||
      lowered.includes("vision") ||
      lowered.includes("image") ||
      lowered.includes("gemini-3.1-pro-preview")
    );
  }

  private resolveModel(isVision: boolean): string {
    if (this.providerName === "silra") {
      if (isVision) {
        if (!this.isVisionCapableModel(this.config.model)) {
          return process.env.SILRA_VISION_MODEL || "qwen-vl-plus";
        }
        return this.config.model || process.env.SILRA_VISION_MODEL || "qwen-vl-plus";
      }
      return this.config.model || process.env.SILRA_TEXT_MODEL || "deepseek-v3";
    }
    if (this.providerName === "zhipu") {
      return isVision
        ? this.config.model || process.env.ZHIPU_VISION_MODEL || "glm-4.5v"
        : this.config.model || process.env.ZHIPU_TEXT_MODEL || "glm-4";
    }
    if (isVision) {
      return this.config.model || process.env.TONGYI_VISION_MODEL || "qwen-vl-plus";
    }
    return this.config.model || process.env.TONGYI_TEXT_MODEL || "qwen-mt-plus";
  }

  private resolveEndpoint(baseUrl: string): string {
    if (baseUrl.endsWith("/chat/completions")) return baseUrl;
    if (this.providerName === "silra") {
      if (baseUrl.endsWith("/v1")) return `${baseUrl}/chat/completions`;
      return `${baseUrl}/v1/chat/completions`;
    }
    return `${baseUrl}/chat/completions`;
  }

  private parseContent(content: unknown): string {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .map((item) => {
          const text = (item as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        })
        .join("")
        .trim();
    }
    return "";
  }

  async generate(prompt: string, systemInstruction?: string, imageBase64?: string): Promise<string> {
    const apiKey = this.config.apiKey;
    if (!apiKey) throw new Error(`${this.providerName} API Key is missing`);

    const baseUrl = this.normalizeBaseUrl(
      this.config.baseUrl ||
        (this.providerName === "silra"
          ? "https://api.silra.cn/v1"
          :
        (this.providerName === "zhipu"
          ? "https://open.bigmodel.cn/api/paas/v4"
          : "https://dashscope.aliyuncs.com/compatible-mode/v1"))
    );
    const endpoint = this.resolveEndpoint(baseUrl);
    const imageData = this.ensureImageDataUrl(imageBase64, "image/jpeg");
    const model = this.resolveModel(Boolean(imageData));

    console.log(
      `[LLM][${this.providerName}] model=${model} baseUrl=${baseUrl} endpoint=${endpoint} key=${this.maskKey(apiKey)} timeoutMs=${LLMProvider.TIMEOUT_MS}`
    );

    const userContent: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
    if (imageData) {
      userContent.push({ type: "image_url", image_url: { url: imageData } });
    }

    const messages: Array<Record<string, unknown>> = [];
    if (systemInstruction) {
      messages.push({ role: "system", content: systemInstruction });
    }
    messages.push({ role: "user", content: userContent });

    const response = await this.fetchWithTimeout(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`${this.providerName} API Error(${response.status}): ${err}`);
    }

    const data = (await response.json()) as any;
    return this.parseContent(data?.choices?.[0]?.message?.content);
  }
}

export class LLMManager {
  static createProvider(config: LLMConfig): LLMProvider {
    switch (config.provider) {
      case "gemini":
        return new GeminiProvider(config);
      case "zhipu":
        return new OpenAICompatibleProvider(config, "zhipu");
      case "tongyi":
        return new OpenAICompatibleProvider(config, "tongyi");
      case "silra":
        return new OpenAICompatibleProvider(config, "silra");
      default:
        throw new Error(`Unsupported provider: ${(config as { provider?: string }).provider}`);
    }
  }

  static getAvailableModels(provider: string): string[] {
    return this.getAvailableTextModels(provider);
  }

  static getAvailableTextModels(provider: string): string[] {
    switch (provider) {
      case "gemini":
        return ["gemini-2.5-flash", "gemini-2.5-pro"];
      case "zhipu":
        return ["glm-4"];
      case "tongyi":
        return ["qwen-mt-plus", "qwen-max"];
      case "silra":
        return ["deepseek-v3", "deepseek-chat"];
      default:
        return [];
    }
  }

  static getAvailableVisionModels(provider: string): string[] {
    switch (provider) {
      case "gemini":
        return ["gemini-2.5-pro"];
      case "zhipu":
        return ["glm-4.5v"];
      case "tongyi":
        return ["qwen-vl-plus"];
      case "silra":
        return ["qwen-vl-plus", "glm-4.5v", "gemini-3.1-pro-preview"];
      default:
        return [];
    }
  }
}
