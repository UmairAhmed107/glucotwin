import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Edit3,
  Flame,
  HelpCircle,
  Image as ImageIcon,
  Info,
  Layers,
  Lightbulb,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UploadCloud,
  Utensils,
  X,
  Zap,
} from 'lucide-react';
import { useLogMeal } from '../api/queries';
import { showToast, apiRequest } from '../api/client';

export interface MealPreset {
  id: string;
  name: string;
  imageEmoji: string;
  detectedFoods: string[];
  carbsG: number;
  proteinG: number;
  fatG: number;
  fiberG: number;
  calories: number;
  smartHack: string;
}

export const PRESET_MEALS: MealPreset[] = [
  {
    id: 'biryani',
    name: 'Chicken Biryani with Cucumber Raita',
    imageEmoji: '🍛',
    detectedFoods: ['Basmati Rice (1.5 cups)', 'Spiced Chicken Thigh (120g)', 'Yogurt Raita (100g)'],
    carbsG: 64,
    proteinG: 32,
    fatG: 16,
    fiberG: 4,
    calories: 530,
    smartHack:
      'Eat the cucumber yogurt raita first! The protein and healthy fat line your digestive tract, reducing the rice glucose spike by ~28%.',
  },
  {
    id: 'salmon_salad',
    name: 'Grilled Salmon & Mediterranean Salad',
    imageEmoji: '🥗',
    detectedFoods: ['Wild Atlantic Salmon (160g)', 'Mixed Greens & Cucumber', 'Olive Oil Dressing', 'Steamed Quinoa (0.5 cup)'],
    carbsG: 20,
    proteinG: 38,
    fatG: 18,
    fiberG: 7,
    calories: 395,
    smartHack:
      'Outstanding balance! High omega-3 fats and soluble fiber keep your postprandial glucose flat and within the 70-140 mg/dL target zone for 4+ hours.',
  },
  {
    id: 'pizza',
    name: 'Pepperoni Pizza (2 Slices)',
    imageEmoji: '🍕',
    detectedFoods: ['Thin Crust Wheat Dough', 'Tomato Sauce', 'Mozzarella Cheese', 'Pepperoni Slices'],
    carbsG: 68,
    proteinG: 24,
    fatG: 26,
    fiberG: 3,
    calories: 600,
    smartHack:
      'Dual-wave delayed spike warning! High dietary fat delays gastric emptying. Take a brisk 15-minute walk 45 minutes after eating to blunt the late peak.',
  },
  {
    id: 'oats',
    name: 'Steel-Cut Oats with Berries & Walnuts',
    imageEmoji: '🥣',
    detectedFoods: ['Steel Cut Oats (1 cup)', 'Fresh Blueberries', 'Crushed Walnuts (25g)', 'Chia Seeds'],
    carbsG: 42,
    proteinG: 12,
    fatG: 10,
    fiberG: 8,
    calories: 305,
    smartHack:
      'Beta-glucan soluble fiber in steel-cut oats forms a gel in the intestine, slowing carbohydrate absorption and blunting morning fasting drift.',
  },
  {
    id: 'burger',
    name: 'Classic Cheeseburger with Fries',
    imageEmoji: '🍔',
    detectedFoods: ['Toasted Sesame Bun', 'Lean Beef Patty (150g)', 'Cheddar Cheese', 'Potato Fries (80g)'],
    carbsG: 65,
    proteinG: 28,
    fatG: 28,
    fiberG: 4,
    calories: 625,
    smartHack:
      'High glycemic load combined with saturated fat. Skipping sugary ketchup and drinking water will reduce the glycemic excursion by ~20 mg/dL.',
  },
  {
    id: 'roti_thali',
    name: 'Whole Wheat Roti, Moong Dal & Sabzi',
    imageEmoji: '🫓',
    detectedFoods: ['2 Whole Wheat Rotis (70g)', 'Yellow Moong Dal (1 cup)', 'Spiced Cauliflower & Spinach'],
    carbsG: 48,
    proteinG: 18,
    fatG: 9,
    fiberG: 10,
    calories: 345,
    smartHack:
      'High dietary fiber thali! Eating the spiced sabzi and dal 5 minutes before the rotis flattens the glycemic slope noticeably.',
  },
  {
    id: 'avocado_toast',
    name: 'Avocado Toast with Poached Eggs',
    imageEmoji: '🥑',
    detectedFoods: ['Artisanal Multigrain Sourdough', 'Fresh Crushed Avocado', '2 Poached Eggs', 'Chili Flakes'],
    carbsG: 26,
    proteinG: 18,
    fatG: 20,
    fiberG: 7,
    calories: 355,
    smartHack:
      'Ideal metabolic breakfast! Sourdough fermentation lowers the glycemic index, while egg protein triggers rapid GLP-1 satiety signaling.',
  },
  {
    id: 'chicken_rice',
    name: 'Grilled Chicken & Brown Rice Bowl',
    imageEmoji: '🍗',
    detectedFoods: ['Grilled Chicken Breast (150g)', 'Steamed Brown Rice (1 cup)', 'Broccoli Florets', 'Sesame Tamari'],
    carbsG: 38,
    proteinG: 42,
    fatG: 8,
    fiberG: 6,
    calories: 390,
    smartHack:
      'Lean protein power plate. The high protein-to-carb ratio (1:1) prevents post-meal sluggishness and promotes steady metabolic clearance.',
  },
];

