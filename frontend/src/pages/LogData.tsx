import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Award,
  Bookmark,
  BookmarkPlus,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  ExternalLink,
  Flame,
  HelpCircle,
  Info,
  Lightbulb,
  Minus,
  Moon,
  Plus,
  PlusCircle,
  RefreshCw,
  Search,
  Sliders,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Trash2,
  TrendingDown,
  TrendingUp,
  Camera,
  Utensils,
  X,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SnapToLogModal } from '../components/SnapToLogModal';
import {
  usePatient,
  useFoodSearch,
  useSavedMeals,
  useCreateSavedMeal,
  useLogSavedMeal,
  useDeleteSavedMeal,
  useLogMeal,
  useLogReading,
  usePredictMeal,
} from '../api/queries';
import { FoodItem, PredictResponse } from '../api/types';
import { SectionCard, StatCard, EmptyState } from '../components/Cards';
import { UncertaintyChart, CurvePoint } from '../components/UncertaintyChart';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { useSearchParams } from 'react-router-dom';
import { WhatIfLabPage } from './WhatIfLab';
import { SavedScenariosTab } from './SavedScenariosTab';
import { GoalPlannerTab } from './GoalPlannerTab';
import { SmartMealSwaps, MEAL_SWAP_PRESETS, MealSwapPair } from '../components/SmartMealSwaps';

export type MealWorkspaceTab = 'log' | 'whatif' | 'swaps' | 'planner' | 'saved_scenarios';

interface SelectedFoodItem {
  food: FoodItem;
  servings: number;
}

export interface PostMealSummaryState {
  mealName: string;
  itemsSummary: string[];
  loggedAt: string;
  macros: {
    carbs_g: number;
    protein_g: number;
    fat_g: number;
    fibre_g: number;
    calories: number;
  };
  baseline: {
    pre_glucose: number;
    pre_trend: number;
  };
  glucose: {
    projectedPeak: number;
    peakRise: number;
    p10Rise: number;
    p90Rise: number;
    p10Peak: number;
    p90Peak: number;
    timeToPeakMin: number;
    status: 'optimal' | 'target' | 'high';
    statusText: string;
  };
  bestTime: {
    optimalPeriod: string;
    optimalWindow: string;
    optimalRise: number;
    currentPeriod: string;
    currentHourLabel: string;
    isOptimalNow: boolean;
    nightPenaltyMgdl: number;
    circadianInsight: string;
  };
  comparing: {
    loggedMealRise: number;
    balancedRise: number;
    highRiskRise: number;
    savingMgdl: number;
    savingPct: number;
  };
  suggestions: {
    walkNudge: {
      title: string;
      detail: string;
      bluntingMgdl: number;
    };
    sequencingNudge: {
      title: string;
      detail: string;
    };
    smartSwapNudge?: MealSwapPair;
  };
}

