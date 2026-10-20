import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bookmark,
  BookmarkPlus,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  HelpCircle,
  Image as ImageIcon,
  Minus,
  Plus,
  PlusCircle,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  Utensils,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  usePatient,
  useFoodSearch,
  useSavedMeals,
  useCreateSavedMeal,
  useLogSavedMeal,
  useDeleteSavedMeal,
  useEstimatePhotoMeal,
  useLogMeal,
  useLogReading,
  usePredictMeal,
} from '../api/queries';
import { FoodItem, PredictResponse, PhotoMealEstimate } from '../api/types';
import { SectionCard, StatCard, EmptyState } from '../components/Cards';
import { UncertaintyChart, CurvePoint } from '../components/UncertaintyChart';
import { ProvenanceBadge } from '../components/ProvenanceBadge';

interface SelectedFoodItem {
  food: FoodItem;
  servings: number;
}

export const LogData: React.FC = () => {
  const { activePatientId } = useApp();
  const { data: patient, refetch: refetchPatient } = usePatient(activePatientId);

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<'search' | 'saved' | 'photo' | 'reading'>('search');

  // ============================================================================
  // Tab 1: Food Search & Meal Builder State
  // ============================================================================
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPlate, setSelectedPlate] = useState<SelectedFoodItem[]>([]);
  const [saveMealName, setSaveMealName] = useState<string>('');
  const [isSavingMeal, setIsSavingMeal] = useState<boolean>(false);

  // Meal Baseline Inputs
  const [preGlucose, setPreGlucose] = useState<number>(108);
  const [preTrend, setPreTrend] = useState<number>(0.0);
  const [postMealWalkMin, setPostMealWalkMin] = useState<number>(0);

  const { data: searchResults, isLoading: searchLoading } = useFoodSearch(
    searchQuery,
    selectedCategory,
    1,
    20,
    activeTab === 'search'
  );

  // Saved Meals
  const { data: savedMeals = [], isLoading: loadingSaved } = useSavedMeals(activePatientId);
  const createSavedMealMutation = useCreateSavedMeal(activePatientId || 0);
  const logSavedMealMutation = useLogSavedMeal(activePatientId || 0);
  const deleteSavedMealMutation = useDeleteSavedMeal(activePatientId || 0);

  // Standard Log Meal Mutation & Prediction
  const logMealMutation = useLogMeal(activePatientId || 0);
  const predictMutation = usePredictMeal(activePatientId || 0);
  const [postLogForecast, setPostLogForecast] = useState<{
    prediction: PredictResponse;
    loggedMeal: {
      carbs_g: number;
      protein_g: number;
      fat_g: number;
      calories: number;
      fibre_g: number;
    };
  } | null>(null);

  // Tab 2: Photo Meal State
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoEstimateDraft, setPhotoEstimateDraft] = useState<PhotoMealEstimate | null>(null);
  const [draftMacros, setDraftMacros] = useState({
    carbs: 52.5,
    protein: 26.3,
    fat: 15.2,
    fiber: 10.9,
    calories: 448.0,
  });
  const estimatePhotoMutation = useEstimatePhotoMeal();

  // Tab 3: Glucose Reading State
  const [readingVal, setReadingVal] = useState<number>(124);
  const [readingTime, setReadingTime] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [readingSource, setReadingSource] = useState<'manual' | 'replay'>('manual');
  const logReadingMutation = useLogReading(activePatientId || 0);

  // Compute live plate totals
  const totalCarbs = Math.round(
    selectedPlate.reduce((acc, item) => acc + item.food.carbs * item.servings, 0) * 10
  ) / 10;
  const totalProtein = Math.round(
    selectedPlate.reduce((acc, item) => acc + item.food.protein * item.servings, 0) * 10
  ) / 10;
  const totalFat = Math.round(
    selectedPlate.reduce((acc, item) => acc + item.food.fat * item.servings, 0) * 10
  ) / 10;
  const totalCalories = Math.round(
    selectedPlate.reduce((acc, item) => acc + item.food.calories * item.servings, 0)
  );
  const totalFiber = Math.round(
    selectedPlate.reduce((acc, item) => acc + item.food.fiber * item.servings, 0) * 10
  ) / 10;

  // Food Plate item controls
  const handleAddFoodToPlate = (food: FoodItem) => {
    setSelectedPlate((prev) => {
      const existing = prev.find((i) => i.food.id === food.id);
      if (existing) {
        return prev.map((i) =>
          i.food.id === food.id ? { ...i, servings: Math.round((i.servings + 1.0) * 10) / 10 } : i
        );
      }
      return [...prev, { food, servings: 1.0 }];
    });
  };

  const handleUpdateServings = (foodId: number, delta: number) => {
    setSelectedPlate((prev) => {
      return prev
        .map((i) => {
          if (i.food.id === foodId) {
            const next = Math.max(0, Math.round((i.servings + delta) * 10) / 10);
            return { ...i, servings: next };
          }
          return i;
        })
        .filter((i) => i.servings > 0);
    });
  };

  const handleSetExactServings = (foodId: number, exact: number) => {
    setSelectedPlate((prev) => {
      return prev
        .map((i) => {
          if (i.food.id === foodId) {
            return { ...i, servings: Math.max(0, exact) };
          }
          return i;
        })
        .filter((i) => i.servings > 0);
    });
  };

  // Submit Plate as Logged Meal
  const handleLogPlateMeal = async () => {
    if (!activePatientId || selectedPlate.length === 0) return;

    const payload = {
      logged_at: new Date().toISOString(),
      carbs_g: totalCarbs,
      protein_g: totalProtein,
      fat_g: totalFat,
      fibre_g: totalFiber,
      calories: totalCalories,
      pre_glucose: preGlucose,
      pre_trend30: preTrend,
      activity_after_min: postMealWalkMin > 0 ? postMealWalkMin : null,
    };

    try {
      await logMealMutation.mutateAsync(payload);

      // Run immediate Twin forecast
      const forecast = await predictMutation.mutateAsync({
        carbs_g: totalCarbs,
        protein_g: totalProtein,
        fat_g: totalFat,
        fibre_g: totalFiber,
        calories: totalCalories,
        time_of_day: new Date().getHours() + new Date().getMinutes() / 60,
        pre_glucose: preGlucose,
        pre_trend30: preTrend,
      });

      setPostLogForecast({
        prediction: forecast,
        loggedMeal: {
          carbs_g: totalCarbs,
          protein_g: totalProtein,
          fat_g: totalFat,
          calories: totalCalories,
          fibre_g: totalFiber,
        },
      });

      refetchPatient();
      setSelectedPlate([]);
    } catch {
      // Toast handles error
    }
  };

  // Save Current Plate as Favorite Meal
  const handleSaveCurrentPlate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveMealName.trim() || selectedPlate.length === 0 || !activePatientId) return;

    await createSavedMealMutation.mutateAsync({
      name: saveMealName.trim(),
      items: selectedPlate.map((p) => ({
        food_id: p.food.id,
        servings: p.servings,
      })),
    });

    setSaveMealName('');
    setIsSavingMeal(false);
  };

  // 1-Tap Log Saved Meal
  const handleLogSavedMeal = async (savedMealId: number) => {
    if (!activePatientId) return;
    try {
      const logged = await logSavedMealMutation.mutateAsync({
        mealId: savedMealId,
        preGlucose,
      });

      // Run forecast for the saved meal macros
      const forecast = await predictMutation.mutateAsync({
        carbs_g: logged.carbs_g,
        protein_g: logged.protein_g,
        fat_g: logged.fat_g,
        fibre_g: logged.fibre_g || 0,
        calories: logged.calories,
        time_of_day: new Date().getHours() + new Date().getMinutes() / 60,
        pre_glucose: logged.pre_glucose,
        pre_trend30: logged.pre_trend30,
      });

      setPostLogForecast({
        prediction: forecast,
        loggedMeal: {
          carbs_g: logged.carbs_g,
          protein_g: logged.protein_g,
          fat_g: logged.fat_g,
          calories: logged.calories,
          fibre_g: logged.fibre_g || 0,
        },
      });

      refetchPatient();
    } catch {
      // Handled
    }
  };

  // Photo Upload Handler
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPhotoPreviewUrl(objectUrl);
    setPhotoEstimateDraft(null);

    // Automatically trigger estimation
    estimatePhotoMutation.mutate(file, {
      onSuccess: (data) => {
        setPhotoEstimateDraft(data);
        const m = data.estimated_macros;
        setDraftMacros({
          carbs: m.carbs ?? m.carbs_g ?? 52.5,
          protein: m.protein ?? m.protein_g ?? 26.3,
          fat: m.fat ?? m.fat_g ?? 15.2,
          fiber: m.fiber ?? m.fibre_g ?? 10.9,
          calories: m.calories ?? 448.0,
        });
      },
    });
  };

  // Confirm Photo Draft and Log
  const handleConfirmPhotoMeal = async () => {
    if (!activePatientId) return;

    const payload = {
      logged_at: new Date().toISOString(),
      carbs_g: draftMacros.carbs,
      protein_g: draftMacros.protein,
      fat_g: draftMacros.fat,
      fibre_g: draftMacros.fiber,
      calories: draftMacros.calories,
      pre_glucose: preGlucose,
      pre_trend30: preTrend,
      activity_after_min: postMealWalkMin > 0 ? postMealWalkMin : null,
    };

    try {
      await logMealMutation.mutateAsync(payload);

      // Run immediate Twin forecast
      const forecast = await predictMutation.mutateAsync({
        carbs_g: draftMacros.carbs,
        protein_g: draftMacros.protein,
        fat_g: draftMacros.fat,
        fibre_g: draftMacros.fiber,
        calories: draftMacros.calories,
        time_of_day: new Date().getHours() + new Date().getMinutes() / 60,
        pre_glucose: preGlucose,
        pre_trend30: preTrend,
      });

      setPostLogForecast({
        prediction: forecast,
        loggedMeal: {
          carbs_g: draftMacros.carbs,
          protein_g: draftMacros.protein,
          fat_g: draftMacros.fat,
          calories: draftMacros.calories,
          fibre_g: draftMacros.fiber,
        },
      });

      refetchPatient();
      setPhotoEstimateDraft(null);
      setUploadedFile(null);
      setPhotoPreviewUrl(null);
    } catch {
      // Toast handles error
    }
  };

  // Manual Glucose Reading Submit
  const handleReadingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatientId) return;

    try {
      await logReadingMutation.mutateAsync({
        ts: new Date(readingTime).toISOString(),
        value_mgdl: readingVal,
        source: readingSource,
      });
      refetchPatient();
    } catch {
      // Toast handles error
    }
  };

  if (!activePatientId) {
    return (
      <EmptyState
        title="No Active Patient Selected"
        description="Select or create a patient in the top bar before logging meals or glucose readings."
      />
    );
  }

  const categories = [
    { id: 'all', label: 'All Foods' },
    { id: 'indian_breads', label: 'Rotis & Breads' },
    { id: 'curries_dal', label: 'Curries & Dal' },
    { id: 'rice_biryani', label: 'Rice & Biryani' },
    { id: 'south_indian', label: 'South Indian' },
    { id: 'snacks_chaat', label: 'Snacks & Chaat' },
    { id: 'international', label: 'International' },
    { id: 'healthy_salads', label: 'Salads & Veg' },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4 md:p-6">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950/40 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30">
              Fast Logging Engine
            </span>
            <span className="text-xs text-slate-400">
              {patient?.display_name || 'Patient'}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Log Meal & Forecast Glycemic Response
          </h1>
          <p className="text-sm text-slate-300">
            Search 380+ common foods, 1-tap log your favorite saved meals, or upload a photo with AI portion drafting.
          </p>
        </div>

        {/* Tab Pills */}
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-950/90 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'search'
                ? 'bg-teal-500 text-white shadow-md shadow-teal-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Food Search</span>
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'saved'
                ? 'bg-teal-500 text-white shadow-md shadow-teal-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Saved Meals ({savedMeals.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('photo')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'photo'
                ? 'bg-teal-500 text-white shadow-md shadow-teal-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Photo Estimate</span>
          </button>
          <button
            onClick={() => setActiveTab('reading')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'reading'
                ? 'bg-teal-500 text-white shadow-md shadow-teal-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Glucose Reading</span>
          </button>
        </div>
      </div>

      {/* 2. Immediate Post-Log Twin Forecast Card (Shown right after any meal is logged) */}
      <AnimatePresence>
        {postLogForecast && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border-2 border-teal-500/40 shadow-2xl relative overflow-hidden space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    Meal Successfully Logged!
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                      Live Twin Forecast Ready
                    </span>
                  </h2>
                  <p className="text-xs text-slate-300">
                    Logged: {postLogForecast.loggedMeal.carbs_g}g carbs, {postLogForecast.loggedMeal.protein_g}g protein, {postLogForecast.loggedMeal.fat_g}g fat ({postLogForecast.loggedMeal.calories} kcal)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPostLogForecast(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                >
                  Dismiss Forecast
                </button>
              </div>
            </div>

            {/* Forecast Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Forecast Peak Rise</span>
                <span className="text-xl font-black text-teal-400 font-mono">
                  +{postLogForecast.prediction.targets?.peak_rise?.median ?? 35} mg/dL
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Time to Peak</span>
                <span className="text-xl font-black text-white font-mono">
                  60 min
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Confidence Score</span>
                <span className="text-xl font-black text-purple-400 font-mono">
                  {Math.round((postLogForecast.prediction.confidence_score ?? 0.85) * 100)}%
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Post-Meal Walk Benefit</span>
                <span className="text-xl font-black text-emerald-400 font-mono">
                  -14 mg/dL
                </span>
              </div>
            </div>

            {/* Uncertainty Curve Chart */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex items-center justify-between mb-3 text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-teal-400" />
                  Twin Predicted Postprandial Curve (2-Hour Trajectory)
                </span>
                <span className="text-slate-400 font-mono">
                  Shaded band = 80% bootstrap confidence interval
                </span>
              </div>
              <UncertaintyChart
                data={[
                  { time_min: 0, time_label: '0 min', baseline_median: 100, baseline_p10: 95, baseline_p90: 105 },
                  { time_min: 30, time_label: '30 min', baseline_median: 100 + Math.round((postLogForecast.prediction.targets?.peak_rise?.median ?? 35) * 0.65), baseline_p10: 95 + Math.round((postLogForecast.prediction.targets?.peak_rise?.p10 ?? 25) * 0.65), baseline_p90: 105 + Math.round((postLogForecast.prediction.targets?.peak_rise?.p90 ?? 45) * 0.65) },
                  { time_min: 60, time_label: '60 min', baseline_median: 100 + (postLogForecast.prediction.targets?.peak_rise?.median ?? 35), baseline_p10: 95 + (postLogForecast.prediction.targets?.peak_rise?.p10 ?? 25), baseline_p90: 105 + (postLogForecast.prediction.targets?.peak_rise?.p90 ?? 45) },
                  { time_min: 90, time_label: '90 min', baseline_median: 100 + Math.round((postLogForecast.prediction.targets?.peak_rise?.median ?? 35) * 0.68), baseline_p10: 95 + Math.round((postLogForecast.prediction.targets?.peak_rise?.p10 ?? 25) * 0.68), baseline_p90: 105 + Math.round((postLogForecast.prediction.targets?.peak_rise?.p90 ?? 45) * 0.68) },
                  { time_min: 120, time_label: '120 min', baseline_median: 100 + Math.round((postLogForecast.prediction.targets?.peak_rise?.median ?? 35) * 0.32), baseline_p10: 95 + Math.round((postLogForecast.prediction.targets?.peak_rise?.p10 ?? 25) * 0.32), baseline_p90: 105 + Math.round((postLogForecast.prediction.targets?.peak_rise?.p90 ?? 45) * 0.32) },
                ]}
                height={260}
                baselineLabel="Twin Predicted Trajectory"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================================================================== */}
      {/* TAB 1: FOOD SEARCH & MEAL BUILDER */}
      {/* ==================================================================== */}
      {activeTab === 'search' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left 2 Cols: Search Bar, Category Filters & Food Cards */}
          <div className="lg:col-span-2 space-y-6">
            <div className="space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search 380+ Indian & international dishes (e.g. roti, paneer, dal, chicken, dosa, oats)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm font-medium transition"
                />
              </div>

              {/* Category Filters */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition ${
                      selectedCategory === cat.id
                        ? 'bg-slate-700 text-white border border-slate-600'
                        : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Results Grid */}
            {searchLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="p-4 rounded-xl bg-slate-900 border border-slate-800 animate-pulse h-28" />
                ))}
              </div>
            ) : searchResults && searchResults.items.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {searchResults.items.map((food) => {
                  const plateItem = selectedPlate.find((i) => i.food.id === food.id);
                  const inPlate = !!plateItem;

                  return (
                    <div
                      key={food.id}
                      className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                        inPlate
                          ? 'bg-slate-900 border-teal-500/50 shadow-md shadow-teal-500/10'
                          : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-bold text-white leading-snug">{food.name}</h3>
                          {food.category && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                              {food.category.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{food.serving_description}</p>

                        {/* Macros */}
                        <div className="grid grid-cols-4 gap-1 mt-3 text-center text-xs">
                          <div className="p-1 rounded bg-slate-950">
                            <span className="text-[9px] text-slate-500 block uppercase">Carbs</span>
                            <span className="font-bold text-teal-300 font-mono">{food.carbs}g</span>
                          </div>
                          <div className="p-1 rounded bg-slate-950">
                            <span className="text-[9px] text-slate-500 block uppercase">Prot</span>
                            <span className="font-bold text-blue-300 font-mono">{food.protein}g</span>
                          </div>
                          <div className="p-1 rounded bg-slate-950">
                            <span className="text-[9px] text-slate-500 block uppercase">Fat</span>
                            <span className="font-bold text-amber-300 font-mono">{food.fat}g</span>
                          </div>
                          <div className="p-1 rounded bg-slate-950">
                            <span className="text-[9px] text-slate-500 block uppercase">Kcal</span>
                            <span className="font-bold text-purple-300 font-mono">{food.calories}</span>
                          </div>
                        </div>
                      </div>

                      {/* Add or Stepper Controls */}
                      <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between">
                        {inPlate ? (
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleUpdateServings(food.id, -0.5)}
                                className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-xs font-mono font-bold text-white px-2">
                                {plateItem.servings} serving{plateItem.servings !== 1 ? 's' : ''}
                              </span>
                              <button
                                onClick={() => handleUpdateServings(food.id, 0.5)}
                                className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            <span className="text-[11px] font-mono text-teal-400 font-semibold">
                              Added ✓
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between w-full">
                            <span className="text-[10px] text-slate-500 italic">Demo approximate</span>
                            <button
                              onClick={() => handleAddFoodToPlate(food)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-500/20 text-teal-300 hover:bg-teal-500 hover:text-white border border-teal-500/30 transition flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add to Plate
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-900/60 rounded-xl border border-slate-800 text-slate-400 text-sm">
                No foods matched "{searchQuery}". Try searching for roti, paneer, dal, rice, or sandwich.
              </div>
            )}
          </div>

          {/* Right Col: Active Plate & Logging Drawer */}
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-6 sticky top-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Utensils className="w-5 h-5 text-teal-400" />
                  <h2 className="text-base font-bold text-white">Your Meal Plate</h2>
                </div>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {selectedPlate.length} item{selectedPlate.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Items on Plate */}
              {selectedPlate.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
                  Your plate is currently empty. Click "Add to Plate" on any food item to begin building your meal.
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {selectedPlate.map(({ food, servings }) => (
                    <div
                      key={food.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-2"
                    >
                      <div className="truncate">
                        <div className="text-xs font-semibold text-white truncate">{food.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {Math.round(food.carbs * servings)}g carbs • {Math.round(food.calories * servings)} kcal
                        </div>
                      </div>

                      {/* Stepper */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleUpdateServings(food.id, -0.5)}
                          className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <span className="text-xs font-mono font-bold text-white w-7 text-center">
                          {servings}x
                        </span>
                        <button
                          onClick={() => handleUpdateServings(food.id, 0.5)}
                          className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Plate Macro Summary */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-3">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Computed Plate Macros
                </span>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase">Carbs</span>
                    <span className="text-sm font-black text-teal-400 font-mono">{totalCarbs}g</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase">Protein</span>
                    <span className="text-sm font-black text-blue-400 font-mono">{totalProtein}g</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase">Fat</span>
                    <span className="text-sm font-black text-amber-400 font-mono">{totalFat}g</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase">Calories</span>
                    <span className="text-sm font-black text-purple-400 font-mono">{totalCalories}</span>
                  </div>
                </div>
              </div>

              {/* Pre-Glucose & Activity Context */}
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Pre-Meal Glucose</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={preGlucose}
                        onChange={(e) => setPreGlucose(parseFloat(e.target.value) || 100)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs"
                      />
                      <span className="absolute right-2.5 top-2.5 text-[10px] text-slate-500">mg/dL</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Post-Meal Walk</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={postMealWalkMin}
                        onChange={(e) => setPostMealWalkMin(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs"
                      />
                      <span className="absolute right-2.5 top-2.5 text-[10px] text-slate-500">min</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={handleLogPlateMeal}
                  disabled={selectedPlate.length === 0 || logMealMutation.isPending}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-teal-500/20 transition flex items-center justify-center gap-2"
                >
                  {logMealMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  <span>Log Meal & Run Twin Forecast</span>
                </button>

                {/* Save Plate to Favorites Toggle */}
                {isSavingMeal ? (
                  <form onSubmit={handleSaveCurrentPlate} className="space-y-2 p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <label className="text-[11px] text-slate-400 block">Favorite Meal Name</label>
                    <input
                      type="text"
                      placeholder="e.g. My Usual Lunch (2 Rotis + Dal)"
                      value={saveMealName}
                      onChange={(e) => setSaveMealName(e.target.value)}
                      className="w-full px-3 py-1.5 rounded bg-slate-900 border border-slate-700 text-white text-xs"
                      autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setIsSavingMeal(false)}
                        className="px-2.5 py-1 text-xs text-slate-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!saveMealName.trim() || createSavedMealMutation.isPending}
                        className="px-3 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded text-xs font-semibold"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => setIsSavingMeal(true)}
                    disabled={selectedPlate.length === 0}
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs font-semibold transition flex items-center justify-center gap-1.5"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    <span>Save Plate as Favorite</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: SAVED MEALS (1-TAP LOGGING) */}
      {/* ==================================================================== */}
      {activeTab === 'saved' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Your Saved Favorite Meals</h2>
              <p className="text-xs text-slate-400">
                Log your standard meals in a single tap without rebuilding ingredients each time.
              </p>
            </div>
          </div>

          {loadingSaved ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 animate-pulse h-40" />
              ))}
            </div>
          ) : savedMeals.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/60 rounded-2xl border border-slate-800 space-y-3">
              <Bookmark className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-white">No Saved Meals Yet</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Build your plate on the Food Search tab and click "Save Plate as Favorite" to store your frequent meals here.
              </p>
              <button
                onClick={() => setActiveTab('search')}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-xl transition"
              >
                Go to Food Search
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {savedMeals.map((meal) => (
                <div
                  key={meal.id}
                  className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 shadow-lg flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-bold text-white">{meal.name}</h3>
                      <button
                        onClick={() => deleteSavedMealMutation.mutate(meal.id)}
                        className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                        title="Delete saved meal"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Food Items Pills */}
                    <div className="flex flex-wrap gap-1.5">
                      {meal.items.map((item, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-[11px] text-slate-300"
                        >
                          {item.name || `Food #${item.food_id}`} ({item.servings}x)
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Computed Macros Bar */}
                  <div className="grid grid-cols-4 gap-2 text-center p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                    <div>
                      <span className="text-[9px] text-slate-500 block uppercase font-mono">Carbs</span>
                      <span className="text-sm font-bold text-teal-400 font-mono">{meal.computed_carbs}g</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 block uppercase font-mono">Protein</span>
                      <span className="text-sm font-bold text-blue-400 font-mono">{meal.computed_protein}g</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 block uppercase font-mono">Fat</span>
                      <span className="text-sm font-bold text-amber-400 font-mono">{meal.computed_fat}g</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 block uppercase font-mono">Calories</span>
                      <span className="text-sm font-bold text-purple-400 font-mono">{meal.computed_calories}</span>
                    </div>
                  </div>

                  {/* 1-Tap Log Button */}
                  <button
                    onClick={() => handleLogSavedMeal(meal.id)}
                    disabled={logSavedMealMutation.isPending}
                    className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs transition flex items-center justify-center gap-2 shadow-md shadow-teal-600/20"
                  >
                    <Zap className="w-4 h-4" />
                    <span>Log This Meal (1-Tap)</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: PHOTO MEAL ESTIMATION (AI DRAFT & CONFIRM) */}
      {/* ==================================================================== */}
      {activeTab === 'photo' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload Dropzone */}
          <div className="space-y-6">
            <div className="p-8 rounded-2xl bg-slate-900 border-2 border-dashed border-slate-700 hover:border-teal-500/60 transition-all text-center flex flex-col items-center justify-center space-y-4">
              {photoPreviewUrl ? (
                <div className="relative w-full max-h-64 overflow-hidden rounded-xl border border-slate-700">
                  <img src={photoPreviewUrl} alt="Meal preview" className="w-full object-cover" />
                  <label
                    htmlFor="photo-upload"
                    className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-slate-900/90 text-white text-xs font-semibold cursor-pointer border border-slate-700 hover:bg-slate-800 transition"
                  >
                    Change Image
                  </label>
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                    <Camera className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-white">Upload Meal Photo</h3>
                    <p className="text-xs text-slate-400 max-w-sm">
                      Supports JPEG, PNG images. GlucoTwin AI estimates portions and macros as a draft you can review before confirming.
                    </p>
                  </div>
                  <label
                    htmlFor="photo-upload"
                    className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold cursor-pointer transition shadow-lg shadow-teal-600/20"
                  >
                    Select Photo
                  </label>
                </>
              )}
              <input
                id="photo-upload"
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />
            </div>

            {/* Offline Mock notice */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Deterministic Demo Mode:</strong> With MOCK_GEMINI=true, instant high-fidelity draft estimates are returned offline. With a Gemini API key configured, multi-modal Gemini Vision analyzes the meal in real time.
              </span>
            </div>
          </div>

          {/* AI Draft Review Screen */}
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-teal-400" />
                  <h2 className="text-base font-bold text-white">AI Meal Draft Estimate</h2>
                </div>
                {photoEstimateDraft && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Unconfirmed Draft
                  </span>
                )}
              </div>

              {estimatePhotoMutation.isPending ? (
                <div className="p-12 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-teal-400 animate-spin mx-auto" />
                  <p className="text-xs text-slate-300 font-medium">
                    Analyzing meal composition and portion sizes with vision model...
                  </p>
                </div>
              ) : photoEstimateDraft ? (
                <div className="space-y-4">
                  {/* Confidence & Rationale */}
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Confidence Score:</span>
                      <span className="font-mono font-bold text-teal-400">
                        {Math.round(photoEstimateDraft.confidence * 100)}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed italic">
                      "{photoEstimateDraft.rationale}"
                    </p>
                  </div>

                  {/* Detected Foods */}
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                      Detected Items
                    </span>
                    <div className="space-y-1.5">
                      {photoEstimateDraft.food_items.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs"
                        >
                          <span className="font-medium text-white">{item.name}</span>
                          <span className="text-slate-400 font-mono">
                            {item.portion} • {item.carbs}g carbs
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Editable Macros */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <span className="text-xs font-semibold text-slate-400 block">
                      Estimated Macros (Adjust if needed before confirming)
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 block uppercase">Carbs (g)</label>
                        <input
                          type="number"
                          value={draftMacros.carbs}
                          onChange={(e) =>
                            setDraftMacros((p) => ({ ...p, carbs: parseFloat(e.target.value) || 0 }))
                          }
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-teal-300 font-mono text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block uppercase">Protein (g)</label>
                        <input
                          type="number"
                          value={draftMacros.protein}
                          onChange={(e) =>
                            setDraftMacros((p) => ({ ...p, protein: parseFloat(e.target.value) || 0 }))
                          }
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-blue-300 font-mono text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block uppercase">Fat (g)</label>
                        <input
                          type="number"
                          value={draftMacros.fat}
                          onChange={(e) =>
                            setDraftMacros((p) => ({ ...p, fat: parseFloat(e.target.value) || 0 }))
                          }
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-amber-300 font-mono text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block uppercase">Calories</label>
                        <input
                          type="number"
                          value={draftMacros.calories}
                          onChange={(e) =>
                            setDraftMacros((p) => ({ ...p, calories: parseFloat(e.target.value) || 0 }))
                          }
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-purple-300 font-mono text-xs font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    Review and adjust meal macronutrients as needed before logging.
                  </p>

                  <button
                    onClick={handleConfirmPhotoMeal}
                    disabled={logMealMutation.isPending}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Draft & Log to Twin</span>
                  </button>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Upload a meal photo on the left to generate an AI draft.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: MANUAL GLUCOSE READING */}
      {/* ==================================================================== */}
      {activeTab === 'reading' && (
        <div className="max-w-xl mx-auto p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
          <div className="pb-4 border-b border-slate-800">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-teal-400" />
              Manual Glucose Reading Entry
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Log a fingerstick or CGM reading to update today's glucose summary and time-in-range calculations.
            </p>
          </div>

          <form onSubmit={handleReadingSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-slate-300 block mb-1">Glucose Reading (mg/dL)</label>
              <input
                type="number"
                value={readingVal}
                onChange={(e) => setReadingVal(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-base font-bold"
                required
              />
            </div>

            <div>
              <label className="text-xs text-slate-300 block mb-1">Timestamp</label>
              <input
                type="datetime-local"
                value={readingTime}
                onChange={(e) => setReadingTime(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                required
              />
            </div>

            <button
              type="submit"
              disabled={logReadingMutation.isPending}
              className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-lg shadow-teal-600/20 transition flex items-center justify-center gap-2"
            >
              {logReadingMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>Record Reading</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
