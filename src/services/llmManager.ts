
import { GoogleGenAI } from "@google/genai";

export interface LLMConfig {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface LLMResponse {
  text: string;
}

abstract class LLMProvider {
  protected config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  abstract generate(prompt: string, systemInstruction?: string, imageBase64?: string): Promise<string>;
}

class GeminiProvider extends LLMProvider {
  async generate(prompt: string, systemInstruction?: string, imageBase64?: string): Promise<string> {
    const apiKey = this.config.apiKey;
    if (!apiKey) throw new Error("Gemini API Key is missing");

    // Handle custom Base URL if provided (using fetch for custom endpoints, or SDK for standard)
    if (this.config.baseUrl) {
      const url = `${this.config.baseUrl}/v1beta/models/${this.config.model}:generateContent?key=${apiKey}`;
      const contents: any = imageBase64 ? {
        parts: [
          { inlineData: { data: imageBase64.split(',')[1], mimeType: "image/jpeg" } },
          { text: prompt }
        ]
      } : { parts: [{ text: prompt }] };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [contents],
          systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Gemini API Error: ${err}`);
      }
      
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else {
      // Use Official SDK
      const ai = new GoogleGenAI({ apiKey: apiKey });
      const contents: any = imageBase64 ? {
        parts: [
          { inlineData: { data: imageBase64.split(',')[1], mimeType: "image/jpeg" } },
          { text: prompt }
        ]
      } : prompt;

      const response = await ai.models.generateContent({
        model: this.config.model,
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
        }
      });
      return response.text || "";
    }
  }
}

class ZhipuProvider extends LLMProvider {
  async generate(prompt: string, systemInstruction?: string, imageBase64?: string): Promise<string> {
    const apiKey = this.config.apiKey;
    if (!apiKey) throw new Error("Zhipu API Key is missing");

    const baseUrl = this.config.baseUrl || "https://open.bigmodel.cn/api/paas/v4/chat/completions";

    const messages: any[] = [];
    if (systemInstruction) messages.push({ role: "system", content: systemInstruction });

    const userContent: any[] = [{ type: "text", text: prompt }];
    if (imageBase64) {
      userContent.push({ type: "image_url", image_url: { url: imageBase64 } });
    }
    messages.push({ role: "user", content: userContent });

    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages,
        // Zhipu specific: response_format for JSON if needed, but usually text is fine.
        // For structured output, we might need to parse the text.
        // The prompt usually asks for JSON, so the model should output JSON string.
      })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Zhipu API Error: ${err}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
}

class TongyiProvider extends LLMProvider {
  async generate(prompt: string, systemInstruction?: string, imageBase64?: string): Promise<string> {
    const apiKey = this.config.apiKey;
    if (!apiKey) throw new Error("Tongyi API Key is missing");

    const baseUrl = this.config.baseUrl || "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation";
    // Note: Tongyi VL models might have different endpoints or payload structures compared to text models.
    // Assuming the standard Qwen-VL endpoint compatibility or similar structure.
    // For Qwen-VL, the input structure is specific.

    const messages: any[] = [];
    if (systemInstruction) messages.push({ role: "system", content: systemInstruction });

    const userContent: any[] = [{ text: prompt }];
    if (imageBase64) {
      // Tongyi expects 'image' field with URL or base64? 
      // DashScope usually expects a public URL or oss path for images in some versions, 
      // but recent updates support base64 data URIs in some contexts or require specific handling.
      // For simplicity, we assume it supports data URI or we might need to upload.
      // Actually, DashScope VL often requires a URL. If Base64 is not supported directly in 'image' field, 
      // this might fail. However, let's try the standard message format.
      userContent.push({ image: imageBase64 });
    }
    messages.push({ role: "user", content: userContent });

    const isVL = this.config.model.includes('vl');
    const url = isVL 
        ? "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"
        : baseUrl;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        input: { messages: messages },
        parameters: { result_format: "message" }
      })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Tongyi API Error: ${err}`);
    }

    const data = await response.json();
    if (data.code) { // DashScope returns code in body on error sometimes
        throw new Error(`Tongyi API Error: ${data.message}`);
    }
    return data.output.choices[0].message.content;
  }
}

export class LLMManager {
  static createProvider(config: LLMConfig): LLMProvider {
    switch (config.provider) {
      case 'gemini':
        return new GeminiProvider(config);
      case 'zhipu':
        return new ZhipuProvider(config);
      case 'tongyi':
        return new TongyiProvider(config);
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }

  static getAvailableModels(provider: string): string[] {
    switch (provider) {
      case 'gemini':
        return ['gemini-3-flash-preview', 'gemini-2.5-flash-image', 'gemini-3.1-pro-preview'];
      case 'zhipu':
        return ['glm-4', 'glm-4v', 'glm-4-flash'];
      case 'tongyi':
        return ['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-vl-max', 'qwen-vl-plus'];
      default:
        return [];
    }
  }
}
