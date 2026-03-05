export interface Profile {
  id: number;
  name: string;
  age: number;
  gender: string;
  height: number;
  weight: number;
  goal_calories: number;
  activity_level: number; // 1.2 to 1.9
  ai_provider: string; // 'gemini', 'zhipu', 'tongyi'
  ai_model: string;
  api_key?: string;
  base_url?: string;
}

export interface CustomUnit {
  id: number;
  name: string;
  weight_g: number;
  calories_per_unit?: number;
}

export interface Log {
  id: number;
  date: string;
  type: 'food' | 'exercise';
  name: string;
  amount: number; // weight in grams or duration in minutes
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  timestamp: string;
}

export interface Food {
  id: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  unit: string;
}

export interface CalorieEstimation {
  calories: number;
  confidence: number;
  explanation: string;
}
