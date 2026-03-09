export interface Profile {
  id: number;
  name: string;
  sex: string;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: number; // 1.2 to 1.9
  goal: '减脂' | '增肌' | '维持';
  goalCalories: number;
  text_ai_provider: string;
  text_ai_model: string;
  vision_ai_provider: string;
  vision_ai_model: string;
  ai_provider?: string;
  ai_model?: string;
  // backward compatibility fields for existing UI code
  gender?: string;
  height?: number;
  weight?: number;
  goal_calories?: number;
  activity_level?: number;
}

export interface CustomUnit {
  id: number;
  food_id?: number;
  name: string;
  weight_g: number;
  calories_per_unit?: number;
  confidence?: number;
}

export interface Log {
  id: number;
  date: string;
  type: 'food' | 'exercise';
  food_id?: number | null;
  name: string;
  amount: number; // weight in grams or duration in minutes
  unit_name?: string | null;
  grams?: number | null;
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
  calories_per_100g?: number;
  protein: number;
  protein_per_100g?: number;
  carbs: number;
  carbs_per_100g?: number;
  fats: number;
  fats_per_100g?: number;
  unit: string;
  cooking_method?: string;
  is_edible?: boolean;
  confidence?: number;
}

export interface CalorieEstimation {
  calories: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  confidence?: number;
  explanation?: string;
  name?: string;
  weight?: number;
  is_edible?: boolean;
  candidates?: ImageFoodCandidate[];
  health_score?: number;
  alert_level?: 'green' | 'yellow' | 'red';
  analysis_report?: BalancedDietAnalysisReport;
}

export interface AIHealthCheckItem {
  provider: string;
  ok: boolean;
  latencyMs?: number;
  errorType?: string;
  message?: string;
  model?: string;
  responseSnippet?: string;
}

export interface AIHealthCheckEngineStatus {
  kind: 'text' | 'vision';
  provider: string;
  model: string;
  ok: boolean;
  latencyMs?: number;
  errorType?: string;
  message?: string;
  responseSnippet?: string;
}

export interface AIHealthCheckSummary {
  ok: boolean;
  text: AIHealthCheckEngineStatus;
  vision: AIHealthCheckEngineStatus;
}

export interface ImageFoodCandidate {
  name: string;
  confidence: number;
  estimated_weight_g: number;
  estimated_calories: number;
  calories_per_100g: number;
  protein_per_100g?: number;
  carbs_per_100g?: number;
  fats_per_100g?: number;
  is_edible?: boolean;
}

export interface FoodMacroRatio {
  protein_ratio: number;
  carbs_ratio: number;
  fats_ratio: number;
}

export interface BalancedDietAnalysisReport {
  summary?: string;
  plate_comment: string;
  vegetables_fruits_ratio: number;
  whole_grains_ratio: number;
  healthy_protein_ratio: number;
  score?: {
    vegetable_score?: number;
    grain_score?: number;
    protein_score?: number;
  };
  gi_level: 'low' | 'medium' | 'high';
  processing_level: 'minimally_processed' | 'processed' | 'ultra_processed';
  strengths: string[];
  weaknesses?: string[];
  risks: string[];
  improvements?: string[];
  suggestions: string[];
  reasoning?: string;
  education_tip: string;
}

export interface HealthAnalyticsMetrics {
  calories_in: number;
  calories_out: number;
  net_calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  habit_completion_rate: number;
  completed_habits: number;
  total_habits: number;
}

export interface DailyHealthInsightReport {
  title: string;
  status_tag: string;
  summary: string;
  sections: {
    overview: string;
    energy: string;
    diet: string;
    nutrition: string;
    activity: string;
    discipline: string;
    risks: string;
    next_actions: string[];
  };
  metrics: HealthAnalyticsMetrics;
}

export interface WeeklyHealthReport {
  title: string;
  status_tag: string;
  summary: string;
  week_range: string;
  sections: {
    overview: string;
    diet_trend: string;
    discipline_trend: string;
    high_risk_window: string;
    forecast: string;
    next_week_actions: string[];
  };
  metrics: {
    avg_calories_in: number;
    avg_calories_out: number;
    avg_net_calories: number;
    avg_habit_completion_rate: number;
    total_completed_habits: number;
    total_habits: number;
    max_streaks: Array<{
      habit_id: number;
      name: string;
      max_streak: number;
    }>;
  };
}

export interface BodyMetric {
  id: number;
  userId?: number;
  date: string;
  weight: number | null;
  chest: number | null;
  waist: number | null;
  thigh: number | null;
  photoUrl: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Habit {
  id: number;
  userId?: number;
  name: string;
  icon: string;
  color: string;
  frequencyType: 'daily' | 'weekly';
  frequencyValue: number;
  targetValue: number;
  unit: string;
  isActive: boolean;
  sortOrder: number;
}

export interface HabitTodayItem {
  habitId: number;
  name: string;
  icon: string;
  color: string;
  status: 'pending' | 'done' | 'missed';
  actualValue: number;
  targetValue: number;
  unit: string;
  current_streak?: number;
  date: string;
}

export interface HabitHeatmapCell {
  date: string;
  completed: number;
  total: number;
  rate: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface HabitHistoryPoint {
  date: string;
  status: 'pending' | 'done' | 'missed';
  value: number;
}

export interface HabitHistorySeries {
  points: HabitHistoryPoint[];
  max_streak: number;
}
