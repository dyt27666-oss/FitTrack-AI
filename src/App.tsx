import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Book,
  Bike,
  Brain,
  Check,
  Code,
  Coffee,
  CupSoda,
  Droplets,
  Flame,
  Heart,
  Moon,
  Smile,
  Sun,
  Utensils, 
  User, 
  Plus, 
  Pencil,
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles,
  Scale,
  Target,
  Camera,
  ChevronDown,
  MoonStar,
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend,
  CartesianGrid
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { Profile, Log, Food, CustomUnit, AIHealthCheckSummary } from './types';
import type { BodyMetric, BalancedDietAnalysisReport, Habit, HabitHeatmapCell, HabitHistorySeries, HabitTodayItem } from './types';
import { analyzeFoodImage, archiveHabit, checkInHabit, createHabit, estimateCalories, fetchHabitHeatmap, fetchHabitHistory, fetchHabits, fetchTodayHabits, generateDailyAdvice, healthCheckEngines, searchFoods, updateHabit } from './services/aiClient';
import { LLMManager } from './services/llmManager';
import { calculateNutritionFromWeight, resolveGramsPerUnit } from './utils/nutritionCalculator';
import { LogForm } from './components/LogForm';
import { FoodSearchSelect } from './components/FoodSearchSelect';
import { FastingPage, type FastingStatusView } from './components/FastingPage';
import { BodyMetricsPage } from './components/BodyMetricsPage';
import { SelfDisciplinePage } from './pages/SelfDisciplinePage';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'logs' | 'fasting' | 'bodyMetrics' | 'profile'>('dashboard');
  const [routePath, setRoutePath] = useState<string>(window.location.hash || '#/');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editProfile, setEditProfile] = useState<Partial<Profile>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [advice, setAdvice] = useState<string | null>(null);
  const [isGeneratingAdvice, setIsGeneratingAdvice] = useState(false);

  // Form states
  const [isAdding, setIsAdding] = useState<'food' | 'exercise' | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemAmount, setItemAmount] = useState('');
  const [exerciseType, setExerciseType] = useState('跑步');
  const [estimatedCalories, setEstimatedCalories] = useState<number | null>(null);
  const [estimatedMacros, setEstimatedMacros] = useState<{ protein: number; carbs: number; fats: number } | null>(null);
  const [estimatedWeight, setEstimatedWeight] = useState<number | null>(null);
  const [confidenceHint, setConfidenceHint] = useState<string | null>(null);
  const [analysisReport, setAnalysisReport] = useState<BalancedDietAnalysisReport | null>(null);
  const [healthScore, setHealthScore] = useState<number | null>(null);
  const [alertLevel, setAlertLevel] = useState<'green' | 'yellow' | 'red' | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isImageAnalyzing, setIsImageAnalyzing] = useState(false);
  const [healthStatus, setHealthStatus] = useState<AIHealthCheckSummary | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [fastingStatus, setFastingStatus] = useState<FastingStatusView | null>(null);
  const [selectedFastingPlan, setSelectedFastingPlan] = useState('16-8');
  const [isSubmittingFasting, setIsSubmittingFasting] = useState(false);
  const [bodyMetrics, setBodyMetrics] = useState<BodyMetric[]>([]);
  const [isSavingBodyMetric, setIsSavingBodyMetric] = useState(false);
  const [isDeletingBodyMetric, setIsDeletingBodyMetric] = useState(false);
  const [todayHabits, setTodayHabits] = useState<HabitTodayItem[]>([]);
  const [habitHeatmap, setHabitHeatmap] = useState<HabitHeatmapCell[]>([]);
  const [habitSummaryDate, setHabitSummaryDate] = useState(new Date().toISOString().slice(0, 10));
  const [isSyncingHabits, setIsSyncingHabits] = useState(false);
  const [habitCatalog, setHabitCatalog] = useState<Habit[]>([]);
  const [habitHistory, setHabitHistory] = useState<Record<number, HabitHistorySeries>>({});

  const EXERCISE_METS: Record<string, number> = {
    '跑步': 7.0,
    '游泳': 8.0,
    '骑行': 7.5,
    '瑜伽': 3.0,
    '力量训练': 5.0,
    '慢跑': 7.0,
    '台球': 2.5,
    '爬坡': 6.0,
    '爬楼梯': 9.0
  };

  const calculateExerciseCalories = (type: string, duration: number, weight: number) => {
    const met = EXERCISE_METS[type] || 5.0; // Default to 5 if unknown
    // Formula: Calories = MET * Weight(kg) * Time(hours)
    // Or: Calories = (MET * 3.5 * Weight / 200) * Duration(min)
    // Standard simplified: Calories = MET * Weight * (Duration/60)
    return Math.round(met * weight * (duration / 60));
  };
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [customUnits, setCustomUnits] = useState<CustomUnit[]>([]);
  const [newUnit, setNewUnit] = useState<Partial<CustomUnit>>({});
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<string>('g'); // 'g' or unit id
  const [selectedFoodId, setSelectedFoodId] = useState<number | null>(null);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [unitTargetFood, setUnitTargetFood] = useState<Food | null>(null);
  const [editingLog, setEditingLog] = useState<Log | null>(null);
  const [availableTextModels, setAvailableTextModels] = useState<string[]>([]);
  const [availableVisionModels, setAvailableVisionModels] = useState<string[]>([]);

  useEffect(() => {
    if (editProfile.text_ai_provider) {
      setAvailableTextModels(LLMManager.getAvailableTextModels(editProfile.text_ai_provider));
    }
  }, [editProfile.text_ai_provider]);

  useEffect(() => {
    if (editProfile.vision_ai_provider) {
      setAvailableVisionModels(LLMManager.getAvailableVisionModels(editProfile.vision_ai_provider));
    }
  }, [editProfile.vision_ai_provider]);

  useEffect(() => {
    const onHashChange = () => setRoutePath(window.location.hash || '#/');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchLogs();
    fetchBodyMetrics();
    fetchDisciplineData();
    // fetchUnits(); // Don't fetch all units globally anymore, fetch per food
  }, [selectedDate]);

  useEffect(() => {
    fetchFastingStatus();
  }, []);

  useEffect(() => {
    if (!fastingStatus?.active) return;
    const timer = window.setInterval(() => {
      fetchFastingStatus();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [fastingStatus?.active]);

  const fetchUnits = async (foodId?: number) => {
    if (!foodId) {
      setCustomUnits([]);
      return;
    }
    const res = await fetch(`/api/units?food_id=${foodId}`);
    const data = await res.json();
    setCustomUnits(Array.isArray(data) ? data : []);
  };

  const fetchProfile = async () => {
    const res = await fetch('/api/profile');
    const data = await res.json();
    setProfile(data);
    setEditProfile(data);
  };

  const fetchLogs = async () => {
    setLoading(true);
    const res = await fetch(`/api/logs/${selectedDate}`);
    const data = await res.json();
    setLogs(data);
    setLoading(false);
  };

  const fetchFastingStatus = async () => {
    const res = await fetch('/api/fasting/current');
    const data = await res.json();
    setFastingStatus(data);
  };

  const fetchBodyMetrics = async () => {
    const res = await fetch('/api/body-metrics');
    const data = await res.json();
    setBodyMetrics(Array.isArray(data) ? data : []);
  };

  const fetchDisciplineData = async () => {
    try {
      const [today, heatmap, habits] = await Promise.all([fetchTodayHabits(), fetchHabitHeatmap(90), fetchHabits()]);
      setTodayHabits(Array.isArray(today.habits) ? today.habits : []);
      setHabitSummaryDate(today.date);
      setHabitHeatmap(Array.isArray(heatmap) ? heatmap : []);
      setHabitCatalog(Array.isArray(habits) ? habits : []);
    } catch (error) {
      console.error('Failed to fetch discipline data', error);
    }
  };

  const handleHabitCheckIn = async (habitId: number, status: 'done' | 'missed') => {
    setIsSyncingHabits(true);
    try {
      await checkInHabit(habitId, status);
      await fetchDisciplineData();
      setToast({ message: status === 'done' ? '习惯已打卡' : '已标记为未完成', type: 'success' });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : '更新自律任务失败', type: 'error' });
    } finally {
      setIsSyncingHabits(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleCreateHabit = async (payload: {
    name: string;
    icon?: string;
    color?: string;
    frequencyType?: 'daily' | 'weekly';
    frequencyValue?: number;
    targetValue?: number;
    unit?: string;
  }) => {
    setIsSyncingHabits(true);
    try {
      await createHabit(payload);
      await fetchDisciplineData();
      setToast({ message: '自律目标已创建', type: 'success' });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : '创建目标失败', type: 'error' });
    } finally {
      setIsSyncingHabits(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleUpdateHabit = async (habitId: number, payload: {
    name: string;
    icon?: string;
    color?: string;
    frequencyType?: 'daily' | 'weekly';
    frequencyValue?: number;
    targetValue?: number;
    unit?: string;
  }) => {
    setIsSyncingHabits(true);
    try {
      await updateHabit(habitId, payload);
      await fetchDisciplineData();
      setToast({ message: '自律目标已更新', type: 'success' });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : '更新目标失败', type: 'error' });
    } finally {
      setIsSyncingHabits(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleArchiveHabit = async (habitId: number) => {
    setIsSyncingHabits(true);
    try {
      await archiveHabit(habitId);
      await fetchDisciplineData();
      setToast({ message: '目标已归档', type: 'success' });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : '归档目标失败', type: 'error' });
    } finally {
      setIsSyncingHabits(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleLoadHabitHistory = async (habitId: number) => {
    if (habitHistory[habitId]) return;
    try {
      const series = await fetchHabitHistory(habitId, 30);
      setHabitHistory((current) => ({ ...current, [habitId]: series }));
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : '加载趋势失败', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleStartFasting = async () => {
    setIsSubmittingFasting(true);
    try {
      const res = await fetch('/api/fasting/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_type: selectedFastingPlan }),
      });
      const data = await res.json();
      if (res.ok) {
        setFastingStatus(data);
        setToast({ message: `断食已开始：${selectedFastingPlan}`, type: 'success' });
      } else {
        setToast({ message: data.error || '开始断食失败', type: 'error' });
      }
    } finally {
      setIsSubmittingFasting(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleEndFasting = async () => {
    setIsSubmittingFasting(true);
    try {
      const res = await fetch('/api/fasting/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok) {
        await fetchFastingStatus();
        setToast({ message: data.status === 'completed' ? '断食已完成' : '断食已提前结束', type: 'success' });
      } else {
        setToast({ message: data.error || '结束断食失败', type: 'error' });
      }
    } finally {
      setIsSubmittingFasting(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleCreateBodyMetric = async (payload: {
    date: string;
    weight?: number | null;
    chest?: number | null;
    waist?: number | null;
    thigh?: number | null;
    photo_url?: string | null;
  }) => {
    setIsSavingBodyMetric(true);
    try {
      const res = await fetch('/api/body-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchBodyMetrics();
        setToast({ message: '身体档案已保存', type: 'success' });
      } else {
        setToast({ message: data.error || '保存身体档案失败', type: 'error' });
      }
    } finally {
      setIsSavingBodyMetric(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleDeleteBodyMetric = async (id: number) => {
    setIsDeletingBodyMetric(true);
    try {
      const res = await fetch(`/api/body-metrics/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        await fetchBodyMetrics();
        setToast({ message: '身体档案已删除', type: 'success' });
      } else {
        setToast({ message: data.error || '删除身体档案失败', type: 'error' });
      }
    } finally {
      setIsDeletingBodyMetric(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const fetchFoodById = async (foodId: number): Promise<Food | null> => {
    const res = await fetch(`/api/foods/${foodId}`);
    if (!res.ok) return null;
    return (await res.json()) as Food;
  };

  const selectFoodForLog = async (food: Food) => {
    setItemName(food.name);
    setSelectedFood(food);
    setSelectedFoodId(food.id);
    setUnitTargetFood(food);
    setSelectedUnit('g');
    setEstimatedCalories(null);
    setEstimatedMacros(null);
    setEstimatedWeight(null);
    setConfidenceHint(null);
    setAnalysisReport(null);
    setHealthScore(null);
    setAlertLevel(null);
    await fetchUnits(food.id);
    if (!itemAmount) {
      setItemAmount('100');
    }
  };

  const openCreateLogModal = (type: 'food' | 'exercise') => {
    closeAddModal();
    setIsAdding(type);
  };

  const handleSelectUnitTargetFood = async (food: Food) => {
    setUnitTargetFood(food);
    await fetchUnits(food.id);
  };

  const handleEditLog = async (log: Log) => {
    closeAddModal();
    setEditingLog(log);
    setIsAdding(log.type);
    setItemName(log.name.replace(/\s*\([^)]*\)\s*$/, ''));
    setItemAmount(String(log.amount || ''));
    setEstimatedCalories(log.calories);
    setEstimatedMacros({
      protein: log.protein || 0,
      carbs: log.carbs || 0,
      fats: log.fats || 0,
    });
    setEstimatedWeight(log.grams || null);
    setConfidenceHint(log.type === 'food' ? '编辑模式：修改数量或单位后会重新计算热量与 P/C/F' : null);
    setAnalysisReport(null);
    setHealthScore(null);
    setAlertLevel(null);

    if (log.type === 'food' && log.food_id) {
      const food = await fetchFoodById(log.food_id);
      if (food) {
        setSelectedFood(food);
        setSelectedFoodId(food.id);
        await fetchUnits(food.id);
      }
      if (log.unit_name) {
        if (log.unit_name === 'g') {
          setSelectedUnit('g');
        } else {
          const units = await fetch(`/api/units?food_id=${log.food_id}`).then((res) => res.json()) as CustomUnit[];
          setCustomUnits(Array.isArray(units) ? units : []);
          const matchedUnit = units.find((unit) => unit.name === log.unit_name);
          setSelectedUnit(matchedUnit ? String(matchedUnit.id) : 'g');
        }
      }
    }
  };

  const handleAddCustomFood = async (payload: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  }) => {
    const res = await fetch('/api/foods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    const createdFood = data?.id ? await fetchFoodById(Number(data.id)) : null;
    if (createdFood) {
      await selectFoodForLog(createdFood);
    } else {
      setItemName(payload.name);
      setEstimatedCalories(payload.calories);
      setEstimatedMacros({
        protein: payload.protein,
        carbs: payload.carbs,
        fats: payload.fats,
      });
    }
  };

  const closeAddModal = () => {
    setIsAdding(null);
    setEditingLog(null);
    setItemName('');
    setItemAmount('');
    setEstimatedCalories(null);
    setEstimatedMacros(null);
    setEstimatedWeight(null);
    setConfidenceHint(null);
    setAnalysisReport(null);
    setHealthScore(null);
    setAlertLevel(null);
    setIsImageAnalyzing(false);
    setSelectedUnit('g');
    setSelectedFoodId(null);
    setSelectedFood(null);
    setUnitTargetFood(null);
    setCustomUnits([]);
  };

  const handleAddLog = async (type: 'food' | 'exercise', manualData?: any) => {
    if (!manualData && (!itemName || !itemAmount)) return;
    
    setIsEstimating(true);
    try {
      let dataToLog;
      if (manualData) {
        dataToLog = {
          date: selectedDate,
          ...manualData
        };
      } else {
        const name = type === 'exercise' ? exerciseType : itemName;
        const estimation = await estimateCalories(profile, name, type, parseFloat(itemAmount));
        if (estimation) {
          dataToLog = {
            date: selectedDate,
            name: name,
            amount: parseFloat(itemAmount),
            calories: estimatedCalories || estimation.calories,
            protein: estimatedMacros?.protein ?? estimation.protein ?? 0,
            carbs: estimatedMacros?.carbs ?? estimation.carbs ?? 0,
            fats: estimatedMacros?.fats ?? estimation.fats ?? 0
          };
        }
      }

      if (dataToLog) {
        const res = await fetch(`/api/logs/${type}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataToLog)
        });
        if (res.ok) {
          fetchLogs();
          closeAddModal();
          setToast({ message: '记录已添加', type: 'success' });
          setTimeout(() => setToast(null), 3000);
        } else {
          setToast({ message: '添加失败', type: 'error' });
          setTimeout(() => setToast(null), 3000);
        }
      }
    } catch (error) {
      console.error("Error adding log:", error);
      setToast({ message: '添加出错', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsEstimating(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    closeAddModal();
    setIsAdding('food');
    setIsEstimating(true);
    setIsImageAnalyzing(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        const analysis = await analyzeFoodImage(profile, base64);
        if (analysis) {
        const applyEstimate = (payload: {
          name: string;
          weight: number;
          calories: number;
          protein: number;
          carbs: number;
          fats: number;
          hint: string;
        }) => {
          setItemName(payload.name);
          setItemAmount(String(payload.weight || 100));
          setEstimatedWeight(payload.weight || 100);
          setEstimatedCalories(payload.calories || 0);
          setEstimatedMacros({
            protein: payload.protein || 0,
            carbs: payload.carbs || 0,
            fats: payload.fats || 0,
          });
          setConfidenceHint(payload.hint);
          setAnalysisReport(analysis.analysis_report || null);
          setHealthScore(analysis.health_score ?? null);
          setAlertLevel(
            analysis.alert_level ??
              (typeof analysis.health_score === 'number'
                ? analysis.health_score >= 80
                  ? 'green'
                  : analysis.health_score >= 60
                    ? 'yellow'
                    : 'red'
                : null)
          );
          setSelectedUnit('g');
          setIsAdding('food');
          setIsImageAnalyzing(false);
        };

        const fallbackHint = analysis.explanation || '由于图片模糊或网络超时，此为系统默认估算值，请手动微调。';

        if (analysis.is_edible === false) {
          setToast({ message: '识别到不可食用对象，请手动录入', type: 'error' });
          setTimeout(() => setToast(null), 3000);
          setIsImageAnalyzing(false);
          setIsEstimating(false);
          return;
        }

        const confidence = analysis.confidence || 0;
        const matchedFoods = analysis.name ? ((await searchFoods(analysis.name, false)) as unknown as Food[]) : [];
        const matchedFood = matchedFoods[0] || null;

        if (matchedFood) {
          setSelectedFood(matchedFood);
          setSelectedFoodId(matchedFood.id);
          await fetchUnits(matchedFood.id);
        } else {
          setSelectedFood(null);
          setSelectedFoodId(null);
          setCustomUnits([]);
        }

        if (confidence > 80) {
          applyEstimate({
            name: matchedFood?.name || analysis.name || '',
            weight: analysis.weight || 100,
            calories: matchedFood
              ? Math.round((((matchedFood.calories_per_100g ?? matchedFood.calories) * (analysis.weight || 100)) / 100) * 10) / 10
              : analysis.calories || 0,
            protein: matchedFood
              ? Math.round((((matchedFood.protein_per_100g ?? matchedFood.protein) * (analysis.weight || 100)) / 100) * 10) / 10
              : analysis.protein || 0,
            carbs: matchedFood
              ? Math.round((((matchedFood.carbs_per_100g ?? matchedFood.carbs) * (analysis.weight || 100)) / 100) * 10) / 10
              : analysis.carbs || 0,
            fats: matchedFood
              ? Math.round((((matchedFood.fats_per_100g ?? matchedFood.fats) * (analysis.weight || 100)) / 100) * 10) / 10
              : analysis.fats || 0,
            hint: analysis.explanation || 'AI 高置信度预估',
          });
        } else if (confidence > 40) {
          const candidates = analysis.candidates || [];
          if (candidates.length >= 2) {
            const c1 = candidates[0];
            const c2 = candidates[1];
            const chooseFirst = window.confirm(`这可能是“${c1.name}”（确定）或“${c2.name}”（取消）`);
            const picked = chooseFirst ? c1 : c2;
            const fallbackWeight = picked.estimated_weight_g || analysis.weight || 100;
            applyEstimate({
              name: matchedFood?.name || picked.name || analysis.name || '',
              weight: fallbackWeight,
              calories: matchedFood
                ? Math.round((((matchedFood.calories_per_100g ?? matchedFood.calories) * fallbackWeight) / 100) * 10) / 10
                : picked.estimated_calories ||
                  analysis.calories ||
                  Math.round(((picked.calories_per_100g || 0) * fallbackWeight) / 100),
              protein: matchedFood
                ? Math.round((((matchedFood.protein_per_100g ?? matchedFood.protein) * fallbackWeight) / 100) * 10) / 10
                : analysis.protein ||
                  Math.round((((picked.protein_per_100g || 0) * fallbackWeight) / 100) * 10) / 10,
              carbs: matchedFood
                ? Math.round((((matchedFood.carbs_per_100g ?? matchedFood.carbs) * fallbackWeight) / 100) * 10) / 10
                : analysis.carbs ||
                  Math.round((((picked.carbs_per_100g || 0) * fallbackWeight) / 100) * 10) / 10,
              fats: matchedFood
                ? Math.round((((matchedFood.fats_per_100g ?? matchedFood.fats) * fallbackWeight) / 100) * 10) / 10
                : analysis.fats ||
                  Math.round((((picked.fats_per_100g || 0) * fallbackWeight) / 100) * 10) / 10,
              hint: analysis.explanation || 'AI 中置信度预估，请确认后保存',
            });
            setToast({ message: '识别置信度中等，请确认后保存', type: 'success' });
            setTimeout(() => setToast(null), 3000);
          } else {
            applyEstimate({
              name: matchedFood?.name || analysis.name || itemName || 'AI estimate',
              weight: analysis.weight || 100,
              calories: matchedFood
                ? Math.round((((matchedFood.calories_per_100g ?? matchedFood.calories) * (analysis.weight || 100)) / 100) * 10) / 10
                : analysis.calories || 0,
              protein: matchedFood
                ? Math.round((((matchedFood.protein_per_100g ?? matchedFood.protein) * (analysis.weight || 100)) / 100) * 10) / 10
                : analysis.protein || 0,
              carbs: matchedFood
                ? Math.round((((matchedFood.carbs_per_100g ?? matchedFood.carbs) * (analysis.weight || 100)) / 100) * 10) / 10
                : analysis.carbs || 0,
              fats: matchedFood
                ? Math.round((((matchedFood.fats_per_100g ?? matchedFood.fats) * (analysis.weight || 100)) / 100) * 10) / 10
                : analysis.fats || 0,
              hint: fallbackHint,
            });
            setToast({ message: '识别不够稳定，已给出 AI 预估值', type: 'error' });
            setTimeout(() => setToast(null), 3000);
          }
        } else {
          applyEstimate({
            name: matchedFood?.name || analysis.name || itemName || 'AI estimate',
            weight: analysis.weight || Number(itemAmount) || 100,
            calories: matchedFood
              ? Math.round((((matchedFood.calories_per_100g ?? matchedFood.calories) * (analysis.weight || Number(itemAmount) || 100)) / 100) * 10) / 10
              : analysis.calories || 0,
            protein: matchedFood
              ? Math.round((((matchedFood.protein_per_100g ?? matchedFood.protein) * (analysis.weight || Number(itemAmount) || 100)) / 100) * 10) / 10
              : analysis.protein || 0,
            carbs: matchedFood
              ? Math.round((((matchedFood.carbs_per_100g ?? matchedFood.carbs) * (analysis.weight || Number(itemAmount) || 100)) / 100) * 10) / 10
              : analysis.carbs || 0,
            fats: matchedFood
              ? Math.round((((matchedFood.fats_per_100g ?? matchedFood.fats) * (analysis.weight || Number(itemAmount) || 100)) / 100) * 10) / 10
              : analysis.fats || 0,
            hint: fallbackHint,
          });
          setToast({ message: '置信度较低，以下为 AI 预估值，请手动修正后保存', type: 'error' });
          setTimeout(() => setToast(null), 3000);
        }
      }
      } finally {
        setIsEstimating(false);
        setIsImageAnalyzing(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGetAdvice = async () => {
    if (!profile || logs.length === 0) return;
    setIsGeneratingAdvice(true);
    try {
      const result = await generateDailyAdvice(logs, profile);
      setAdvice(result);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingAdvice(false);
    }
  };

  const handleHealthCheck = async () => {
    setIsCheckingHealth(true);
    const result = await healthCheckEngines();
    setHealthStatus(result);
    setIsCheckingHealth(false);
  };

  const handleSubmitLogForm = async () => {
    if (!isAdding) return;

    if (isAdding === 'food' && previewCalories !== null) {
      const payload = {
        date: selectedDate,
        type: 'food' as const,
        name: itemName + (selectedUnit !== 'g' ? ` (${selectedUnitOption?.name || ''})` : ''),
        amount: parseFloat(itemAmount),
        food_id: selectedFoodId,
        unit_name: selectedUnitName,
        calories: previewCalories,
        protein: previewMacros?.protein ?? estimatedMacros?.protein ?? 0,
        carbs: previewMacros?.carbs ?? estimatedMacros?.carbs ?? 0,
        fats: previewMacros?.fats ?? estimatedMacros?.fats ?? 0,
      };
      const url = editingLog ? `/api/logs/${editingLog.id}` : `/api/logs/food`;
      const method = editingLog ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await fetchLogs();
        closeAddModal();
        setToast({ message: editingLog ? '记录已更新' : '记录已添加', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      }
      return;
    }

    if (isAdding === 'exercise' && estimatedCalories !== null) {
      const payload = {
        date: selectedDate,
        type: 'exercise' as const,
        name: exerciseType,
        amount: parseFloat(itemAmount),
        calories: estimatedCalories,
        protein: estimatedMacros?.protein ?? 0,
        carbs: estimatedMacros?.carbs ?? 0,
        fats: estimatedMacros?.fats ?? 0,
      };
      const url = editingLog ? `/api/logs/${editingLog.id}` : `/api/logs/exercise`;
      const method = editingLog ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await fetchLogs();
        closeAddModal();
        setToast({ message: editingLog ? '记录已更新' : '记录已添加', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      }
      return;
    }

    if (isAdding === 'exercise' && profile) {
      const calories = calculateExerciseCalories(exerciseType, parseFloat(itemAmount), profile.weightKg ?? profile.weight ?? 70);
      setEstimatedCalories(calories);
      setEstimatedMacros({ protein: 0, carbs: 0, fats: 0 });
      setConfidenceHint('运动热量已按 MET 公式估算，确认后可保存');
      return;
    }

    setIsEstimating(true);
    try {
      const name = isAdding === 'food' ? itemName : exerciseType;
      const est = await estimateCalories(profile, name, isAdding, parseFloat(itemAmount));
      if (est) {
        setEstimatedCalories(est.calories);
        setEstimatedMacros({
          protein: est.protein || 0,
          carbs: est.carbs || 0,
          fats: est.fats || 0,
        });
        setEstimatedWeight(parseFloat(itemAmount));
        setConfidenceHint('AI 预估值，可手动修改后保存');
      }
    } finally {
      setIsEstimating(false);
    }
  };

  const handleDeleteLog = async (id: number) => {
    const res = await fetch(`/api/logs/${id}`, { method: 'DELETE' });
    if (res.ok) fetchLogs();
  };

  const updateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editProfile)
      });
      if (res.ok) {
        await fetchProfile();
        setToast({ message: '个人资料已更新', type: 'success' });
      } else {
        setToast({ message: '更新失败，请重试', type: 'error' });
      }
    } catch (e) {
      setToast({ message: '网络错误', type: 'error' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const isProfileDirty = JSON.stringify(profile) !== JSON.stringify(editProfile);
  const isDisciplineRoute = routePath === '#/discipline';
  const habitIconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
    check: Check,
    flame: Flame,
    book: Book,
    cup: CupSoda,
    bike: Bike,
    heart: Heart,
    brain: Brain,
    moon: Moon,
    sun: Sun,
    camera: Camera,
    code: Code,
    coffee: Coffee,
    utensils: Utensils,
    smile: Smile,
    pencil: Pencil,
    target: Target,
    droplets: Droplets,
    activity: Activity,
  };

  const caloriesIn = logs.filter(l => l.type === 'food').reduce((acc, l) => acc + l.calories, 0);
  const caloriesOut = logs.filter(l => l.type === 'exercise').reduce((acc, l) => acc + l.calories, 0);
  const totalProtein = logs.filter(l => l.type === 'food').reduce((acc, l) => acc + (l.protein || 0), 0);
  const totalCarbs = logs.filter(l => l.type === 'food').reduce((acc, l) => acc + (l.carbs || 0), 0);
  const totalFats = logs.filter(l => l.type === 'food').reduce((acc, l) => acc + (l.fats || 0), 0);
  
  const calculateTDEE = (p: Partial<Profile>) => {
    if (!p.weight || !p.height || !p.age) return 2000;
    // Mifflin-St Jeor Equation
    let bmr = (10 * p.weight) + (6.25 * p.height) - (5 * p.age);
    if (p.gender === '男') bmr += 5;
    else if (p.gender === '女') bmr -= 161;
    else bmr -= 80; // Neutral/Other average
    
    return Math.round(bmr * (p.activity_level || 1.2));
  };

  const currentTdee = calculateTDEE(editProfile);
  const tdee = profile ? calculateTDEE(profile) : 2000;
  const netCalories = caloriesIn - caloriesOut;
  const goalCalories = profile?.goal_calories || tdee;
  const remaining = goalCalories - netCalories;
  const doneHabitCount = todayHabits.filter((habit) => habit.status === 'done').length;
  const disciplineProgress = todayHabits.length ? Math.round((doneHabitCount / todayHabits.length) * 100) : 0;
  const disciplinePreviewHabits = todayHabits.slice(0, 4);

  const macroData = [
    { name: '蛋白质', value: totalProtein * 4, color: '#10b981' },
    { name: '碳水', value: totalCarbs * 4, color: '#3b82f6' },
    { name: '脂肪', value: totalFats * 9, color: '#f59e0b' },
  ].filter(d => d.value > 0);

  const chartData = [
    { name: '摄入', kcal: caloriesIn, fill: '#10b981' },
    { name: '消耗', kcal: caloriesOut, fill: '#f97316' },
    { name: '净值', kcal: netCalories, fill: '#3b82f6' },
  ];

  const amountNumber = Number(itemAmount || 0);
  const selectedUnitOption = selectedUnit === 'g'
    ? { id: 'g', name: '克', weight_g: 1 }
    : customUnits.find((u) => u.id.toString() === selectedUnit);
  const selectedUnitName = selectedUnit === 'g' ? 'g' : selectedUnitOption?.name || null;
  const gramsPerUnit = resolveGramsPerUnit(
    selectedUnitName,
    customUnits.map((unit) => ({ name: unit.name, gramsPerUnit: unit.weight_g }))
  );
  const liveFoodPreview =
    selectedFood && amountNumber > 0 && gramsPerUnit
      ? calculateNutritionFromWeight(amountNumber, gramsPerUnit, {
          caloriesPer100g: selectedFood.calories_per_100g ?? selectedFood.calories,
          proteinPer100g: selectedFood.protein_per_100g ?? selectedFood.protein,
          carbsPer100g: selectedFood.carbs_per_100g ?? selectedFood.carbs,
          fatsPer100g: selectedFood.fats_per_100g ?? selectedFood.fats,
        })
      : null;
  const previewCalories = liveFoodPreview?.totalCalories ?? estimatedCalories;
  const previewMacros = liveFoodPreview
    ? {
        protein: liveFoodPreview.totalProtein,
        carbs: liveFoodPreview.totalCarbs,
        fats: liveFoodPreview.totalFats,
      }
    : estimatedMacros;
  const previewMacroRatio = liveFoodPreview?.macroRatio;
  const previewWeight = liveFoodPreview?.totalWeight ?? estimatedWeight;
  const sliderMin = selectedUnit === 'g' ? 10 : 0.5;
  const sliderMax = selectedUnit === 'g' ? 600 : 5;
  const sliderStep = selectedUnit === 'g' ? 10 : 0.1;
  const latestBodyMetric = bodyMetrics[0] || null;
  const previousBodyMetric = bodyMetrics[1] || null;
  const weightDelta =
    latestBodyMetric?.weight != null && previousBodyMetric?.weight != null
      ? Number((latestBodyMetric.weight - previousBodyMetric.weight).toFixed(1))
      : null;
  const weightDeltaTone =
    weightDelta == null
      ? 'bg-black/5 text-black/45'
      : weightDelta < 0
        ? 'bg-emerald-100 text-emerald-700'
        : profile?.goal === '减脂'
          ? 'bg-rose-100 text-rose-700'
          : 'bg-amber-100 text-amber-700';
  const weightDeltaLabel =
    weightDelta == null ? '等待第二条记录' : `${weightDelta > 0 ? '↑' : '↓'}${Math.abs(weightDelta).toFixed(1)}kg`;

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans pb-24">
      {/* Header */}
      <header className="bg-white border-b border-black/5 sticky top-0 z-10 backdrop-blur-md bg-white/80">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-lg shadow-black/10">
              <Activity className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="font-black text-xl tracking-tight leading-none">FitTrack AI</h1>
              <p className="text-[10px] text-black/40 font-bold uppercase tracking-widest">智能健身助手</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-[#F0F0F0] rounded-full px-2 py-1">
            <button 
              onClick={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() - 1);
                setSelectedDate(d.toISOString().split('T')[0]);
              }}
              className="p-2 hover:bg-white rounded-full transition-all shadow-sm"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-bold min-w-[80px] text-center">
              {selectedDate === new Date().toISOString().split('T')[0] ? '今天' : selectedDate}
            </span>
            <button 
              onClick={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() + 1);
                setSelectedDate(d.toISOString().split('T')[0]);
              }}
              className="p-2 hover:bg-white rounded-full transition-all shadow-sm"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {!isDisciplineRoute && activeTab === 'dashboard' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Summary Card */}
            <div className="bg-white rounded-[40px] p-8 shadow-xl shadow-black/5 border border-black/5 relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-xs font-bold text-black/30 uppercase tracking-widest">今日热量预算</p>
                  <div className="flex items-center gap-1 text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full text-[10px] font-bold">
                    <Target size={12} />
                    <span>目标: {goalCalories}</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <h2 className={`text-7xl font-black tracking-tighter ${remaining < 0 ? 'text-red-500' : 'text-black'}`}>
                    {remaining}
                  </h2>
                  <span className="text-xl font-bold text-black/20">kcal 剩余</span>
                </div>
                
                <div className="mt-8 grid grid-cols-3 gap-4 border-t border-black/5 pt-6">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-black/40">
                      <Utensils size={12} />
                      <p className="text-[10px] uppercase font-bold tracking-wider">摄入</p>
                    </div>
                    <p className="text-lg font-black text-emerald-600">+{caloriesIn}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-black/40">
                      <Flame size={12} />
                      <p className="text-[10px] uppercase font-bold tracking-wider">消耗</p>
                    </div>
                    <p className="text-lg font-black text-orange-600">-{caloriesOut}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-black/40">
                      <Scale size={12} />
                      <p className="text-[10px] uppercase font-bold tracking-wider">净值</p>
                    </div>
                    <p className="text-lg font-black text-blue-600">{netCalories}</p>
                  </div>
                </div>

                {/* Macros */}
                <div className="mt-6 grid grid-cols-3 gap-2">
                  <div className="bg-[#F8F9FA] rounded-2xl p-3">
                    <p className="text-[9px] font-bold text-black/30 uppercase">蛋白质</p>
                    <p className="text-sm font-bold">{totalProtein.toFixed(1)}g</p>
                  </div>
                  <div className="bg-[#F8F9FA] rounded-2xl p-3">
                    <p className="text-[9px] font-bold text-black/30 uppercase">碳水</p>
                    <p className="text-sm font-bold">{totalCarbs.toFixed(1)}g</p>
                  </div>
                  <div className="bg-[#F8F9FA] rounded-2xl p-3">
                    <p className="text-[9px] font-bold text-black/30 uppercase">脂肪</p>
                    <p className="text-sm font-bold">{totalFats.toFixed(1)}g</p>
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-black/5">
                  <div className="h-48">
                    <p className="text-[10px] font-bold text-black/30 uppercase tracking-widest mb-4">热量概览</p>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis fontSize={10} axisLine={false} tickLine={false} />
                        <Tooltip 
                          cursor={{fill: 'rgba(0,0,0,0.05)'}} 
                          contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px'}}
                          itemStyle={{fontWeight: 'bold', fontSize: '12px'}}
                        />
                        <Bar dataKey="kcal" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-48">
                    <p className="text-[10px] font-bold text-black/30 uppercase tracking-widest mb-4">营养分布 (kcal)</p>
                    {macroData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={macroData}
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={8}
                            dataKey="value"
                            stroke="none"
                          >
                            {macroData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}}
                            itemStyle={{fontWeight: 'bold', fontSize: '12px'}}
                          />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: 'bold'}} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-[10px] text-black/20 font-bold">暂无数据</div>
                    )}
                  </div>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 h-2 bg-emerald-500 transition-all duration-700 ease-out" style={{ width: `${Math.min((netCalories / goalCalories) * 100, 100)}%` }} />
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('bodyMetrics')}
              className="w-full rounded-[36px] border border-black/5 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_38%,#f5f7f4_100%)] p-6 text-left shadow-[0_28px_60px_-36px_rgba(15,23,42,0.35)] transition-all hover:shadow-[0_32px_72px_-34px_rgba(15,23,42,0.38)]"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-black/35">Body Status</p>
                  <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">身体状态预览</h3>
                  <div className="mt-4 flex items-end gap-3">
                    <p className="text-4xl font-black text-slate-950">
                      {latestBodyMetric?.weight != null ? `${latestBodyMetric.weight.toFixed(1)}kg` : '--'}
                    </p>
                    <div className={`rounded-full px-3 py-1 text-xs font-black ${weightDeltaTone}`}>
                      {weightDeltaLabel}
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-bold text-slate-500">
                    {latestBodyMetric
                      ? `最近记录于 ${latestBodyMetric.date}，腰围 ${latestBodyMetric.waist ?? '--'}cm，胸围 ${latestBodyMetric.chest ?? '--'}cm`
                      : '还没有身体档案记录，建议先添加体重和围度。'}
                  </p>
                </div>
                <div className="shrink-0">
                  {latestBodyMetric?.photoUrl ? (
                    <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-white shadow-lg">
                      <img src={latestBodyMetric.photoUrl} alt="latest body" className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-black/10 bg-white text-xs font-black text-black/30">
                      无照片
                    </div>
                  )}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                window.location.hash = '#/discipline';
              }}
              className="w-full rounded-[36px] border border-black/5 bg-[linear-gradient(135deg,#ecfccb_0%,#ffffff_42%,#f8fafc_100%)] p-6 text-left shadow-[0_28px_60px_-36px_rgba(22,163,74,0.24)] transition-all hover:shadow-[0_32px_72px_-34px_rgba(22,163,74,0.28)]"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-black/35">Discipline Quick View</p>
                  <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">今日自律进度</h3>
                  <div className="mt-4 flex items-end gap-3">
                    <p className="text-4xl font-black text-slate-950">
                      {doneHabitCount}/{todayHabits.length}
                    </p>
                    <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
                      {disciplineProgress}%
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-bold text-slate-500">
                    {todayHabits.length
                      ? `已完成 ${doneHabitCount} 个目标，继续保持连续打卡。`
                      : '还没有自律目标，点击后创建第一条习惯。'}
                  </p>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/80">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-400 transition-all duration-500"
                      style={{
                        width: `${disciplineProgress}%`,
                      }}
                    />
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    {disciplinePreviewHabits.length > 0 ? (
                      disciplinePreviewHabits.map((habit) => {
                        const HabitIcon = habitIconMap[habit.icon] || Activity;
                        return (
                          <div key={habit.habitId} className="group relative">
                            <div
                              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/80 shadow-sm"
                              style={{ backgroundColor: habit.color || '#16a34a', color: '#ffffff' }}
                            >
                              <HabitIcon size={18} />
                            </div>
                            <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 rounded-full bg-slate-950 px-3 py-1 text-[10px] font-black text-white opacity-0 transition-opacity group-hover:opacity-100 whitespace-nowrap">
                              {habit.name}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs font-bold text-black/35">创建习惯后，这里会显示正在坚持的目标。</p>
                    )}
                  </div>
                </div>
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-4 border-white bg-slate-950 text-white shadow-lg">
                  <Target size={28} />
                </div>
              </div>
            </button>

            {/* AI Advice Section */}
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[32px] p-6 text-white shadow-lg shadow-indigo-500/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Brain size={20} />
                  <h3 className="font-bold">AI 健康建议</h3>
                </div>
                <button 
                  onClick={handleGetAdvice}
                  disabled={isGeneratingAdvice || logs.length === 0}
                  className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-md transition-all disabled:opacity-50"
                >
                  {isGeneratingAdvice ? '生成中...' : '获取建议'}
                </button>
              </div>
              {advice ? (
                <p className="text-sm leading-relaxed opacity-90">{advice}</p>
              ) : (
                <p className="text-sm opacity-70 italic">记录一些饮食和运动，让 AI 为您提供专业评价和建议。</p>
              )}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-4">
              <button 
                onClick={() => openCreateLogModal('food')}
                className="bg-white p-4 rounded-3xl border border-black/5 shadow-sm hover:border-emerald-500/30 transition-all flex flex-col items-center gap-2 group"
              >
                <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Utensils className="text-emerald-600" size={20} />
                </div>
                <span className="text-xs font-bold">记饮食</span>
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-white p-4 rounded-3xl border border-black/5 shadow-sm hover:border-blue-500/30 transition-all flex flex-col items-center gap-2 group"
              >
                <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Camera className="text-blue-600" size={20} />
                </div>
                <span className="text-xs font-bold">拍照识别</span>
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
              </button>
              <button 
                onClick={() => openCreateLogModal('exercise')}
                className="bg-white p-4 rounded-3xl border border-black/5 shadow-sm hover:border-orange-500/30 transition-all flex flex-col items-center gap-2 group"
              >
                <div className="w-10 h-10 bg-orange-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Activity className="text-orange-600" size={20} />
                </div>
                <span className="text-xs font-bold">记运动</span>
              </button>
            </div>

            <button
              onClick={() => setActiveTab('fasting')}
              className="group relative w-full overflow-hidden rounded-[32px] border border-emerald-200/60 bg-[linear-gradient(135deg,#f0fdf4_0%,#dcfce7_46%,#ecfccb_100%)] p-6 text-left shadow-[0_22px_50px_-28px_rgba(34,197,94,0.55)]"
            >
              <div className="absolute right-5 top-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 text-emerald-600 shadow-sm transition-transform group-hover:scale-110">
                <MoonStar size={22} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.26em] text-emerald-700/60">Fasting Mode</p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">轻断食面板已上线</h3>
              <p className="mt-2 max-w-md text-sm font-bold text-slate-600">
                环形进度、当前生理阶段、快捷方案切换都集中在一个页面，适合随手打开就看。
              </p>
              <div className="mt-5 flex items-center gap-4 text-sm font-black text-slate-800">
                <span className="rounded-full bg-white/80 px-3 py-1">
                  {fastingStatus?.active ? `进行中 ${fastingStatus.progressPercent.toFixed(0)}%` : '待开始'}
                </span>
                <span>{fastingStatus?.phase || '未开始'}</span>
              </div>
            </button>

            {/* Timeline */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="font-black text-lg">今日记录</h3>
                <button onClick={() => setActiveTab('logs')} className="text-xs font-bold text-black/30 hover:text-black uppercase tracking-widest">查看全部</button>
              </div>
              <div className="space-y-3">
                {logs.length === 0 ? (
                  <div className="bg-white/50 border border-dashed border-black/10 rounded-[32px] p-12 text-center">
                    <div className="w-12 h-12 bg-black/5 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Plus className="text-black/20" />
                    </div>
                    <p className="text-sm font-bold text-black/30">还没有记录，开始你的健身之旅吧！</p>
                  </div>
                ) : (
                  logs.slice(0, 5).map(log => (
                    <div key={log.id} className="bg-white p-5 rounded-[24px] border border-black/5 flex items-center justify-between group shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${log.type === 'food' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
                          {log.type === 'food' ? <Utensils size={20} /> : <Activity size={20} />}
                        </div>
                        <div>
                          <p className="font-black text-sm">{log.name}</p>
                          <p className="text-[10px] font-bold text-black/30 uppercase tracking-wider">
                            {log.amount} {log.type === 'food' ? '克' : '分钟'} ? {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className={`font-black text-sm ${log.type === 'food' ? 'text-emerald-600' : 'text-orange-600'}`}>
                            {log.type === 'food' ? '+' : '-'}{log.calories}
                          </p>
                          {log.type === 'food' && (
                            <p className="text-[9px] text-black/20 font-bold">P:{log.protein} C:{log.carbs} F:{log.fats}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 opacity-0 transition-all group-hover:opacity-100">
                          <button
                            onClick={() => handleEditLog(log)}
                            className="rounded-xl p-2 transition-all hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Pencil size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteLog(log.id)}
                            className="rounded-xl p-2 transition-all hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}

        {!isDisciplineRoute && activeTab === 'logs' && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-black">历史记录</h2>
            <div className="space-y-3">
              {logs.map(log => (
                <div key={log.id} className="bg-white p-5 rounded-[24px] border border-black/5 flex items-center justify-between group shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${log.type === 'food' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
                      {log.type === 'food' ? <Utensils size={20} /> : <Activity size={20} />}
                    </div>
                    <div>
                      <p className="font-black text-sm">{log.name}</p>
                      <p className="text-[10px] font-bold text-black/30 uppercase tracking-wider">
                        {log.amount} {log.type === 'food' ? '克' : '分钟'} ? {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className={`font-black text-sm ${log.type === 'food' ? 'text-emerald-600' : 'text-orange-600'}`}>
                        {log.type === 'food' ? '+' : '-'}{log.calories}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditLog(log)}
                        className="rounded-xl p-2 transition-all hover:bg-blue-50 hover:text-blue-600"
                      >
                        <Pencil size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteLog(log.id)}
                        className="rounded-xl p-2 transition-all hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {!isDisciplineRoute && activeTab === 'fasting' && (
          <FastingPage
            fastingStatus={fastingStatus}
            selectedPlan={selectedFastingPlan}
            isSubmitting={isSubmittingFasting}
            onSelectPlan={setSelectedFastingPlan}
            onStart={handleStartFasting}
            onEnd={handleEndFasting}
            onRefresh={fetchFastingStatus}
          />
        )}

        {!isDisciplineRoute && activeTab === 'bodyMetrics' && (
          <BodyMetricsPage
            metrics={bodyMetrics}
            isSaving={isSavingBodyMetric || isDeletingBodyMetric}
            onCreate={handleCreateBodyMetric}
            onDelete={handleDeleteBodyMetric}
          />
        )}

        {isDisciplineRoute && (
          <SelfDisciplinePage
            date={habitSummaryDate}
            habits={todayHabits}
            habitCatalog={habitCatalog}
            heatmap={habitHeatmap}
            habitHistory={habitHistory}
            isLoading={isSyncingHabits}
            onCheckIn={handleHabitCheckIn}
            onCreateHabit={handleCreateHabit}
            onUpdateHabit={handleUpdateHabit}
            onArchiveHabit={handleArchiveHabit}
            onLoadHabitHistory={handleLoadHabitHistory}
          />
        )}

        {!isDisciplineRoute && activeTab === 'profile' && profile && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <h2 className="text-2xl font-black">个人资料</h2>
            <form onSubmit={updateProfile} className="bg-white rounded-[40px] p-8 border border-black/5 shadow-xl shadow-black/5 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-black/30">姓名</label>
                  <input 
                    name="name" 
                    value={editProfile.name || ''} 
                    onChange={e => setEditProfile({...editProfile, name: e.target.value})}
                    className="w-full bg-[#F8F9FA] border-none rounded-2xl px-4 py-4 font-bold focus:ring-2 focus:ring-black transition-all" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-black/30">性别</label>
                  <select 
                    name="gender" 
                    value={editProfile.gender || ''} 
                    onChange={e => setEditProfile({...editProfile, gender: e.target.value})}
                    className="w-full bg-[#F8F9FA] border-none rounded-2xl px-4 py-4 font-bold focus:ring-2 focus:ring-black transition-all"
                  >
                    <option value="男">男</option>
                    <option value="女">女</option>
                    <option value="其他">其他</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-black/30">年龄</label>
                  <input 
                    name="age" 
                    type="number" 
                    value={editProfile.age || ''} 
                    onChange={e => setEditProfile({...editProfile, age: parseInt(e.target.value)})}
                    className="w-full bg-[#F8F9FA] border-none rounded-2xl px-4 py-4 font-bold focus:ring-2 focus:ring-black transition-all" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-black/30">身高 (cm)</label>
                  <input 
                    name="height" 
                    type="number" 
                    step="0.1" 
                    value={editProfile.height || ''} 
                    onChange={e => setEditProfile({...editProfile, height: parseFloat(e.target.value)})}
                    className="w-full bg-[#F8F9FA] border-none rounded-2xl px-4 py-4 font-bold focus:ring-2 focus:ring-black transition-all" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-black/30">体重 (kg)</label>
                  <input 
                    name="weight" 
                    type="number" 
                    step="0.1" 
                    value={editProfile.weight || ''} 
                    onChange={e => setEditProfile({...editProfile, weight: parseFloat(e.target.value)})}
                    className="w-full bg-[#F8F9FA] border-none rounded-2xl px-4 py-4 font-bold focus:ring-2 focus:ring-black transition-all" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-black/30">活动强度</label>
                  <select 
                    name="activity_level" 
                    value={editProfile.activity_level || 1.2} 
                    onChange={e => setEditProfile({...editProfile, activity_level: parseFloat(e.target.value)})}
                    className="w-full bg-[#F8F9FA] border-none rounded-2xl px-4 py-4 font-bold focus:ring-2 focus:ring-black transition-all"
                  >
                    <option value="1.2">久坐 (1.2)</option>
                    <option value="1.375">轻度运动 (1.375)</option>
                    <option value="1.55">中度运动 (1.55)</option>
                    <option value="1.725">重度运动 (1.725)</option>
                    <option value="1.9">极重度运动 (1.9)</option>
                  </select>
                </div>
                <div className="space-y-2 col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-black/30">每日热量目标 (kcal)</label>
                  <div className="flex gap-4 items-center">
                    <input 
                      name="goal_calories" 
                      type="number" 
                      value={editProfile.goal_calories || ''} 
                      onChange={e => setEditProfile({...editProfile, goal_calories: parseInt(e.target.value)})}
                      className="flex-1 bg-[#F8F9FA] border-none rounded-[10px] px-4 py-4 font-bold focus:ring-2 focus:ring-black transition-all" 
                    />
                    <button 
                      type="button"
                      onClick={() => setEditProfile({...editProfile, goal_calories: currentTdee})}
                      className="bg-emerald-50 px-4 py-4 rounded-[10px] border border-emerald-100 hover:bg-emerald-100 transition-all text-left"
                    >
                      <p className="text-[8px] font-bold text-emerald-600 uppercase">推荐 (TDEE)</p>
                      <p className="text-sm font-black text-emerald-700">{currentTdee} kcal</p>
                    </button>
                  </div>
                </div>

                <div className="space-y-2 col-span-2 pt-6 pb-2 border-b border-black/5">
                  <h3 className="text-lg font-black text-black/80 flex items-center gap-2">
                    <Brain size={20} className="text-purple-500" />
                    AI 双轨配置
                  </h3>
                  <p className="text-xs text-black/40 font-medium">将文本分析和视觉识别分开配置，避免一个模型同时承担两类任务。</p>
                </div>

                <div className="col-span-2 rounded-[24px] border border-black/5 bg-[#F8F9FA] p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-black/35">Text AI</p>
                  <h4 className="mt-2 text-lg font-black text-slate-900">文本模型配置</h4>
                  <p className="mt-1 text-xs font-bold text-black/40">用于食物搜索、营养推理、膳食平衡结构化输出和报告生成。</p>
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-black/30">服务商</label>
                      <select
                        name="text_ai_provider"
                        value={editProfile.text_ai_provider || 'silra'}
                        onChange={e => {
                          const provider = e.target.value;
                          let defaultModel = 'gemini-2.5-flash';
                          if (provider === 'zhipu') defaultModel = 'glm-4';
                          if (provider === 'tongyi') defaultModel = 'qwen-mt-plus';
                          if (provider === 'silra') defaultModel = 'deepseek-v3';
                          setEditProfile({...editProfile, text_ai_provider: provider, text_ai_model: defaultModel});
                        }}
                        className="w-full bg-white border-none rounded-[10px] px-4 py-4 font-bold focus:ring-2 focus:ring-purple-500 transition-all"
                      >
                        <option value="gemini">Google Gemini</option>
                        <option value="silra">Silra API</option>
                        <option value="zhipu">智谱 AI</option>
                        <option value="tongyi">通义千问</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-black/30">模型</label>
                      <select
                        name="text_ai_model"
                        value={editProfile.text_ai_model || ''}
                        onChange={e => setEditProfile({...editProfile, text_ai_model: e.target.value})}
                        className="w-full bg-white border-none rounded-[10px] px-4 py-4 font-bold focus:ring-2 focus:ring-purple-500 transition-all"
                      >
                        {availableTextModels.map(model => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="col-span-2 rounded-[24px] border border-black/5 bg-[#F8F9FA] p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-black/35">Vision AI</p>
                  <h4 className="mt-2 text-lg font-black text-slate-900">视觉模型配置</h4>
                  <p className="mt-1 text-xs font-bold text-black/40">用于拍照识别第一步“看图描述”。推荐视觉模型，不要用纯文本模型。</p>
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-black/30">服务商</label>
                      <select
                        name="vision_ai_provider"
                        value={editProfile.vision_ai_provider || 'tongyi'}
                        onChange={e => {
                          const provider = e.target.value;
                          let defaultModel = 'gemini-3.1-pro-preview';
                          if (provider === 'zhipu') defaultModel = 'glm-4.5v';
                          if (provider === 'tongyi') defaultModel = 'qwen-vl-plus';
                          if (provider === 'silra') defaultModel = 'gemini-3.1-pro-preview';
                          setEditProfile({...editProfile, vision_ai_provider: provider, vision_ai_model: defaultModel});
                        }}
                        className="w-full bg-white border-none rounded-[10px] px-4 py-4 font-bold focus:ring-2 focus:ring-purple-500 transition-all"
                      >
                        <option value="tongyi">通义千问</option>
                        <option value="zhipu">智谱 AI</option>
                        <option value="gemini">Google Gemini</option>
                        <option value="silra">Silra API</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-black/30">模型</label>
                      <select
                        name="vision_ai_model"
                        value={editProfile.vision_ai_model || ''}
                        onChange={e => setEditProfile({...editProfile, vision_ai_model: e.target.value})}
                        className="w-full bg-white border-none rounded-[10px] px-4 py-4 font-bold focus:ring-2 focus:ring-purple-500 transition-all"
                      >
                        {availableVisionModels.map(model => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2 col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-black/30">API Key (可选)</label>
                  <input 
                    name="api_key" 
                    type="password"
                    value={editProfile.api_key || ''} 
                    onChange={e => setEditProfile({...editProfile, api_key: e.target.value})}
                    placeholder="留空则使用系统默认 Key"
                    className="w-full bg-[#F8F9FA] border-none rounded-[10px] px-4 py-4 font-bold focus:ring-2 focus:ring-purple-500 transition-all" 
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-black/30">Base URL (可选)</label>
                  <input 
                    name="base_url" 
                    value={editProfile.base_url || ''} 
                    onChange={e => setEditProfile({...editProfile, base_url: e.target.value})}
                    placeholder="例如: https://api.openai.com/v1"
                    className="w-full bg-[#F8F9FA] border-none rounded-[10px] px-4 py-4 font-bold focus:ring-2 focus:ring-purple-500 transition-all" 
                  />
                </div>

                <div className="space-y-2 col-span-2 pt-4 border-t border-black/5">
                  <h3 className="text-sm font-black uppercase tracking-widest text-black/50">数据管理</h3>
                </div>
                <div className="col-span-2">
                  <a 
                    href="/api/backup" 
                    target="_blank"
                    className="block w-full bg-black/5 hover:bg-black/10 text-black font-bold py-4 rounded-2xl text-center transition-all"
                  >
                    下载项目备份 (ZIP)
                  </a>
                </div>

                <div className="space-y-2 col-span-2 pt-4 border-t border-black/5">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-black uppercase tracking-widest text-black/50">自定义单位库</h3>
                    <button type="button" onClick={() => setShowUnitModal(true)} className="text-xs font-bold bg-black text-white px-3 py-1 rounded-full flex items-center gap-1">
                      <Plus size={12} /> 添加
                    </button>
                  </div>
                  <div className="bg-[#F8F9FA] rounded-2xl p-4 space-y-2">
                    <p className="text-[10px] font-bold text-black/30">单位按食物绑定。请先在录入饮食时选择具体食物，再维护该食物的单位。</p>
                    {customUnits.length === 0 ? (
                      <p className="text-xs text-black/30 font-bold text-center">暂无自定义单位</p>
                    ) : (
                      customUnits.map(u => (
                        <div key={u.id} className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm">
                          <div>
                            <span className="font-bold text-sm">{u.name}</span>
                            <span className="text-xs text-black/30 ml-2">{u.weight_g}g / {u.calories_per_unit}kcal</span>
                          </div>
                          <button 
                            type="button"
                            onClick={async () => {
                              await fetch(`/api/units/${u.id}`, { method: 'DELETE' });
                              fetchUnits(selectedFoodId || undefined);
                            }}
                            className="text-red-500 p-1 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-6 rounded-[24px] border border-black/5 bg-[#F8F9FA] p-5 space-y-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('bodyMetrics')}
                  className="flex w-full items-center justify-between rounded-[22px] border border-black/5 bg-white px-4 py-4 text-left transition-all hover:shadow-md"
                >
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-black/50">身体档案</h3>
                    <p className="mt-1 text-xs font-bold text-black/40">进入围度时间轴，查看历史照片和最新体态数据</p>
                  </div>
                  <div className="rounded-full bg-black px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white">
                    打开
                  </div>
                </button>

                <div className="rounded-[22px] border border-black/5 bg-white px-4 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-black/35">最新围度</p>
                      <p className="mt-1 text-sm font-black text-slate-900">
                        {bodyMetrics[0]?.date || '暂无记录'}
                      </p>
                    </div>
                    <div className="text-right text-xs font-bold text-black/45">
                      <p>体重 {bodyMetrics[0]?.weight ?? '--'}kg</p>
                      <p>腰围 {bodyMetrics[0]?.waist ?? '--'}cm</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-black/50">API Health Check</h3>
                    <p className="text-xs text-black/40 font-bold">分别检查文本链路和视觉链路。服务商和模型会同时显示，便于排查配置偏差。</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleHealthCheck}
                    disabled={isCheckingHealth}
                    className="bg-black text-white px-4 py-2 rounded-full text-xs font-black disabled:opacity-50"
                  >
                    {isCheckingHealth ? '检测中...' : '测试连接'}
                  </button>
                </div>
                {healthStatus && (
                  <div className="space-y-2">
                    {[
                      {
                        key: 'text',
                        title: '文本链路',
                        item: healthStatus.text,
                      },
                      {
                        key: 'vision',
                        title: '视觉链路',
                        item: healthStatus.vision,
                      },
                    ].map(({ key, title, item }) => (
                      <div key={key} className="rounded-2xl border border-black/5 bg-white px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className={`h-3 w-3 rounded-full ${item.ok ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            <div>
                              <p className="text-sm font-black">{title}</p>
                              <p className="text-xs font-bold text-black/40">
                                {item.provider} · {item.model}
                              </p>
                            </div>
                          </div>
                          <div className={`text-xs font-black px-3 py-1 rounded-full ${item.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                            {item.ok ? `${item.latencyMs || 0}ms` : (item.errorType || 'error')}
                          </div>
                        </div>
                        <p className="mt-2 text-xs font-bold text-black/45">
                          {item.message || (item.ok ? 'healthy' : 'failed')}
                        </p>
                        {item.responseSnippet && (
                          <p className="mt-1 text-[11px] font-bold text-black/30">
                            响应片段: {item.responseSnippet}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button 
                type="submit" 
                disabled={!isProfileDirty || isSaving}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-black py-5 rounded-[10px] shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    保存中...
                  </>
                ) : '保存设置'}
              </button>
            </form>
          </motion.div>
        )}
      </main>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-28 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-2xl z-50 font-bold text-sm ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unit Modal */}
      <AnimatePresence>
        {showUnitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUnitModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-white rounded-[32px] p-6 shadow-2xl"
            >
              <h3 className="text-xl font-black mb-4">添加自定义单位</h3>
              <div className="space-y-4">
                <FoodSearchSelect
                  selectedFood={unitTargetFood}
                  onSelect={handleSelectUnitTargetFood}
                  placeholder="先搜索并选择食物"
                  helperText="单位必须绑定到具体 food_id，例如米饭的一碗和汤的一碗是两条独立记录。"
                />
                <input 
                  placeholder="单位名称 (如: 碗)" 
                  value={newUnit.name || ''}
                  onChange={e => setNewUnit({...newUnit, name: e.target.value})}
                  className="w-full bg-[#F8F9FA] border-none rounded-xl px-4 py-3 font-bold"
                />
                <input 
                  type="number"
                  placeholder="对应重量 (g)" 
                  value={newUnit.weight_g || ''}
                  onChange={e => setNewUnit({...newUnit, weight_g: parseFloat(e.target.value)})}
                  className="w-full bg-[#F8F9FA] border-none rounded-xl px-4 py-3 font-bold"
                />
                <input 
                  type="number"
                  placeholder="对应热量 (kcal)" 
                  value={newUnit.calories_per_unit || ''}
                  onChange={e => setNewUnit({...newUnit, calories_per_unit: parseFloat(e.target.value)})}
                  className="w-full bg-[#F8F9FA] border-none rounded-xl px-4 py-3 font-bold"
                />
                <button 
                  onClick={async () => {
                    if (!unitTargetFood?.id || !newUnit.name || !newUnit.weight_g) return;
                    await fetch('/api/units', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ ...newUnit, food_id: unitTargetFood.id })
                    });
                    fetchUnits(unitTargetFood.id);
                    setNewUnit({});
                    setShowUnitModal(false);
                  }}
                  className="w-full bg-black text-white font-black py-4 rounded-2xl hover:bg-black/80 transition-all disabled:opacity-50"
                  disabled={!unitTargetFood?.id}
                >
                  保存单位 {unitTargetFood?.id ? `(绑定 ${unitTargetFood.name})` : '(请先选择食物)'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-black/5 pb-10 pt-4 px-8 z-20">
        <div className="max-w-2xl mx-auto grid grid-cols-5 items-center">
          <button onClick={() => { window.location.hash = '#/'; setActiveTab('dashboard'); }} className={`flex flex-col items-center gap-1 transition-all ${!isDisciplineRoute && activeTab === 'dashboard' ? 'text-black scale-110' : 'text-black/20'}`}>
            <Activity size={24} strokeWidth={activeTab === 'dashboard' ? 3 : 2} />
            <span className="text-[9px] font-black uppercase tracking-tighter">首页</span>
          </button>
          <button onClick={() => { window.location.hash = '#/'; setActiveTab('logs'); }} className={`flex flex-col items-center gap-1 transition-all ${!isDisciplineRoute && activeTab === 'logs' ? 'text-black scale-110' : 'text-black/20'}`}>
            <Scale size={24} strokeWidth={activeTab === 'logs' ? 3 : 2} />
            <span className="text-[9px] font-black uppercase tracking-tighter">记录</span>
          </button>
          <button onClick={() => { window.location.hash = '#/'; setActiveTab('fasting'); }} className={`flex flex-col items-center gap-1 transition-all ${!isDisciplineRoute && activeTab === 'fasting' ? 'text-black scale-110' : 'text-black/20'}`}>
            <MoonStar size={24} strokeWidth={activeTab === 'fasting' ? 3 : 2} />
            <span className="text-[9px] font-black uppercase tracking-tighter">断食</span>
          </button>
          <button onClick={() => { window.location.hash = '#/discipline'; }} className={`flex flex-col items-center gap-1 transition-all ${isDisciplineRoute ? 'text-black scale-110' : 'text-black/20'}`}>
            <Target size={24} strokeWidth={isDisciplineRoute ? 3 : 2} />
            <span className="text-[9px] font-black uppercase tracking-tighter">自律</span>
          </button>
          <button onClick={() => { window.location.hash = '#/'; setActiveTab('profile'); }} className={`flex flex-col items-center gap-1 transition-all ${!isDisciplineRoute && activeTab === 'profile' ? 'text-black scale-110' : 'text-black/20'}`}>
            <User size={24} strokeWidth={activeTab === 'profile' ? 3 : 2} />
            <span className="text-[9px] font-black uppercase tracking-tighter">我的</span>
          </button>
        </div>
      </nav>

      {/* Add Modal */}
      <AnimatePresence>
        {isAdding && (
          <LogForm
            mode={editingLog ? 'edit' : 'create'}
            type={isAdding}
            profile={profile}
            itemName={itemName}
            itemAmount={itemAmount}
            exerciseType={exerciseType}
            selectedFood={selectedFood}
            selectedFoodId={selectedFoodId}
            selectedUnit={selectedUnit}
            selectedUnitName={selectedUnitName}
            customUnits={customUnits}
            estimatedCalories={estimatedCalories}
            estimatedMacros={estimatedMacros}
            estimatedWeight={estimatedWeight}
            previewCalories={previewCalories}
            previewMacros={previewMacros}
            previewMacroRatio={previewMacroRatio}
            previewWeight={previewWeight}
            confidenceHint={confidenceHint}
            analysisReport={analysisReport}
            healthScore={healthScore}
            alertLevel={alertLevel}
            isEstimating={isEstimating}
            isImageAnalyzing={isImageAnalyzing}
            onClose={closeAddModal}
            onOpenUnitModal={() => {
              setUnitTargetFood(selectedFood)
              setShowUnitModal(true)
            }}
            onItemNameChange={setItemName}
            onItemAmountChange={setItemAmount}
            onExerciseTypeChange={setExerciseType}
            onSelectedUnitChange={setSelectedUnit}
            onSelectedFoodChange={selectFoodForLog}
            onManualEstimateChange={setEstimatedCalories}
            onAddCustomFood={handleAddCustomFood}
            onSubmit={handleSubmitLogForm}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

