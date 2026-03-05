import { LLMManager, LLMConfig } from './llmManager';

// Default API Key (keep as fallback if needed, but prefer user config)
const geminiApiKey = (import.meta as any).env.VITE_GEMINI_API_KEY;

export interface CalorieEstimation {
  calories: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  confidence?: number;
  explanation?: string;
  name?: string;
  weight?: number;
}

async function callAI(profile: any, prompt: string, systemInstruction?: string, imageBase64?: string): Promise<string> {
  const provider = profile.ai_provider || 'gemini';
  const modelName = profile.ai_model || 'gemini-3-flash-preview';
  const apiKey = profile.api_key || (provider === 'gemini' ? geminiApiKey : (import.meta as any).env[`VITE_${provider.toUpperCase()}_API_KEY`]);
  const baseUrl = profile.base_url;

  const config: LLMConfig = {
    provider,
    model: modelName,
    apiKey,
    baseUrl
  };

  try {
    const llm = LLMManager.createProvider(config);
    return await llm.generate(prompt, systemInstruction, imageBase64);
  } catch (error) {
    console.error("LLM Call Error:", error);
    throw error;
  }
}

export async function estimateCalories(
  profile: any,
  query: string, 
  type: 'food' | 'exercise',
  amount?: number
): Promise<CalorieEstimation | null> {
  const prompt = type === 'food' 
    ? `请估算 "${query}" (重量: ${amount || '标准份'} 克) 的营养成分。`
    : `请估算 "${query}" (时长: ${amount || 30} 分钟) 消耗的热量。用户体重: ${profile.weight}kg。`;

  const systemInstruction = `你是一个健康助手。请优先参考《中国食物成分表》进行估算。请返回 JSON 格式数据。
  如果是食物，包含: calories (总热量), protein (蛋白质g), carbs (碳水g), fats (脂肪g), confidence (置信度 0-1), explanation (简短中文说明)。
  如果是运动，包含: calories (消耗热量), confidence (置信度 0-1), explanation (简短中文说明)。
  请确保返回的是合法的 JSON。`;

  try {
    const text = await callAI(profile, prompt, systemInstruction);
    // Extract JSON if model wraps it in markdown
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch (e) {
    console.error("AI estimation failed", e);
    return null;
  }
}

export async function analyzeFoodImage(profile: any, base64Image: string): Promise<CalorieEstimation | null> {
  const prompt = "请分析这张照片中的食物。识别食物种类，并根据其在盘子中的体积估算重量和营养成分。";
  const systemInstruction = `你是一个营养专家。请优先参考《中国食物成分表》。请返回 JSON 格式数据：
  { "name": "食物名称", "calories": 热量, "protein": 蛋白质, "carbs": 碳水, "fats": 脂肪, "weight": 估算重量(g), "explanation": "中文分析说明" }
  请确保返回的是合法的 JSON。`;

  try {
    const text = await callAI(profile, prompt, systemInstruction, base64Image);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch (e) {
    console.error("AI image analysis failed", e);
    return null;
  }
}

export async function generateDailyAdvice(logs: any[], profile: any): Promise<string> {
  const logSummary = logs.map(l => `${l.type === 'food' ? '饮食' : '运动'}: ${l.name} (${l.amount}${l.type === 'food' ? 'g' : 'min'}), ${l.calories}kcal`).join('\n');
  
  const prompt = `
    用户身体特征：年龄${profile.age}, 性别${profile.gender}, 身高${profile.height}cm, 体重${profile.weight}kg, 目标热量${profile.goal_calories}kcal。
    今日日志：
    ${logSummary}
    
    请根据以上信息，对用户的饮食和运动进行总结、评价，并给出针对性的健康建议。请使用亲切的中文。
  `;

  try {
    return await callAI(profile, prompt, "你是一个专业的健康教练。");
  } catch (e) {
    return `建议生成失败: ${e instanceof Error ? e.message : '未知错误'}`;
  }
}