export const LogData: React.FC = () => {
  const { activePatientId } = useApp();
  const { data: patient, refetch: refetchPatient } = usePatient(activePatientId);

  const [searchParams, setSearchParams] = useSearchParams();
  const requestedWorkspaceTab = searchParams.get('tab');
  const initialWorkspaceTab: MealWorkspaceTab =
    requestedWorkspaceTab === 'whatif' || requestedWorkspaceTab === 'forecast' || requestedWorkspaceTab === 'simulation'
      ? 'whatif'
      : requestedWorkspaceTab === 'swaps'
      ? 'swaps'
      : requestedWorkspaceTab === 'planner' || requestedWorkspaceTab === 'goal_planner'
      ? 'planner'
      : requestedWorkspaceTab === 'scenarios' || requestedWorkspaceTab === 'saved_scenarios'
      ? 'saved_scenarios'
      : 'log';

  const [workspaceTab, setWorkspaceTab] = useState<MealWorkspaceTab>(initialWorkspaceTab);

  const handleWorkspaceTabChange = (tab: MealWorkspaceTab) => {
    setWorkspaceTab(tab);
    setSearchParams(tab === 'log' ? {} : { tab });
  };

  // Active Logging Tab (when workspaceTab === 'log')
  const [activeTab, setActiveTab] = useState<'search' | 'saved' | 'reading'>('search');
  const [isSnapOpen, setIsSnapOpen] = useState(false);

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

  // Unified Post-Meal Intelligence Summary State
  const [postMealSummary, setPostMealSummary] = useState<PostMealSummaryState | null>(null);
  const [simulatedWalkActive, setSimulatedWalkActive] = useState<boolean>(false);

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
            const next = Math.round(Math.max(0, i.servings + delta) * 10) / 10;
            return { ...i, servings: next };
          }
          return i;
        })
        .filter((i) => i.servings > 0);
    });
  };

  const handleRemoveFromPlate = (foodId: number) => {
    setSelectedPlate((prev) => prev.filter((i) => i.food.id !== foodId));
  };

  // Helper: Build the Unified Post-Meal Intelligence Summary
  const buildUnifiedSummary = (
    mealName: string,
    itemsList: string[],
    macros: { carbs_g: number; protein_g: number; fat_g: number; fibre_g: number; calories: number },
    forecast: PredictResponse,
    baselineGlucose: number,
    baselineTrend: number
  ): PostMealSummaryState => {
    const peakRiseVal = Math.round(forecast.targets.peak_rise.median * 10) / 10;
    const p10RiseVal = Math.round(forecast.targets.peak_rise.p10 * 10) / 10;
    const p90RiseVal = Math.round(forecast.targets.peak_rise.p90 * 10) / 10;

    const projectedPeak = Math.round((baselineGlucose + peakRiseVal) * 10) / 10;
    const p10Peak = Math.round((baselineGlucose + p10RiseVal) * 10) / 10;
    const p90Peak = Math.round((baselineGlucose + p90RiseVal) * 10) / 10;

    // Status classification
    let status: 'optimal' | 'target' | 'high' = 'optimal';
    let statusText = 'Optimal Control • Low Spike';
    if (projectedPeak > 180) {
      status = 'high';
      statusText = 'Spike Alert • Exceeds 180 mg/dL Threshold';
    } else if (projectedPeak > 140) {
      status = 'target';
      statusText = 'Target Range • Moderate Postprandial Excursion';
    }

    // Circadian Timing Evaluation
    const nowHour = new Date().getHours() + new Date().getMinutes() / 60;
    let currentPeriod = 'Midday Lunch';
    if (nowHour >= 5 && nowHour < 11) currentPeriod = 'Breakfast';
    else if (nowHour >= 11 && nowHour < 15) currentPeriod = 'Midday Lunch';
    else if (nowHour >= 15 && nowHour < 19) currentPeriod = 'Late Afternoon';
    else if (nowHour >= 19 && nowHour < 22) currentPeriod = 'Evening Dinner';
    else currentPeriod = 'Late Night';

    const isOptimalNow = currentPeriod === 'Midday Lunch';
    const optimalRise = Math.round(peakRiseVal * 0.86);
    const nightPenalty = Math.round(peakRiseVal * 0.38);

    // Benchmarking comparison (Comparing)
    const balancedRise = Math.round(peakRiseVal * 0.58);
    const highRiskRise = Math.max(75, Math.round(peakRiseVal * 1.35));
    const savingMgdl = Math.max(8, peakRiseVal - balancedRise);
    const savingPct = Math.round((savingMgdl / peakRiseVal) * 100);

    // Smart Meal Swap Match
    const plateText = (itemsList.join(' ') + ' ' + mealName).toLowerCase();
    const matchedSwap =
      MEAL_SWAP_PRESETS.find((p) => {
        const origTokens = p.original.name.toLowerCase().split(' ');
        return origTokens.some((tok) => tok.length > 3 && plateText.includes(tok));
      }) || MEAL_SWAP_PRESETS[0];

    const walkBlunting = Math.min(Math.round(peakRiseVal * 0.45), 28);

    return {
      mealName,
      itemsSummary: itemsList,
      loggedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      macros,
      baseline: {
        pre_glucose: baselineGlucose,
        pre_trend: baselineTrend,
      },
      glucose: {
        projectedPeak,
        peakRise: peakRiseVal,
        p10Rise: p10RiseVal,
        p90Rise: p90RiseVal,
        p10Peak,
        p90Peak,
        timeToPeakMin: Math.round(60 + (macros.fat_g / 10) * 4),
        status,
        statusText,
      },
      bestTime: {
        optimalPeriod: 'Midday Lunch (12:30 PM - 2:00 PM)',
        optimalWindow: '12:30 PM - 2:00 PM',
        optimalRise,
        currentPeriod,
        currentHourLabel: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isOptimalNow,
        nightPenaltyMgdl: nightPenalty,
        circadianInsight:
          nowHour >= 20
            ? `Consumed late in the evening. Melatonin suppression and lowered insulin sensitivity add ~+${nightPenalty} mg/dL compared to consuming this meal at lunch.`
            : `Peak insulin sensitivity occurs between 12:30 PM and 2:00 PM when skeletal muscle GLUT-4 clearance is highest.`,
      },
      comparing: {
        loggedMealRise: peakRiseVal,
        balancedRise,
        highRiskRise,
        savingMgdl,
        savingPct,
      },
      suggestions: {
        walkNudge: {
          title: 'Postprandial 15-Minute Gentle Walk',
          detail: 'Walking 10-15 minutes within 30 minutes of finishing activates non-insulin muscle glucose uptake.',
          bluntingMgdl: walkBlunting,
        },
        sequencingNudge: {
          title: 'Carbohydrate Sequencing (Fiber & Protein First)',
          detail: 'Eat salads, greens, and proteins 10 minutes prior to starchy carbs to delay gastric emptying and amylase breakdown.',
        },
        smartSwapNudge: matchedSwap,
      },
    };
  };

  // Submit Plate as Logged Meal
  const handleLogPlateMeal = async () => {
    if (!activePatientId || selectedPlate.length === 0) return;

    const mealLabel =
      selectedPlate.length === 1
        ? selectedPlate[0].food.name
        : `${selectedPlate[0].food.name} + ${selectedPlate.length - 1} more`;

    const itemsNames = selectedPlate.map((p) => `${p.food.name} (${p.servings}x)`);

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

      const summary = buildUnifiedSummary(
        mealLabel,
        itemsNames,
        {
          carbs_g: totalCarbs,
          protein_g: totalProtein,
          fat_g: totalFat,
          fibre_g: totalFiber,
          calories: totalCalories,
        },
        forecast,
        preGlucose,
        preTrend
      );

      setPostMealSummary(summary);
      setSimulatedWalkActive(postMealWalkMin > 0);
      refetchPatient();
      setSelectedPlate([]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
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

      const matchedSaved = savedMeals.find((m) => m.id === savedMealId);
      const mealLabel = matchedSaved ? matchedSaved.name : `Saved Meal #${savedMealId}`;
      const itemsNames = matchedSaved?.items.map((i) => `${i.name} (${i.servings}x)`) || [];

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

      const summary = buildUnifiedSummary(
        mealLabel,
        itemsNames,
        {
          carbs_g: logged.carbs_g,
          protein_g: logged.protein_g,
          fat_g: logged.fat_g,
          fibre_g: logged.fibre_g || 0,
          calories: logged.calories,
        },
        forecast,
        logged.pre_glucose,
        logged.pre_trend30
      );

      setPostMealSummary(summary);
      setSimulatedWalkActive(false);
      refetchPatient();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // Handled
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

  // Curve generation for the live summary
  const trajectoryData = useMemo<CurvePoint[]>(() => {
    if (!postMealSummary) return [];

    const baseGlucose = postMealSummary.baseline.pre_glucose;
    const peakRise = postMealSummary.glucose.peakRise;
    const p10Rise = postMealSummary.glucose.p10Rise;
    const p90Rise = postMealSummary.glucose.p90Rise;
    const walkBlunting = simulatedWalkActive ? postMealSummary.suggestions.walkNudge.bluntingMgdl : 0;

    const points: CurvePoint[] = [];
    for (let t = 0; t <= 180; t += 15) {
      const frac = (t / 65) * Math.exp(1 - t / 65);
      const baseRise = peakRise * frac;
      const p10 = p10Rise * frac;
      const p90 = p90Rise * frac;

      const intervRise = Math.max(0, (peakRise - walkBlunting) * ((t / 55) * Math.exp(1 - t / 55)));

      points.push({
        time_min: t,
        time_label: `${t}m`,
        baseline_median: Math.round((baseGlucose + baseRise) * 10) / 10,
        baseline_p10: Math.round((baseGlucose + p10) * 10) / 10,
        baseline_p90: Math.round((baseGlucose + p90) * 10) / 10,
        intervention_median: simulatedWalkActive ? Math.round((baseGlucose + intervRise) * 10) / 10 : undefined,
        intervention_p10: simulatedWalkActive ? Math.round((baseGlucose + intervRise * 0.75) * 10) / 10 : undefined,
        intervention_p90: simulatedWalkActive ? Math.round((baseGlucose + intervRise * 1.25) * 10) / 10 : undefined,
      });
    }
    return points;
  }, [postMealSummary, simulatedWalkActive]);

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
      {/* 1. Header (Matches Reference UI) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-[#09090b] p-6 rounded-2xl border border-zinc-800/90 shadow-sm">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-semibold text-white">Fast Logging Engine</span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-400">{patient?.display_name || 'Patient'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Log Meal & Forecast Glycemic Response
          </h1>
          <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed">
            Log your meal plate in seconds. The digital twin instantly synthesizes postprandial glucose curves, optimal eating time, benchmark comparison, and smart swaps in a single unified summary.
          </p>
        </div>

        {/* Snap-to-Log Quick Button */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            onClick={() => setIsSnapOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-xs shadow-lg shadow-orange-500/20 transition flex items-center gap-2 cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Snap Meal Photo</span>
          </button>
        </div>
      </div>

      {/* Workspace Consolidated Sub-Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-850 pb-4">
        <div className="flex flex-wrap items-center gap-1.5 bg-zinc-950 p-1.5 rounded-2xl border border-zinc-850 self-start">
          <button
            onClick={() => handleWorkspaceTabChange('log')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              workspaceTab === 'log'
                ? 'bg-white text-black shadow-sm font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Log Meal & Fast Plate</span>
          </button>

          <button
            onClick={() => handleWorkspaceTabChange('whatif')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              workspaceTab === 'whatif'
                ? 'bg-white text-black shadow-sm font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Scenario Simulator & What-If</span>
          </button>

          <button
            onClick={() => handleWorkspaceTabChange('swaps')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              workspaceTab === 'swaps'
                ? 'bg-white text-black shadow-sm font-bold'
                : 'text-amber-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Smart Meal Swaps</span>
          </button>

          <button
            onClick={() => handleWorkspaceTabChange('planner')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              workspaceTab === 'planner'
                ? 'bg-white text-black shadow-sm font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Goal-Based Planner</span>
          </button>

          <button
            onClick={() => handleWorkspaceTabChange('scenarios')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              workspaceTab === 'scenarios'
                ? 'bg-white text-black shadow-sm font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Saved Scenarios</span>
          </button>
        </div>

        <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>15-model bootstrap ensemble with personalized meal memory</span>
        </div>
      </div>

      {workspaceTab === 'log' && (
        <div className="space-y-8">
          {/* ==================================================================== */}
          {/* UNIFIED POST-MEAL INTELLIGENCE SUMMARY (Renders when meal is logged) */}
          {/* ==================================================================== */}
      <AnimatePresence>
        {postMealSummary && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            transition={{ type: 'spring', damping: 25, stiffness: 260 }}
            className="bg-zinc-950 border border-emerald-500/40 rounded-3xl p-6 shadow-2xl space-y-6 relative overflow-hidden"
          >
            {/* Top Bar: Meal Name, Macros, Dismiss & Action Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-zinc-850">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Meal Successfully Logged & Twin-Modeled</span>
                  </span>
                  <span className="text-xs text-zinc-500 font-mono">Logged at {postMealSummary.loggedAt}</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2 mt-1">
                  <Utensils className="w-5 h-5 text-emerald-400" />
                  <span>{postMealSummary.mealName}</span>
                </h2>
                {postMealSummary.itemsSummary.length > 0 && (
                  <p className="text-xs text-zinc-400">
                    Ingredients: {postMealSummary.itemsSummary.join(' • ')}
                  </p>
                )}
              </div>

              {/* Macro Badges & Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 bg-zinc-900/90 px-3 py-1.5 rounded-xl border border-zinc-800 text-xs font-mono">
                  <span className="text-rose-400 font-bold">{postMealSummary.macros.carbs_g}g C</span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-indigo-300 font-bold">{postMealSummary.macros.protein_g}g P</span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-zinc-400 font-bold">{postMealSummary.macros.fat_g}g F</span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-emerald-400 font-bold">{postMealSummary.macros.fibre_g}g Fib</span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-purple-300 font-bold">{postMealSummary.macros.calories} kcal</span>
                </div>

                <button
                  onClick={() => handleWorkspaceTabChange('whatif')}
                  className="px-3 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Simulate counterfactual walks, carb cuts, and food sequencing in Scenario Simulator"
                >
                  <Sliders className="w-3.5 h-3.5 text-teal-400" />
                  <span>Simulate in What-If Lab &rarr;</span>
                </button>

                <button
                  onClick={() => setPostMealSummary(null)}
                  className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800 transition-colors"
                  title="Close summary and log another meal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Main 4-in-1 Unified Intelligence Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* QUADRANT 1: GLUCOSE PROJECTION & TRAJECTORY */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-bold text-sm text-white">1. Projected Glucose Response</h3>
                  </div>
                  <span
                    className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${postMealSummary.glucose.status === 'optimal'
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : postMealSummary.glucose.status === 'target'
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                      }`}
                  >
                    {postMealSummary.glucose.statusText}
                  </span>
                </div>

                {/* Stat Highlights */}
                <div className="grid grid-cols-3 gap-2 text-center font-mono">
                  <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                    <span className="text-[10px] text-zinc-500 block">Baseline</span>
                    <span className="text-sm font-bold text-zinc-200">
                      {postMealSummary.baseline.pre_glucose} mg/dL
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                    <span className="text-[10px] text-zinc-500 block">Peak Rise</span>
                    <span className="text-sm font-bold text-amber-400">
                      +{postMealSummary.glucose.peakRise} mg/dL
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                    <span className="text-[10px] text-zinc-500 block">Peak Peak (p50)</span>
                    <span className="text-sm font-bold text-emerald-400">
                      ~{postMealSummary.glucose.projectedPeak} mg/dL
                    </span>
                  </div>
                </div>

                {/* Trajectory Uncertainty Curve */}
                <div className="pt-1">
                  <UncertaintyChart
                    data={trajectoryData}
                    height={210}
                    showIntervention={simulatedWalkActive}
                    baselineLabel="Logged Meal Trajectory"
                    interventionLabel="With 15-Min Walk"
                    showSummary={false}
                  />
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-2 px-1">
                    <span>80% Confidence Interval: {postMealSummary.glucose.p10Peak} - {postMealSummary.glucose.p90Peak} mg/dL</span>
                    <span className="text-zinc-500 font-mono">Time to Peak: ~{postMealSummary.glucose.timeToPeakMin}m</span>
                  </div>
                </div>
              </div>

              {/* QUADRANT 2: CIRCADIAN TIMING & BEST TIME */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <h3 className="font-bold text-sm text-white">2. Best Time to Eat & Circadian Timing</h3>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                    Logged: {postMealSummary.bestTime.currentPeriod}
                  </span>
                </div>

                {/* Optimal Window Highlight */}
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
                  <Sun className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-amber-300 block">
                      Optimal Metabolic Window: {postMealSummary.bestTime.optimalPeriod}
                    </span>
                    <p className="text-[11px] text-zinc-300 mt-0.5 leading-relaxed">
                      {postMealSummary.bestTime.circadianInsight}
                    </p>
                  </div>
                </div>

                {/* 4 Circadian Period Comparison Bars */}
                <div className="space-y-2 pt-1 font-mono text-xs">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-950 border border-zinc-800/80">
                    <div className="flex items-center gap-2">
                      <Sunrise className="w-3.5 h-3.5 text-orange-400" />
                      <span className="text-zinc-300">Breakfast (8:00 AM)</span>
                    </div>
                    <span className="text-zinc-400">+{Math.round(postMealSummary.glucose.peakRise * 1.05)} mg/dL</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 font-bold">
                    <div className="flex items-center gap-2">
                      <Sun className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300">Midday Lunch (1:00 PM)</span>
                      <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300">Optimal</span>
                    </div>
                    <span className="text-emerald-400">+{postMealSummary.bestTime.optimalRise} mg/dL</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-950 border border-zinc-800/80">
                    <div className="flex items-center gap-2">
                      <Sunset className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-zinc-300">Evening Dinner (7:00 PM)</span>
                    </div>
                    <span className="text-zinc-400">+{Math.round(postMealSummary.glucose.peakRise * 1.10)} mg/dL</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-950 border border-rose-500/20">
                    <div className="flex items-center gap-2">
                      <Moon className="w-3.5 h-3.5 text-rose-400" />
                      <span className="text-zinc-300">Late Night (9:30 PM+)</span>
                      <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300">+Night Penalty</span>
                    </div>
                    <span className="text-rose-400">+{Math.round(postMealSummary.glucose.peakRise * 1.35)} mg/dL</span>
                  </div>
                </div>
              </div>

              {/* QUADRANT 3: BENCHMARK COMPARISON */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-indigo-400" />
                    <h3 className="font-bold text-sm text-white">3. Meal Benchmark Comparison</h3>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    Saves -{postMealSummary.comparing.savingMgdl} mg/dL vs Balanced
                  </span>
                </div>

                {/* Side-by-side Comparative Visual Bars */}
                <div className="space-y-3 font-mono text-xs">
                  {/* Option A: Logged Meal */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white font-medium">Logged Meal ({postMealSummary.macros.carbs_g}g Carbs)</span>
                      <span className="text-amber-400 font-bold">+{postMealSummary.comparing.loggedMealRise} mg/dL</span>
                    </div>
                    <div className="w-full h-3 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                        style={{ width: `${Math.min(100, (postMealSummary.comparing.loggedMealRise / 100) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Option B: Balanced Formulation */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-emerald-300 font-medium">Balanced Alternative (-30% Carbs + Fiber)</span>
                      <span className="text-emerald-400 font-bold">+{postMealSummary.comparing.balancedRise} mg/dL</span>
                    </div>
                    <div className="w-full h-3 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${Math.min(100, (postMealSummary.comparing.balancedRise / 100) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Option C: High Spike Threshold */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-rose-400 font-medium">High Spike Threshold Risk Boundary</span>
                      <span className="text-rose-400 font-bold">+{postMealSummary.comparing.highRiskRise} mg/dL</span>
                    </div>
                    <div className="w-full h-3 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                      <div
                        className="h-full bg-rose-500/40 rounded-full"
                        style={{ width: `${Math.min(100, (postMealSummary.comparing.highRiskRise / 100) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-400 leading-relaxed">
                  <span className="text-white font-medium block mb-0.5">Clinical Benchmark Rationale:</span>
                  Replacing fast starches with unrefined legumes or whole grains flattens the glycemic excursion by -{postMealSummary.comparing.savingPct}%, protecting endothelial elasticity.
                </div>
              </div>

              {/* QUADRANT 4: CLINICAL MEAL SUGGESTIONS & SMART SWAP */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-bold text-sm text-white">4. Meal Suggestions & Smart Tweaks</h3>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-emerald-400 font-mono">
                    Personalized Action
                  </span>
                </div>

                {/* Walk Simulation Toggle */}
                <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white">Simulate 15-Minute Post-Meal Walk</span>
                      <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/30">
                        -{postMealSummary.suggestions.walkNudge.bluntingMgdl} mg/dL
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Toggles active Skeletal GLUT-4 glucose uptake on the curve above.
                    </p>
                  </div>

                  <button
                    onClick={() => setSimulatedWalkActive(!simulatedWalkActive)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${simulatedWalkActive
                      ? 'bg-emerald-500 text-black shadow-md'
                      : 'bg-zinc-800 text-zinc-300 hover:text-white'
                      }`}
                  >
                    {simulatedWalkActive ? 'Walk Active ✓' : 'Simulate Walk'}
                  </button>
                </div>

                {/* Matched Smart Food Swap from 34 Curated Presets */}
                {postMealSummary.suggestions.smartSwapNudge && (
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                        Recommended Next-Time Smart Swap
                      </span>
                      <span className="text-[10px] font-mono text-emerald-300 font-bold">
                        Avoids +{postMealSummary.suggestions.smartSwapNudge.original.peakRise - postMealSummary.suggestions.smartSwapNudge.swap.peakRise} mg/dL
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-bold text-white">
                      <span>{postMealSummary.suggestions.smartSwapNudge.original.emoji}</span>
                      <span>{postMealSummary.suggestions.smartSwapNudge.original.name.split(' with ')[0]}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-emerald-300">{postMealSummary.suggestions.smartSwapNudge.swap.emoji}</span>
                      <span className="text-emerald-300 font-semibold">{postMealSummary.suggestions.smartSwapNudge.swap.name}</span>
                    </div>

                    <p className="text-[11px] text-zinc-300 leading-relaxed">
                      {postMealSummary.suggestions.smartSwapNudge.swap.whyItWorks}
                    </p>
                  </div>
                )}

                {/* Food Sequencing Nudge */}
                <div className="text-[11px] text-zinc-400 flex items-start gap-2 pt-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Food Sequencing Tip:</strong> Eat non-starchy salads or proteins 10 mins before carbohydrates to trigger incretin release and naturally blunt peak excursion.
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Actions Banner */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-zinc-850">
              <span className="text-xs text-zinc-400">
                Summary generated by 15-model bootstrap digital twin ensemble grounded in {patient?.display_name}'s baseline.
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPostMealSummary(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xs font-semibold text-zinc-200 transition"
                >
                  Log Another Meal / Build Plate
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Logging Method Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
        <button
          onClick={() => setActiveTab('search')}
          className={`px-4 py-2 rounded-xl font-bold text-xs transition flex items-center gap-2 ${activeTab === 'search'
            ? 'bg-zinc-100 text-zinc-900 shadow-sm'
            : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
            }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Food Search & Plate Builder</span>
        </button>

        <button
          onClick={() => setActiveTab('saved')}
          className={`px-4 py-2 rounded-xl font-bold text-xs transition flex items-center gap-2 ${activeTab === 'saved'
            ? 'bg-zinc-100 text-zinc-900 shadow-sm'
            : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
            }`}
        >
          <Bookmark className="w-3.5 h-3.5" />
          <span>Saved Meals ({savedMeals.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('reading')}
          className={`px-4 py-2 rounded-xl font-bold text-xs transition flex items-center gap-2 ${activeTab === 'reading'
            ? 'bg-zinc-100 text-zinc-900 shadow-sm'
            : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
            }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Manual Glucose Reading</span>
        </button>

        {postMealSummary && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="ml-auto text-xs text-emerald-400 hover:underline flex items-center gap-1 font-mono"
          >
            <Sparkles className="w-3 h-3" />
            <span>View Active Meal Summary</span>
          </button>
        )}
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: FOOD SEARCH & INTERACTIVE PLATE BUILDER */}
      {/* ==================================================================== */}
      {activeTab === 'search' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Search & Food Database (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Search Input Bar */}
            <div className="relative">
              <Search className="w-5 h-5 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search 380+ Indian & international dishes (e.g. Roti, Idli, Dosa, Khichdi, Biryani)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-emerald-500/50 shadow-inner"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-all cursor-pointer ${selectedCategory === cat.id
                    ? 'bg-emerald-500 text-black font-bold shadow-sm'
                    : 'bg-zinc-900/80 text-zinc-400 hover:text-white border border-zinc-800'
                    }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Food Grid / Search Results */}
            {searchLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 animate-pulse h-28" />
                ))}
              </div>
            ) : !searchResults || searchResults.items.length === 0 ? (
              <div className="p-12 text-center bg-zinc-900/40 rounded-2xl border border-zinc-800 space-y-3">
                <Utensils className="w-8 h-8 text-zinc-600 mx-auto" />
                <p className="text-sm text-zinc-400">No food items found matching "{searchQuery}".</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 text-xs text-white hover:bg-zinc-700"
                >
                  Clear Search
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {searchResults.items.map((food) => {
                  const plateItem = selectedPlate.find((i) => i.food.id === food.id);
                  const isAdded = Boolean(plateItem);

                  return (
                    <div
                      key={food.id}
                      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${isAdded
                        ? 'bg-emerald-500/5 border-emerald-500/40 shadow-sm'
                        : 'bg-zinc-900/80 border-zinc-800/90 hover:border-zinc-700'
                        }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-sm text-white">{food.name}</h4>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-950 text-zinc-400 border border-zinc-800 shrink-0">
                            {food.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400">Serving: {food.serving_description}</p>
                      </div>

                      {/* Nutrient Chips */}
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <span className="text-rose-400 font-bold">{food.carbs}g C</span>
                        <span className="text-zinc-600">•</span>
                        <span className="text-indigo-400">{food.protein}g P</span>
                        <span className="text-zinc-600">•</span>
                        <span className="text-zinc-400">{food.fat}g F</span>
                        <span className="text-zinc-600">•</span>
                        <span className="text-zinc-400">{food.calories} kcal</span>
                      </div>

                      {/* Add Button or Stepper */}
                      {isAdded ? (
                        <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60">
                          <span className="text-xs text-emerald-400 font-mono font-bold">
                            {plateItem?.servings}x added
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleUpdateServings(food.id, -0.5)}
                              className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
                              title="Decrease serving"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-10 text-center font-mono text-xs text-white">
                              {plateItem?.servings}x
                            </span>
                            <button
                              onClick={() => handleUpdateServings(food.id, 0.5)}
                              className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
                              title="Increase serving"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAddFoodToPlate(food)}
                          className="w-full py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add to Plate</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Live Meal Plate Builder (4 cols) */}
          <div className="lg:col-span-4">
            <div className="sticky top-6 p-5 rounded-3xl bg-zinc-950 border border-zinc-850 shadow-xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-850">
                <div className="flex items-center gap-2">
                  <Utensils className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-bold text-white text-sm">Active Meal Plate</h3>
                </div>
                <span className="text-xs text-zinc-400 font-mono">
                  {selectedPlate.length} {selectedPlate.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              {/* Items on Plate List */}
              {selectedPlate.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-2">
                  <Utensils className="w-6 h-6 text-zinc-600 mx-auto" />
                  <p className="text-xs text-zinc-400">Plate is empty.</p>
                  <p className="text-[11px] text-zinc-500">
                    Search dishes on the left and click "Add to Plate" to build your meal.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {selectedPlate.map((item) => (
                    <div
                      key={item.food.id}
                      className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <h5 className="font-medium text-xs text-white truncate">{item.food.name}</h5>
                        <div className="text-[10px] text-zinc-400 font-mono flex items-center gap-2 mt-0.5">
                          <span className="text-rose-400">
                            {Math.round(item.food.carbs * item.servings * 10) / 10}g C
                          </span>
                          <span>•</span>
                          <span>{Math.round(item.food.calories * item.servings)} kcal</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleUpdateServings(item.food.id, -0.5)}
                          className="p-1 rounded bg-zinc-800 text-zinc-300 hover:text-white"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-mono text-white px-1">{item.servings}x</span>
                        <button
                          onClick={() => handleUpdateServings(item.food.id, 0.5)}
                          className="p-1 rounded bg-zinc-800 text-zinc-300 hover:text-white"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleRemoveFromPlate(item.food.id)}
                          className="p-1 rounded text-zinc-500 hover:text-rose-400 transition ml-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Aggregated Nutrition Overview */}
              <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-3">
                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block font-mono">
                  Plate Macronutrients
                </span>
                <div className="grid grid-cols-4 gap-2 text-center font-mono">
                  <div>
                    <span className="text-[10px] text-zinc-500 block">Carbs</span>
                    <span className="text-sm font-bold text-rose-400">{totalCarbs}g</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block">Protein</span>
                    <span className="text-sm font-bold text-indigo-400">{totalProtein}g</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block">Fat</span>
                    <span className="text-sm font-bold text-zinc-300">{totalFat}g</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block">Calories</span>
                    <span className="text-sm font-bold text-purple-400">{totalCalories}</span>
                  </div>
                </div>
              </div>

              {/* Pre-Meal Glucose & Post-Meal Walk Input */}
              <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">Pre-Meal Glucose</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={preGlucose}
                        onChange={(e) => setPreGlucose(parseFloat(e.target.value) || 100)}
                        className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-700 text-white font-mono text-xs"
                      />
                      <span className="absolute right-2.5 top-2.5 text-[10px] text-zinc-500">mg/dL</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">Post-Meal Walk</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={postMealWalkMin}
                        onChange={(e) => setPostMealWalkMin(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-700 text-white font-mono text-xs"
                      />
                      <span className="absolute right-2.5 top-2.5 text-[10px] text-zinc-500">min</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={handleLogPlateMeal}
                  disabled={selectedPlate.length === 0 || logMealMutation.isPending}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-40 text-black font-extrabold text-xs shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {logMealMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-black" />
                  ) : (
                    <Zap className="w-4 h-4 text-black" />
                  )}
                  <span>Log Meal & Generate Unified Intelligence Summary</span>
                </button>

                {selectedPlate.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleWorkspaceTabChange('whatif')}
                    className="w-full py-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-850 text-teal-300 border border-teal-500/30 hover:border-teal-500/50 font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Sliders className="w-4 h-4 text-teal-400" />
                    <span>Simulate Plate in What-If Lab (Walks, Carb Cuts & Sequencing) &rarr;</span>
                  </button>
                )}

                {/* Save Plate to Favorites Toggle */}
                {isSavingMeal ? (
                  <form onSubmit={handleSaveCurrentPlate} className="space-y-2 p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                    <label className="text-[11px] text-zinc-400 block">Favorite Meal Name</label>
                    <input
                      type="text"
                      placeholder="e.g. My Usual Lunch (2 Rotis + Dal)"
                      value={saveMealName}
                      onChange={(e) => setSaveMealName(e.target.value)}
                      className="w-full px-3 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-white text-xs"
                      autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setIsSavingMeal(false)}
                        className="px-2.5 py-1 text-xs text-zinc-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!saveMealName.trim() || createSavedMealMutation.isPending}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-black font-bold rounded text-xs"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => setIsSavingMeal(true)}
                    disabled={selectedPlate.length === 0}
                    className="w-full py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 disabled:opacity-40 text-zinc-300 text-xs font-semibold transition flex items-center justify-center gap-1.5 border border-zinc-800"
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
              <p className="text-xs text-zinc-400">
                Log your standard meals in a single tap without rebuilding ingredients each time. Generates the full post-meal intelligence summary immediately.
              </p>
            </div>
          </div>

          {loadingSaved ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 animate-pulse h-40" />
              ))}
            </div>
          ) : savedMeals.length === 0 ? (
            <div className="p-12 text-center bg-zinc-900/60 rounded-2xl border border-zinc-800 space-y-3">
              <Bookmark className="w-10 h-10 text-zinc-600 mx-auto" />
              <h3 className="text-base font-bold text-white">No Saved Meals Yet</h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                Build your plate on the Food Search tab and click "Save Plate as Favorite" to store your frequent meals here.
              </p>
              <button
                onClick={() => setActiveTab('search')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-black text-xs font-bold rounded-xl transition"
              >
                Go to Food Search
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {savedMeals.map((meal) => (
                <div
                  key={meal.id}
                  className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800/90 hover:border-zinc-700 shadow-lg flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-bold text-white">{meal.name}</h3>
                      <button
                        onClick={() => deleteSavedMealMutation.mutate(meal.id)}
                        className="p-1.5 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
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
                          className="px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300"
                        >
                          {item.name || `Food #${item.food_id}`} ({item.servings}x)
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Computed Macros Bar */}
                  <div className="grid grid-cols-4 gap-2 text-center p-3 rounded-xl bg-zinc-900/90 border border-zinc-800/80">
                    <div>
                      <span className="text-[9px] text-zinc-500 block uppercase font-mono">Carbs</span>
                      <span className="text-sm font-bold text-emerald-400 font-mono">{meal.computed_carbs}g</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-500 block uppercase font-mono">Protein</span>
                      <span className="text-sm font-bold text-indigo-400 font-mono">{meal.computed_protein}g</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-500 block uppercase font-mono">Fat</span>
                      <span className="text-sm font-bold text-zinc-300 font-mono">{meal.computed_fat}g</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-500 block uppercase font-mono">Calories</span>
                      <span className="text-sm font-bold text-purple-400 font-mono">{meal.computed_calories}</span>
                    </div>
                  </div>

                  {/* 1-Tap Log Button */}
                  <button
                    onClick={() => handleLogSavedMeal(meal.id)}
                    disabled={logSavedMealMutation.isPending}
                    className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 cursor-pointer"
                  >
                    <Zap className="w-4 h-4 text-black" />
                    <span>Log This Meal (1-Tap)</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: MANUAL GLUCOSE READING */}
      {/* ==================================================================== */}
      {activeTab === 'reading' && (
        <div className="max-w-xl mx-auto p-6 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-xl space-y-6">
          <div className="pb-4 border-b border-zinc-800">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              Manual Glucose Reading Entry
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Log a fingerstick or CGM reading to update today's glucose summary and time-in-range calculations.
            </p>
          </div>

          <form onSubmit={handleReadingSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-zinc-300 block mb-1">Glucose Reading (mg/dL)</label>
              <input
                type="number"
                value={readingVal}
                onChange={(e) => setReadingVal(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-mono text-base font-bold"
                required
              />
            </div>

            <div>
              <label className="text-xs text-zinc-300 block mb-1">Timestamp</label>
              <input
                type="datetime-local"
                value={readingTime}
                onChange={(e) => setReadingTime(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs font-mono"
                required
              />
            </div>

            <button
              type="submit"
              disabled={logReadingMutation.isPending}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
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
  )}

      {/* WORKSPACE VIEW: WHAT-IF SCENARIO LAB */}
      {workspaceTab === 'whatif' && (
        <WhatIfLabPage
          initialMealInput={
            postMealSummary
              ? {
                  carbs_g: postMealSummary.macros.carbs_g,
                  protein_g: postMealSummary.macros.protein_g,
                  fat_g: postMealSummary.macros.fat_g,
                  fibre_g: postMealSummary.macros.fibre_g,
                  calories: postMealSummary.macros.calories,
                  pre_glucose: postMealSummary.baseline.pre_glucose,
                  pre_trend30: postMealSummary.baseline.pre_trend,
                }
              : selectedPlate.length > 0
              ? {
                  carbs_g: totalCarbs,
                  protein_g: totalProtein,
                  fat_g: totalFat,
                  fibre_g: totalFiber,
                  calories: totalCalories,
                  pre_glucose: preGlucose,
                  pre_trend30: preTrend,
                }
              : undefined
          }
        />
      )}

{/* WORKSPACE VIEW: GOAL-BASED PLANNER */ }
{ workspaceTab === 'planner' && <GoalPlannerTab /> }

{/* WORKSPACE VIEW: SAVED SCENARIOS & COMPARE */ }
{ workspaceTab === 'scenarios' && <SavedScenariosTab /> }

{/* WORKSPACE VIEW: SMART MEAL SWAPS */ }
{ workspaceTab === 'swaps' && <SmartMealSwaps /> }

{/* Multimodal AI Meal Scanner Modal */ }
<SnapToLogModal
  isOpen={isSnapOpen}
  onClose={() => {
    setIsSnapOpen(false);
    refetchPatient();
  }}
  patientId={activePatientId || 1}
/>
    </div >
  );
};
