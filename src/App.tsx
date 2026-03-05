import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Utensils, 
  User, 
  Plus, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles,
  Scale,
  Target,
  Flame,
  Camera,
  Search,
  Info,
  ChevronDown,
  ChevronUp,
  Brain,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon
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
import { Profile, Log, Food, CustomUnit } from './types';
import { estimateCalories, analyzeFoodImage, generateDailyAdvice } from './services/geminiService';
import { LLMManager } from './services/llmManager';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'logs' | 'profile'>('dashboard');
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
  const [isEstimating, setIsEstimating] = useState(false);

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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Food[]>([]);
  const [showCustomFood, setShowCustomFood] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [customUnits, setCustomUnits] = useState<CustomUnit[]>([]);
  const [newUnit, setNewUnit] = useState<Partial<CustomUnit>>({});
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<string>('g'); // 'g' or unit id
  const [selectedFoodId, setSelectedFoodId] = useState<number | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  useEffect(() => {
    if (editProfile.ai_provider) {
      setAvailableModels(LLMManager.getAvailableModels(editProfile.ai_provider));
    }
  }, [editProfile.ai_provider]);

  useEffect(() => {
    fetchProfile();
    fetchLogs();
    // fetchUnits(); // Don't fetch all units globally anymore, fetch per food
  }, [selectedDate]);

  const fetchUnits = async (foodId?: number) => {
    const url = foodId ? `/api/units?food_id=${foodId}` : '/api/units';
    const res = await fetch(url);
    const data = await res.json();
    setCustomUnits(data);
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

  const handleSearchFood = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 1) {
      setSearchResults([]);
      return;
    }
    const res = await fetch(`/api/foods/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setSearchResults(data);
  };

  const closeAddModal = () => {
    setIsAdding(null);
    setItemName('');
    setItemAmount('');
    setEstimatedCalories(null);
    setSearchQuery('');
    setSearchResults([]);
    setShowCustomFood(false);
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
            protein: estimation.protein || 0,
            carbs: estimation.carbs || 0,
            fats: estimation.fats || 0
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

    setIsEstimating(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      const analysis = await analyzeFoodImage(profile, base64);
      if (analysis) {
        setItemName(analysis.name || '');
        setItemAmount(analysis.weight?.toString() || '');
        setEstimatedCalories(analysis.calories);
        setIsAdding('food');
      }
      setIsEstimating(false);
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
        {activeTab === 'dashboard' && (
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
                onClick={() => setIsAdding('food')}
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
                onClick={() => setIsAdding('exercise')}
                className="bg-white p-4 rounded-3xl border border-black/5 shadow-sm hover:border-orange-500/30 transition-all flex flex-col items-center gap-2 group"
              >
                <div className="w-10 h-10 bg-orange-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Activity className="text-orange-600" size={20} />
                </div>
                <span className="text-xs font-bold">记运动</span>
              </button>
            </div>

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
                            {log.amount} {log.type === 'food' ? '克' : '分钟'} • {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                        <button 
                          onClick={() => handleDeleteLog(log.id)}
                          className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'logs' && (
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
                        {log.amount} {log.type === 'food' ? '克' : '分钟'} • {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className={`font-black text-sm ${log.type === 'food' ? 'text-emerald-600' : 'text-orange-600'}`}>
                        {log.type === 'food' ? '+' : '-'}{log.calories}
                      </p>
                    </div>
                    <button 
                      onClick={() => handleDeleteLog(log.id)}
                      className="p-2 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'profile' && profile && (
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
                    AI 模型配置
                  </h3>
                  <p className="text-xs text-black/40 font-medium">配置您的 AI 助手，支持多模型切换。</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-black/30">AI 建议提供商</label>
                  <select 
                    name="ai_provider" 
                    value={editProfile.ai_provider || 'gemini'} 
                    onChange={e => {
                      const provider = e.target.value;
                      let defaultModel = 'gemini-3-flash-preview';
                      if (provider === 'zhipu') defaultModel = 'glm-4';
                      if (provider === 'tongyi') defaultModel = 'qwen-turbo';
                      setEditProfile({...editProfile, ai_provider: provider, ai_model: defaultModel});
                    }}
                    className="w-full bg-[#F8F9FA] border-none rounded-[10px] px-4 py-4 font-bold focus:ring-2 focus:ring-purple-500 transition-all"
                  >
                    <option value="gemini">Google Gemini (推荐)</option>
                    <option value="zhipu">智谱 AI (GLM-4)</option>
                    <option value="tongyi">通义千问 (Qwen)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-black/30">具体模型</label>
                  <select 
                    name="ai_model" 
                    value={editProfile.ai_model || ''} 
                    onChange={e => setEditProfile({...editProfile, ai_model: e.target.value})}
                    className="w-full bg-[#F8F9FA] border-none rounded-[10px] px-4 py-4 font-bold focus:ring-2 focus:ring-purple-500 transition-all"
                  >
                    {availableModels.map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
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
                              fetchUnits();
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
                    if (!newUnit.name || !newUnit.weight_g) return;
                    await fetch('/api/units', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ ...newUnit, food_id: selectedFoodId })
                    });
                    fetchUnits(selectedFoodId || undefined);
                    setNewUnit({});
                    setShowUnitModal(false);
                  }}
                  className="w-full bg-black text-white font-black py-4 rounded-2xl hover:bg-black/80 transition-all"
                >
                  保存单位 {selectedFoodId ? '(绑定当前食物)' : '(通用)'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-black/5 pb-10 pt-4 px-8 z-20">
        <div className="max-w-2xl mx-auto flex items-center justify-around">
          <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'dashboard' ? 'text-black scale-110' : 'text-black/20'}`}>
            <Activity size={24} strokeWidth={activeTab === 'dashboard' ? 3 : 2} />
            <span className="text-[9px] font-black uppercase tracking-tighter">首页</span>
          </button>
          <button onClick={() => setActiveTab('logs')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'logs' ? 'text-black scale-110' : 'text-black/20'}`}>
            <Scale size={24} strokeWidth={activeTab === 'logs' ? 3 : 2} />
            <span className="text-[9px] font-black uppercase tracking-tighter">记录</span>
          </button>
          <button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'profile' ? 'text-black scale-110' : 'text-black/20'}`}>
            <User size={24} strokeWidth={activeTab === 'profile' ? 3 : 2} />
            <span className="text-[9px] font-black uppercase tracking-tighter">我的</span>
          </button>
        </div>
      </nav>

      {/* Add Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeAddModal}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-md bg-white rounded-t-[48px] sm:rounded-[48px] p-8 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black flex items-center gap-2">
                  {isAdding === 'food' ? <Utensils className="text-emerald-600" /> : <Activity className="text-orange-600" />}
                  添加{isAdding === 'food' ? '饮食' : '运动'}
                </h3>
                <button onClick={closeAddModal} className="p-2 bg-black/5 rounded-full text-black/40 hover:text-black transition-all">
                  <ChevronDown size={20} />
                </button>
              </div>

              {isAdding === 'food' && (
                <div className="mb-6 space-y-4">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-black/20" size={18} />
                    <input 
                      value={searchQuery}
                      onChange={(e) => handleSearchFood(e.target.value)}
                      placeholder="搜索食物数据库..."
                      className="w-full bg-[#F8F9FA] border-none rounded-2xl px-12 py-4 font-bold focus:ring-2 focus:ring-black transition-all"
                    />
                  </div>
                  
                  {searchResults.length > 0 && (
                    <div className="bg-[#F8F9FA] rounded-2xl p-2 space-y-1">
                      {searchResults.map(food => (
                        <button 
                          key={food.id}
                          onClick={() => {
                            setItemName(food.name);
                            setSelectedFoodId(food.id);
                            fetchUnits(food.id);
                            setItemAmount('100');
                            setSearchResults([]);
                            setSearchQuery('');
                          }}
                          className="w-full text-left p-3 hover:bg-white rounded-xl transition-all flex justify-between items-center group"
                        >
                          <span className="font-bold">{food.name}</span>
                          <span className="text-xs text-black/30 group-hover:text-black">{food.calories} kcal/100g</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <button 
                    onClick={() => setShowCustomFood(!showCustomFood)}
                    className="text-xs font-bold text-black/40 hover:text-black flex items-center gap-1"
                  >
                    {showCustomFood ? '收起自定义' : '没有找到？手动添加自定义食物'}
                    {showCustomFood ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>

                  {showCustomFood && (
                    <div className="bg-[#F8F9FA] rounded-3xl p-6 space-y-4 border border-black/5">
                      <input id="custom-name" placeholder="食物名称" className="w-full bg-white rounded-xl px-4 py-3 text-sm font-bold" />
                      <div className="grid grid-cols-2 gap-3">
                        <input id="custom-cal" type="number" placeholder="热量 (kcal)" className="w-full bg-white rounded-xl px-4 py-3 text-sm font-bold" />
                        <input id="custom-pro" type="number" placeholder="蛋白质 (g)" className="w-full bg-white rounded-xl px-4 py-3 text-sm font-bold" />
                        <input id="custom-carb" type="number" placeholder="碳水 (g)" className="w-full bg-white rounded-xl px-4 py-3 text-sm font-bold" />
                        <input id="custom-fat" type="number" placeholder="脂肪 (g)" className="w-full bg-white rounded-xl px-4 py-3 text-sm font-bold" />
                      </div>
                      <button 
                        onClick={async () => {
                          const name = (document.getElementById('custom-name') as HTMLInputElement).value;
                          const cal = parseFloat((document.getElementById('custom-cal') as HTMLInputElement).value);
                          const pro = parseFloat((document.getElementById('custom-pro') as HTMLInputElement).value);
                          const carb = parseFloat((document.getElementById('custom-carb') as HTMLInputElement).value);
                          const fat = parseFloat((document.getElementById('custom-fat') as HTMLInputElement).value);
                          
                          if (!name || isNaN(cal)) return;

                          await fetch('/api/foods', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name, calories: cal, protein: pro, carbs: carb, fats: fat })
                          });
                          
                          handleAddLog('food', { name, amount: 100, calories: cal, protein: pro, carbs: carb, fats: fat });
                        }}
                        className="w-full bg-black text-white py-3 rounded-xl text-sm font-bold"
                      >
                        保存并记录
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-6">
                {isAdding === 'exercise' ? (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-black/30">运动类型</label>
                    <select 
                      value={exerciseType}
                      onChange={(e) => setExerciseType(e.target.value)}
                      className="w-full bg-[#F8F9FA] border-none rounded-2xl px-4 py-4 font-bold focus:ring-2 focus:ring-black transition-all appearance-none"
                    >
                      <option value="跑步">跑步 (Running)</option>
                      <option value="慢跑">慢跑 (Jogging)</option>
                      <option value="游泳">游泳 (Swimming)</option>
                      <option value="骑行">骑行 (Cycling)</option>
                      <option value="瑜伽">瑜伽 (Yoga)</option>
                      <option value="力量训练">力量训练 (Strength)</option>
                      <option value="台球">台球 (Billiards)</option>
                      <option value="爬坡">爬坡 (Inclined Walking)</option>
                      <option value="爬楼梯">爬楼梯 (Stair Climbing)</option>
                      <option value="篮球">篮球</option>
                      <option value="足球">足球</option>
                      <option value="羽毛球">羽毛球</option>
                      <option value="跳绳">跳绳</option>
                    </select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-black/30">名称</label>
                    <div className="relative">
                      <input 
                        value={itemName}
                        onChange={(e) => setItemName(e.target.value)}
                        placeholder="例如：牛油果吐司"
                        className="w-full bg-[#F8F9FA] border-none rounded-2xl px-4 py-4 pr-12 font-bold focus:ring-2 focus:ring-black transition-all"
                      />
                      <Sparkles className="absolute right-4 top-1/2 -translate-y-1/2 text-black/10" size={20} />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-black/30">
                    {isAdding === 'food' ? '数量' : '时长 (分钟)'}
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="number"
                      value={itemAmount}
                      onChange={(e) => setItemAmount(e.target.value)}
                      placeholder={isAdding === 'food' ? "150" : "30"}
                      className="flex-1 bg-[#F8F9FA] border-none rounded-2xl px-4 py-4 font-bold focus:ring-2 focus:ring-black transition-all"
                    />
                    {isAdding === 'food' && (
                      <select
                        value={selectedUnit}
                        onChange={(e) => setSelectedUnit(e.target.value)}
                        className="w-24 bg-[#F8F9FA] border-none rounded-2xl px-2 py-4 font-bold focus:ring-2 focus:ring-black transition-all text-sm"
                      >
                        <option value="g">克 (g)</option>
                        {customUnits.map(u => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {estimatedCalories !== null && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-black/30">热量 (kcal) - AI 预估</label>
                    <input 
                      type="number"
                      value={estimatedCalories}
                      onChange={(e) => setEstimatedCalories(parseInt(e.target.value))}
                      className="w-full bg-emerald-50 border-emerald-100 border rounded-2xl px-4 py-4 font-bold focus:ring-2 focus:ring-emerald-500 transition-all text-emerald-700"
                    />
                    <p className="text-[9px] text-emerald-600/50 font-bold">您可以手动修正 AI 预估的数值</p>
                  </div>
                )}

                <button 
                  disabled={isEstimating || (isAdding === 'food' && !itemName) || !itemAmount}
                  onClick={async () => {
                    if (estimatedCalories !== null) {
                      let finalAmount = parseFloat(itemAmount);
                      let finalCalories = estimatedCalories;
                      
                      await handleAddLog(isAdding, {
                        name: isAdding === 'food' ? itemName + (selectedUnit !== 'g' ? ` (${customUnits.find(u => u.id.toString() === selectedUnit)?.name})` : '') : exerciseType,
                        amount: finalAmount,
                        calories: finalCalories,
                        protein: 0, carbs: 0, fats: 0 
                      });
                      setEstimatedCalories(null);
                    } else {
                      const name = isAdding === 'food' ? itemName : exerciseType;
                      
                      if (isAdding === 'exercise' && profile) {
                         const calories = calculateExerciseCalories(exerciseType, parseFloat(itemAmount), profile.weight);
                         setEstimatedCalories(calories);
                         return;
                      }

                      setIsEstimating(true);
                      const est = await estimateCalories(profile, name, isAdding, parseFloat(itemAmount));
                      if (est) {
                        setEstimatedCalories(est.calories);
                      }
                      setIsEstimating(false);
                    }
                  }}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black py-5 rounded-[10px] flex items-center justify-center gap-3 disabled:opacity-50 hover:shadow-lg hover:shadow-emerald-500/20 transition-all shadow-md"
                >
                  {isEstimating ? (
                    <>
                      <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                      AI 估算中...
                    </>
                  ) : (
                    <>
                      <Sparkles size={20} />
                      {estimatedCalories !== null ? '确认并记录' : 'AI 智能估算'}
                    </>
                  )}
                </button>
                <p className="text-[9px] text-center text-black/20 font-bold uppercase tracking-[0.2em]">
                  由 Gemini AI 提供智能营养分析支持
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