interface SnapToLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: number;
}

export const SnapToLogModal: React.FC<SnapToLogModalProps> = ({
  isOpen,
  onClose,
  patientId,
}) => {
  // Meal identification & editable macros state
  const [mealName, setMealName] = useState<string>(PRESET_MEALS[0].name);
  const [carbsG, setCarbsG] = useState<number>(PRESET_MEALS[0].carbsG);
  const [proteinG, setProteinG] = useState<number>(PRESET_MEALS[0].proteinG);
  const [fatG, setFatG] = useState<number>(PRESET_MEALS[0].fatG);
  const [fiberG, setFiberG] = useState<number>(PRESET_MEALS[0].fiberG);
  const [portionMultiplier, setPortionMultiplier] = useState<number>(1.0);
  const [detectedFoods, setDetectedFoods] = useState<string[]>(PRESET_MEALS[0].detectedFoods);
  const [imageEmoji, setImageEmoji] = useState<string>(PRESET_MEALS[0].imageEmoji);

  // Search & input filter
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Scanning / upload status
  const [isScanning, setIsScanning] = useState(false);
  const [uploadedImagePreview, setUploadedImagePreview] = useState<string | null>(null);

  const logMealMutation = useLogMeal();

  // Effective scaled values based on portion multiplier
  const effectiveCarbs = Math.max(0, Math.round(carbsG * portionMultiplier));
  const effectiveProtein = Math.max(0, Math.round(proteinG * portionMultiplier));
  const effectiveFat = Math.max(0, Math.round(fatG * portionMultiplier));
  const effectiveFiber = Math.max(0, Math.round(fiberG * portionMultiplier));
  const effectiveCalories = Math.round(
    effectiveCarbs * 4 + effectiveProtein * 4 + effectiveFat * 9
  );

  // Dynamic Digital Twin Glucose Prediction
  const projectedRise = Math.max(
    10,
    Math.round(effectiveCarbs * 0.72 - effectiveFiber * 0.45 + (effectiveFat > 20 ? 5 : 0))
  );
  const peakMinutes = Math.min(
    120,
    Math.max(45, Math.round(50 + (effectiveFat > 20 ? 25 : 0) + (effectiveFiber > 7 ? 15 : 0)))
  );
  const glycemicIndex: 'Low' | 'Medium' | 'High' =
    projectedRise > 50 ? 'High' : projectedRise > 28 ? 'Medium' : 'Low';

  // Dynamic personalized smart hack
  const getDynamicSmartHack = () => {
    if (effectiveCarbs > 60) {
      return `High carbohydrate load (+${projectedRise} mg/dL peak). A gentle 15-minute walk starting 20 minutes after eating activates muscle GLUT4 receptors to blunt this spike by ~30%.`;
    }
    if (effectiveFiber >= 8) {
      return `Excellent dietary fiber (${effectiveFiber}g)! Soluble fiber slows gastric emptying and dampens postprandial glucose absorption slope naturally.`;
    }
    if (effectiveFat >= 25) {
      return `Elevated fat content (${effectiveFat}g). Watch for a dual-wave delayed peak around 90–120 minutes. Keep evening activity light and avoid bedtime snacking.`;
    }
    if (effectiveProtein >= 30) {
      return `Strong protein foundation (${effectiveProtein}g). Consuming protein and vegetables 5 minutes before starchy carbohydrates flattens post-meal spikes effectively.`;
    }
    return `Balanced meal composition (+${projectedRise} mg/dL). Drinking 250ml water before eating will support smooth metabolic clearance.`;
  };

  const handleSelectPreset = (preset: MealPreset) => {
    setUploadedImagePreview(null);
    setMealName(preset.name);
    setCarbsG(preset.carbsG);
    setProteinG(preset.proteinG);
    setFatG(preset.fatG);
    setFiberG(preset.fiberG);
    setDetectedFoods(preset.detectedFoods);
    setImageEmoji(preset.imageEmoji);
    setPortionMultiplier(1.0);
  };

  const matchLocalFoodByName = (name: string) => {
    const q = name.toLowerCase();
    const matched = PRESET_MEALS.find((p) =>
      p.name.toLowerCase().includes(q) ||
      p.detectedFoods.some((f) => f.toLowerCase().includes(q))
    );
    if (matched) {
      handleSelectPreset(matched);
      return;
    }

    // Heuristic fallback based on common food words
    if (q.includes('pizza')) {
      handleSelectPreset(PRESET_MEALS[2]);
    } else if (q.includes('biryani') || q.includes('rice') || q.includes('pulao')) {
      handleSelectPreset(PRESET_MEALS[0]);
    } else if (q.includes('salad') || q.includes('salmon') || q.includes('fish')) {
      handleSelectPreset(PRESET_MEALS[1]);
    } else if (q.includes('oat') || q.includes('cereal') || q.includes('berry')) {
      handleSelectPreset(PRESET_MEALS[3]);
    } else if (q.includes('burger') || q.includes('fry') || q.includes('fries')) {
      handleSelectPreset(PRESET_MEALS[4]);
    } else if (q.includes('roti') || q.includes('dal') || q.includes('paneer')) {
      handleSelectPreset(PRESET_MEALS[5]);
    } else if (q.includes('egg') || q.includes('toast') || q.includes('avocado')) {
      handleSelectPreset(PRESET_MEALS[6]);
    } else if (q.includes('chicken')) {
      handleSelectPreset(PRESET_MEALS[7]);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show instant image preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadedImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setIsScanning(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (mealName.trim()) {
        formData.append('hint', mealName.trim());
      }

      // Call backend photo estimation endpoint
      const res = await apiRequest<any>('/foods/meals/estimate-from-photo', {
        method: 'POST',
        body: formData,
      });

      if (res?.estimated_macros) {
        const cleanName =
          file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ') || 'Plate Analysis';
        setMealName(cleanName);
        setCarbsG(Number(res.estimated_macros.carbs_g ?? res.estimated_macros.carbs ?? 40));
        setProteinG(Number(res.estimated_macros.protein_g ?? res.estimated_macros.protein ?? 25));
        setFatG(Number(res.estimated_macros.fat_g ?? res.estimated_macros.fat ?? 14));
        setFiberG(Number(res.estimated_macros.fibre_g ?? res.estimated_macros.fiber ?? 5));
        setPortionMultiplier(1.0);
        setImageEmoji('🍽️');

        if (res.food_items && res.food_items.length > 0) {
          setDetectedFoods(res.food_items.map((it: any) => `${it.name} (${it.portion})`));
        }
      }
    } catch (err) {
      console.warn('Backend photo estimation fallback to local classifier', err);
      matchLocalFoodByName(file.name);
    } finally {
      setIsScanning(false);
    }
  };

  const handleConfirmLog = () => {
    logMealMutation.mutate(
      {
        patientId,
        mealType: 'lunch',
        carbsG: effectiveCarbs,
        proteinG: effectiveProtein,
        fatG: effectiveFat,
        name: mealName,
      },
      {
        onSuccess: () => {
          showToast({
            type: 'success',
            title: 'Meal Logged & Twin Updated',
            message: `"${mealName}" (${effectiveCarbs}g carbs) logged to today's metabolic diary.`,
          });
          onClose();
        },
      }
    );
  };

  // SVG Glucose Excursion Curve points
  const baselineY = 70;
  const peakY = Math.max(15, baselineY - (projectedRise * 0.75));
  const peakX = 40 + (peakMinutes * 0.9);
  const pathD = `M 20 ${baselineY} C 40 ${baselineY}, ${peakX - 25} ${peakY}, ${peakX} ${peakY} S 150 ${baselineY - 10}, 200 ${baselineY}`;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 280 }}
            className="fixed inset-3 sm:inset-y-6 sm:inset-x-8 md:inset-x-20 lg:inset-x-44 z-50 bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-zinc-100"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-850 bg-zinc-900/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      Snap-to-Log AI Meal Scanner
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                      Interactive Calibration
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Snap a plate or select a dish. Fine-tune your macros below for 100% accurate glycemic prediction.
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Top Row: Camera Upload + Preset Quick Selector */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Photo Upload Card */}
                <div className="relative border-2 border-dashed border-zinc-800 hover:border-zinc-700 rounded-2xl p-5 flex flex-col items-center justify-center text-center bg-zinc-900/30 transition-colors group">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    title="Upload or take photo"
                  />
                  {uploadedImagePreview ? (
                    <div className="space-y-2">
                      <img
                        src={uploadedImagePreview}
                        alt="Uploaded meal"
                        className="w-24 h-24 object-cover rounded-xl mx-auto border border-zinc-700 shadow-md"
                      />
                      <span className="text-[11px] text-emerald-400 font-semibold block">
                        Photo Analyzed &bull; Tap to change
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="w-11 h-11 rounded-2xl bg-zinc-850 border border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-white group-hover:border-zinc-700 transition-colors mb-2">
                        <UploadCloud className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-white block">Take or Upload Food Photo</span>
                      <span className="text-[10px] text-zinc-500 mt-1 block">
                        Tap camera snap or upload photo file
                      </span>
                    </>
                  )}
                </div>

                {/* Quick Presets Grid (2 Cols) */}
                <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PRESET_MEALS.map((preset) => {
                    const isSelected = mealName === preset.name && !uploadedImagePreview;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => handleSelectPreset(preset)}
                        className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-zinc-800/90 border-white text-white shadow-sm'
                            : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{preset.imageEmoji}</span>
                          <span className="text-xs font-bold truncate block">{preset.name}</span>
                        </div>
                        <span className="text-[10px] text-zinc-400 font-mono mt-1">
                          {preset.carbsG}g C &bull; {preset.calories} kcal
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Scanning State Loader */}
              {isScanning ? (
                <div className="p-8 rounded-2xl bg-zinc-900/40 border border-zinc-800 text-center space-y-3">
                  <Activity className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
                  <p className="text-xs font-semibold text-white">
                    AI Visual Analysis Scanning Plate Macronutrients...
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Estimating portion depth, carbohydrate density, and digestive absorption rate.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Meal Name & Portion Scaling Bar */}
                  <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Meal Name Input */}
                    <div className="flex-1">
                      <label className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">
                        Meal Description / Plate Name
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={mealName}
                          onChange={(e) => {
                            setMealName(e.target.value);
                            matchLocalFoodByName(e.target.value);
                          }}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-semibold text-white focus:outline-none focus:border-zinc-500 transition-colors"
                          placeholder="e.g. 2 slices pizza, chicken salad, rice and dal..."
                        />
                        <Edit3 className="w-3.5 h-3.5 text-zinc-500 absolute right-3 top-2.5 pointer-events-none" />
                      </div>
                    </div>

                    {/* Portion Size Multiplier Toggles */}
                    <div>
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">
                        Plate Portion Scale
                      </span>
                      <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                        {[
                          { label: '0.5x Half', val: 0.5 },
                          { label: '0.75x Light', val: 0.75 },
                          { label: '1.0x Std', val: 1.0 },
                          { label: '1.5x Large', val: 1.5 },
                          { label: '2.0x Double', val: 2.0 },
                        ].map((p) => (
                          <button
                            key={p.val}
                            onClick={() => setPortionMultiplier(p.val)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                              portionMultiplier === p.val
                                ? 'bg-white text-black shadow-sm'
                                : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 4 Interactive Editable Macro Stepper Cards */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Calibrated Macronutrients (Fine-tune with +/- or type directly)</span>
                      </span>
                      <span className="text-[11px] font-mono text-zinc-400">
                        Total Energy: <strong className="text-white">{effectiveCalories} kcal</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {/* 1. Carbohydrates */}
                      <div className="p-3.5 rounded-2xl bg-zinc-900/70 border border-amber-500/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-amber-400">
                            Carbohydrates
                          </span>
                          <span className="text-[9px] text-amber-300 font-mono">High Impact</span>
                        </div>

                        <div className="flex items-center justify-between gap-1">
                          <button
                            onClick={() => setCarbsG((prev) => Math.max(0, prev - 5))}
                            className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center cursor-pointer transition-colors"
                            title="Decrease carbs by 5g"
                          >
                            <Minus className="w-3 h-3" />
                          </button>

                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max="300"
                              value={effectiveCarbs}
                              onChange={(e) =>
                                setCarbsG(
                                  Math.max(0, Math.round(Number(e.target.value) / portionMultiplier))
                                )
                              }
                              className="w-14 text-center font-mono font-bold text-lg text-amber-400 bg-transparent focus:outline-none"
                            />
                            <span className="text-xs text-zinc-500">g</span>
                          </div>

                          <button
                            onClick={() => setCarbsG((prev) => prev + 5)}
                            className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center cursor-pointer transition-colors"
                            title="Increase carbs by 5g"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* 2. Protein */}
                      <div className="p-3.5 rounded-2xl bg-zinc-900/70 border border-indigo-500/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-indigo-400">
                            Lean Protein
                          </span>
                          <span className="text-[9px] text-indigo-300 font-mono">Satiety</span>
                        </div>

                        <div className="flex items-center justify-between gap-1">
                          <button
                            onClick={() => setProteinG((prev) => Math.max(0, prev - 5))}
                            className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center cursor-pointer transition-colors"
                            title="Decrease protein by 5g"
                          >
                            <Minus className="w-3 h-3" />
                          </button>

                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max="300"
                              value={effectiveProtein}
                              onChange={(e) =>
                                setProteinG(
                                  Math.max(0, Math.round(Number(e.target.value) / portionMultiplier))
                                )
                              }
                              className="w-14 text-center font-mono font-bold text-lg text-indigo-400 bg-transparent focus:outline-none"
                            />
                            <span className="text-xs text-zinc-500">g</span>
                          </div>

                          <button
                            onClick={() => setProteinG((prev) => prev + 5)}
                            className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center cursor-pointer transition-colors"
                            title="Increase protein by 5g"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* 3. Healthy Fat */}
                      <div className="p-3.5 rounded-2xl bg-zinc-900/70 border border-zinc-700 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-zinc-300">
                            Healthy Fat
                          </span>
                          <span className="text-[9px] text-zinc-400 font-mono">Absorption</span>
                        </div>

                        <div className="flex items-center justify-between gap-1">
                          <button
                            onClick={() => setFatG((prev) => Math.max(0, prev - 2))}
                            className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center cursor-pointer transition-colors"
                            title="Decrease fat by 2g"
                          >
                            <Minus className="w-3 h-3" />
                          </button>

                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max="200"
                              value={effectiveFat}
                              onChange={(e) =>
                                setFatG(
                                  Math.max(0, Math.round(Number(e.target.value) / portionMultiplier))
                                )
                              }
                              className="w-14 text-center font-mono font-bold text-lg text-zinc-200 bg-transparent focus:outline-none"
                            />
                            <span className="text-xs text-zinc-500">g</span>
                          </div>

                          <button
                            onClick={() => setFatG((prev) => prev + 2)}
                            className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center cursor-pointer transition-colors"
                            title="Increase fat by 2g"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* 4. Dietary Fiber */}
                      <div className="p-3.5 rounded-2xl bg-zinc-900/70 border border-emerald-500/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-emerald-400">
                            Dietary Fiber
                          </span>
                          <span className="text-[9px] text-emerald-300 font-mono">Blunts Rise</span>
                        </div>

                        <div className="flex items-center justify-between gap-1">
                          <button
                            onClick={() => setFiberG((prev) => Math.max(0, prev - 1))}
                            className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center cursor-pointer transition-colors"
                            title="Decrease fiber by 1g"
                          >
                            <Minus className="w-3 h-3" />
                          </button>

                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max="50"
                              value={effectiveFiber}
                              onChange={(e) =>
                                setFiberG(
                                  Math.max(0, Math.round(Number(e.target.value) / portionMultiplier))
                                )
                              }
                              className="w-14 text-center font-mono font-bold text-lg text-emerald-400 bg-transparent focus:outline-none"
                            />
                            <span className="text-xs text-zinc-500">g</span>
                          </div>

                          <button
                            onClick={() => setFiberG((prev) => prev + 1)}
                            className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center cursor-pointer transition-colors"
                            title="Increase fiber by 1g"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Twin Projected Glycemic Curve with Live SVG Visualizer */}
                  <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
                          Digital Twin Predicted Postprandial Curve
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <TrendingUp className="w-4 h-4 text-amber-400" />
                          <span className="text-base font-bold text-white font-mono">
                            +{projectedRise} mg/dL peak rise
                          </span>
                          <span className="text-xs text-zinc-500">
                            (expected at ~{peakMinutes} mins)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                            glycemicIndex === 'High'
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : glycemicIndex === 'Medium'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {glycemicIndex} Glycemic Index
                        </span>
                      </div>
                    </div>

                    {/* Live SVG Excursion Curve */}
                    <div className="h-24 w-full bg-zinc-950/80 rounded-xl p-2 relative flex flex-col justify-end overflow-hidden border border-zinc-800/60">
                      <svg className="w-full h-full overflow-visible" viewBox="0 0 220 80">
                        {/* Target guideline threshold line at 140 mg/dL */}
                        <line
                          x1="10"
                          y1="40"
                          x2="210"
                          y2="40"
                          stroke="#10b981"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                          opacity="0.4"
                        />
                        <text x="12" y="36" fill="#10b981" fontSize="7" opacity="0.6">
                          140 mg/dL target line
                        </text>

                        {/* Baseline reference */}
                        <line
                          x1="10"
                          y1="70"
                          x2="210"
                          y2="70"
                          stroke="#52525b"
                          strokeWidth="1"
                          opacity="0.3"
                        />
                        <text x="12" y="68" fill="#71717a" fontSize="7" opacity="0.6">
                          Fasting baseline (100)
                        </text>

                        {/* Dynamic projected trajectory curve */}
                        <path
                          d={pathD}
                          fill="none"
                          stroke={glycemicIndex === 'High' ? '#f43f5e' : glycemicIndex === 'Medium' ? '#f59e0b' : '#10b981'}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />

                        {/* Peak marker point */}
                        <circle
                          cx={peakX}
                          cy={peakY}
                          r="4"
                          fill={glycemicIndex === 'High' ? '#f43f5e' : glycemicIndex === 'Medium' ? '#f59e0b' : '#10b981'}
                        />
                      </svg>
                    </div>

                    {/* Detected Foods Tag Line */}
                    {detectedFoods.length > 0 && (
                      <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 flex-wrap pt-1">
                        <span className="text-zinc-500 font-medium">Plate items:</span>
                        {detectedFoods.map((f, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md bg-zinc-850 text-zinc-300 border border-zinc-800 text-[10px]"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Smart Pre-Meal Eating Hack Banner */}
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
                    <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <span className="font-bold text-amber-300 block mb-0.5">
                        Twin Metabolic Optimization Hack:
                      </span>
                      <span className="text-zinc-300 leading-relaxed">
                        {getDynamicSmartHack()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-zinc-850 bg-zinc-900/70 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={handleConfirmLog}
                  disabled={logMealMutation.isPending || isScanning}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white text-black font-bold text-xs flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {logMealMutation.isPending ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" />
                  ) : (
                    <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
                  )}
                  <span>
                    Log Meal ({effectiveCarbs}g Carbs &bull; {effectiveCalories} kcal)
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
