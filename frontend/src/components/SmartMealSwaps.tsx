import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  ArrowUpDown,
  Award,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  HelpCircle,
  Lightbulb,
  MessageSquare,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Utensils,
  X,
  Zap,
} from 'lucide-react';
import { showToast } from '../api/client';

export interface MealSwapPair {
  id: string;
  category: string;
  cuisine: 'All' | 'South Indian' | 'North Indian' | 'Street Food & Snacks' | 'Western & Italian';
  original: {
    name: string;
    emoji: string;
    carbsG: number;
    proteinG: number;
    fatG: number;
    fiberG: number;
    calories: number;
    projectedPeak: number;
    peakRise: number;
    glycemicIndex: 'High' | 'Medium';
    description: string;
  };
  swap: {
    name: string;
    emoji: string;
    carbsG: number;
    proteinG: number;
    fatG: number;
    fiberG: number;
    calories: number;
    projectedPeak: number;
    peakRise: number;
    glycemicIndex: 'Low';
    description: string;
    whyItWorks: string;
  };
}

export const MEAL_SWAP_PRESETS: MealSwapPair[] = [
  // =========================================================================
  // --- 1. SOUTH INDIAN SWAPS (10 Presets) ---
  // =========================================================================
  {
    id: 'idli_pesarattu',
    category: 'Breakfast Tiffin',
    cuisine: 'South Indian',
    original: {
      name: '3 White Rice Idlis with Sweet Coconut Chutney',
      emoji: '⚪',
      carbsG: 58,
      proteinG: 8,
      fatG: 8,
      fiberG: 2,
      calories: 340,
      projectedPeak: 188,
      peakRise: 64,
      glycemicIndex: 'High',
      description: 'Polished white rice starch causing fast enzymatic breakdown and sharp morning spike.',
    },
    swap: {
      name: 'Sprouted Moong Pesarattu with Ginger-Tomato Pachadi',
      emoji: '🥞',
      carbsG: 26,
      proteinG: 16,
      fatG: 5,
      fiberG: 7,
      calories: 215,
      projectedPeak: 126,
      peakRise: 16,
      glycemicIndex: 'Low',
      description: 'Whole green gram legume batter packed with resistant starch and plant protein.',
      whyItWorks: 'Whole mung legume provides 3x bioavailable protein and soluble fiber, slowing glucose absorption velocity by 75%.',
    },
  },
  {
    id: 'dosa_adai',
    category: 'Breakfast / Dinner',
    cuisine: 'South Indian',
    original: {
      name: 'Butter Masala Dosa with Spiced Potato Mash',
      emoji: '🫓',
      carbsG: 62,
      proteinG: 7,
      fatG: 16,
      fiberG: 3,
      calories: 420,
      projectedPeak: 196,
      peakRise: 72,
      glycemicIndex: 'High',
      description: 'Fermented white rice crepe with starchy potato filling and ghee.',
    },
    swap: {
      name: 'Multigrain Adai (4-Lentil Dosa) with Vegetable Avial',
      emoji: '🥙',
      carbsG: 32,
      proteinG: 15,
      fatG: 8,
      fiberG: 8,
      calories: 260,
      projectedPeak: 132,
      peakRise: 22,
      glycemicIndex: 'Low',
      description: 'Toor, chana, urad, and moong lentils served with coconut vegetable stew.',
      whyItWorks: 'Combining 4 unrefined pulses with vegetable avial delays gastric emptying and holds glucose safely under 140 mg/dL.',
    },
  },
  {
    id: 'upma_daliya',
    category: 'Breakfast Tiffin',
    cuisine: 'South Indian',
    original: {
      name: 'White Sooji (Semolina) Upma with Sweetened Chai',
      emoji: '🥣',
      carbsG: 56,
      proteinG: 6,
      fatG: 9,
      fiberG: 2,
      calories: 330,
      projectedPeak: 184,
      peakRise: 60,
      glycemicIndex: 'High',
      description: 'Refined durum semolina starch digests rapidly into glucose with added sucrose.',
    },
    swap: {
      name: 'Broken Wheat (Daliya) & Veggie Upma with Spiced Buttermilk',
      emoji: '🍲',
      carbsG: 30,
      proteinG: 9,
      fatG: 5,
      fiberG: 7,
      calories: 205,
      projectedPeak: 128,
      peakRise: 18,
      glycemicIndex: 'Low',
      description: 'Coarse cracked whole wheat grains loaded with carrots, peas, and chilled probiotic neer mor.',
      whyItWorks: 'Whole wheat bran intact fiber retards amylase action, while chilled buttermilk lowers meal glycemic index.',
    },
  },
  {
    id: 'rice_millet',
    category: 'Traditional Lunch',
    cuisine: 'South Indian',
    original: {
      name: '2 Cups White Ponni Rice with Sambar & Fried Appalam',
      emoji: '🍚',
      carbsG: 76,
      proteinG: 9,
      fatG: 11,
      fiberG: 2,
      calories: 440,
      projectedPeak: 204,
      peakRise: 80,
      glycemicIndex: 'High',
      description: 'Large glycemic load from polished rice leading to afternoon postprandial fatigue.',
    },
    swap: {
      name: 'Foxtail Millet (Thinai) Bowl with Keerai Kootu',
      emoji: '🥗',
      carbsG: 38,
      proteinG: 14,
      fatG: 7,
      fiberG: 9,
      calories: 270,
      projectedPeak: 134,
      peakRise: 22,
      glycemicIndex: 'Low',
      description: 'Ancient unpolished millet with spinach-moong dal stew and drumstick sambar.',
      whyItWorks: 'Foxtail millet has an amylose-to-amylopectin ratio that digests 55% slower, while spinach magnesium boosts insulin sensitivity.',
    },
  },
  {
    id: 'curd_rice_oats',
    category: 'Comfort Lunch',
    cuisine: 'South Indian',
    original: {
      name: 'White Rice Curd Rice with Fried Potato Chips',
      emoji: '🍛',
      carbsG: 64,
      proteinG: 7,
      fatG: 14,
      fiberG: 1.5,
      calories: 410,
      projectedPeak: 182,
      peakRise: 58,
      glycemicIndex: 'High',
      description: 'Starchy rice base combined with deep-fried salted potato crisps.',
    },
    swap: {
      name: 'Steel-Cut Oats Curd "Rice" with Pomegranate & Mustard Tadka',
      emoji: '🥣',
      carbsG: 32,
      proteinG: 11,
      fatG: 7,
      fiberG: 6,
      calories: 235,
      projectedPeak: 124,
      peakRise: 14,
      glycemicIndex: 'Low',
      description: 'Thick oat groats soaked in probiotic yogurt with curry leaves and antioxidant pomegranate.',
      whyItWorks: 'Oat beta-glucan forms a viscous gel in the digestive tract, cutting portal sugar influx while active probiotics optimize the gut barrier.',
    },
  },
  {
    id: 'vada_paniyaram',
    category: 'Evening Tiffin',
    cuisine: 'South Indian',
    original: {
      name: 'Deep-Fried Medu Vadas (2 pcs) with Coconut Dip',
      emoji: '🍩',
      carbsG: 42,
      proteinG: 7,
      fatG: 22,
      fiberG: 3,
      calories: 395,
      projectedPeak: 178,
      peakRise: 54,
      glycemicIndex: 'High',
      description: 'High oil absorption from deep-frying paired with white urad starch.',
    },
    swap: {
      name: 'Steamed Kuzhi Paniyaram with Mint-Coriander Chutney',
      emoji: '🥟',
      carbsG: 24,
      proteinG: 8,
      fatG: 5,
      fiberG: 5,
      calories: 175,
      projectedPeak: 122,
      peakRise: 14,
      glycemicIndex: 'Low',
      description: 'Savory lentil-millet dumplings cooked in a cast iron appe pan with fresh herbs.',
      whyItWorks: 'Cuts saturated oil by 78% while mint and coriander bioflavonoids stimulate GLUT4 glucose uptake in muscle cells.',
    },
  },
  {
    id: 'pongal_khara',
    category: 'Breakfast Tiffin',
    cuisine: 'South Indian',
    original: {
      name: 'White Rice Ven Pongal with Heavy Ghee & Cashews',
      emoji: '🍲',
      carbsG: 68,
      proteinG: 9,
      fatG: 19,
      fiberG: 2,
      calories: 480,
      projectedPeak: 195,
      peakRise: 70,
      glycemicIndex: 'High',
      description: 'Polished white rice cooked to high gelatinization soaked in saturated ghee.',
    },
    swap: {
      name: 'Foxtail Millet & Yellow Moong Khara Pongal with Black Pepper',
      emoji: '🥣',
      carbsG: 34,
      proteinG: 15,
      fatG: 8,
      fiberG: 8,
      calories: 270,
      projectedPeak: 130,
      peakRise: 20,
      glycemicIndex: 'Low',
      description: 'Equal ratio of unpolished foxtail millet and split yellow moong with whole black pepper.',
      whyItWorks: 'Piperine in black pepper enhances bioabsorption while the 1:1 millet-to-lentil ratio maintains an optimal 0.44 protein-to-carb balance.',
    },
  },
  {
    id: 'sevai_edamame',
    category: 'Dinner Tiffin',
    cuisine: 'South Indian',
    original: {
      name: 'Lemon Sevai (White Rice Vermicelli Noodles)',
      emoji: '🍜',
      carbsG: 72,
      proteinG: 5,
      fatG: 11,
      fiberG: 1.5,
      calories: 405,
      projectedPeak: 200,
      peakRise: 76,
      glycemicIndex: 'High',
      description: 'Ultra-thin white rice noodles with near-instant starch hydrolyzation.',
    },
    swap: {
      name: 'Cauliflower & Edamame Lemon "Sevai" with Roasted Peanuts',
      emoji: '🥗',
      carbsG: 18,
      proteinG: 16,
      fatG: 10,
      fiberG: 7,
      calories: 225,
      projectedPeak: 122,
      peakRise: 12,
      glycemicIndex: 'Low',
      description: 'Shredded riced cauliflower lightly tossed with young edamame, mustard seeds, and fresh lime juice.',
      whyItWorks: 'Slashes digestible starch by 75% while citric acid from lemon juice downregulates salivary amylase activity.',
    },
  },
  {
    id: 'parotta_soya',
    category: 'Dinner Breads',
    cuisine: 'South Indian',
    original: {
      name: '2 Maida Malabar Parottas with Oily Chicken Salna',
      emoji: '🫓',
      carbsG: 86,
      proteinG: 14,
      fatG: 32,
      fiberG: 2,
      calories: 690,
      projectedPeak: 220,
      peakRise: 92,
      glycemicIndex: 'High',
      description: 'Refined bleached flour kneaded with oil and fried on flat top with greasy salna.',
    },
    swap: {
      name: 'Multi-Grain Phulka with High-Protein Soya Chunk Kurma',
      emoji: '🥙',
      carbsG: 38,
      proteinG: 26,
      fatG: 9,
      fiberG: 9,
      calories: 340,
      projectedPeak: 136,
      peakRise: 24,
      glycemicIndex: 'Low',
      description: 'Hand-tossed whole grain flatbreads with textured vegetable protein simmered in a coconut-fennel gravy.',
      whyItWorks: 'Soya isoflavones and high soy protein content attenuate glycemic excursions, preventing both acute and delayed 4-hour insulin resistance.',
    },
  },
  {
    id: 'filter_kaapi_almond',
    category: 'Beverage & Tiffin',
    cuisine: 'South Indian',
    original: {
      name: 'Traditional Filter Kaapi with White Sugar & Full Milk',
      emoji: '☕',
      carbsG: 28,
      proteinG: 4,
      fatG: 6,
      fiberG: 0,
      calories: 180,
      projectedPeak: 168,
      peakRise: 52,
      glycemicIndex: 'High',
      description: 'High liquid sucrose added to concentrated decoction and whole milk drunk on an empty stomach.',
    },
    swap: {
      name: 'Single-Shot Filter Kaapi with Almond Milk & Ceylon Cinnamon',
      emoji: '☕',
      carbsG: 4,
      proteinG: 2,
      fatG: 3,
      fiberG: 1.5,
      calories: 50,
      projectedPeak: 112,
      peakRise: 6,
      glycemicIndex: 'Low',
      description: 'Authentic chicory-coffee decoction blended with warm unsweetened almond milk and pinch of true cinnamon.',
      whyItWorks: 'Eliminates 24g of free sugar while cinnamaldehyde in Ceylon cinnamon mimics insulin and improves cellular glucose clearance.',
    },
  },

  // =========================================================================
  // --- 2. NORTH INDIAN SWAPS (8 Presets) ---
  // =========================================================================
  {
    id: 'naan_phulka',
    category: 'Dinner Breads',
    cuisine: 'North Indian',
    original: {
      name: '2 Large Butter Naans with Paneer Makhani',
      emoji: '🫓',
      carbsG: 84,
      proteinG: 18,
      fatG: 32,
      fiberG: 3,
      calories: 690,
      projectedPeak: 215,
      peakRise: 86,
      glycemicIndex: 'High',
      description: 'Refined maida flour baked in tandoor drenched in butter and cashew gravy.',
    },
    swap: {
      name: '2 Whole Wheat Phulkas with Palak Paneer & Cucumber Preload',
      emoji: '🫓',
      carbsG: 36,
      proteinG: 20,
      fatG: 14,
      fiberG: 8,
      calories: 350,
      projectedPeak: 134,
      peakRise: 24,
      glycemicIndex: 'Low',
      description: 'Oil-free whole wheat phulkas with iron-rich spinach paneer and crunchy raw salad.',
      whyItWorks: 'Raw cucumber preload eaten 10 minutes prior activates the "second-meal effect", curbing peak excursion by 72%.',
    },
  },
  {
    id: 'biryani_tikka',
    category: 'Rice & Biryani',
    cuisine: 'North Indian',
    original: {
      name: 'Mutton Dum Biryani with Mirchi Ka Salan',
      emoji: '🥘',
      carbsG: 82,
      proteinG: 28,
      fatG: 34,
      fiberG: 3,
      calories: 740,
      projectedPeak: 212,
      peakRise: 84,
      glycemicIndex: 'High',
      description: 'High-glycemic polished basmati rice with heavy saturated oil and peanut-sesame gravy.',
    },
    swap: {
      name: 'Brown Basmati Chicken Tikka Bowl with Mint Raita',
      emoji: '🍛',
      carbsG: 42,
      proteinG: 38,
      fatG: 12,
      fiberG: 6,
      calories: 430,
      projectedPeak: 138,
      peakRise: 26,
      glycemicIndex: 'Low',
      description: 'Char-grilled lean chicken breast with unpolished brown basmati and cool cucumber yogurt.',
      whyItWorks: 'High lean protein triggers GLP-1 hormone release without the saturated fat barrier that impairs cellular insulin sensitivity.',
    },
  },
  {
    id: 'pav_bhaji_swap',
    category: 'Street Food',
    cuisine: 'North Indian',
    original: {
      name: 'Pav Bhaji with 2 Buttered White Bread Buns',
      emoji: '🍞',
      carbsG: 78,
      proteinG: 10,
      fatG: 26,
      fiberG: 3,
      calories: 580,
      projectedPeak: 216,
      peakRise: 88,
      glycemicIndex: 'High',
      description: 'Refined white maida bread with butter-soaked mashed potato and tomato gravy.',
    },
    swap: {
      name: 'Whole Wheat Sourdough with Moong Dal & Cauliflower Bhaji',
      emoji: '🥪',
      carbsG: 36,
      proteinG: 16,
      fatG: 10,
      fiberG: 8,
      calories: 300,
      projectedPeak: 132,
      peakRise: 22,
      glycemicIndex: 'Low',
      description: 'Slow-fermented artisan sourdough with mashed yellow lentils and cauliflower florets.',
      whyItWorks: 'Eliminates potato starch; sourdough fermentation produces organic acids that slow carbohydrate digestion in the stomach.',
    },
  },
  {
    id: 'jamun_sandesh',
    category: 'Desserts & Sweets',
    cuisine: 'North Indian',
    original: {
      name: '2 Warm Gulab Jamuns in Heavy Sugar Syrup',
      emoji: '🍮',
      carbsG: 56,
      proteinG: 5,
      fatG: 16,
      fiberG: 0.5,
      calories: 385,
      projectedPeak: 228,
      peakRise: 98,
      glycemicIndex: 'High',
      description: 'Fried milk solids saturated in liquid sucrose syrup causing massive insulin surge.',
    },
    swap: {
      name: 'Steamed Cardamom Chenna Sandesh with Pistachios',
      emoji: '🧁',
      carbsG: 8,
      proteinG: 9,
      fatG: 6,
      fiberG: 2,
      calories: 125,
      projectedPeak: 112,
      peakRise: 8,
      glycemicIndex: 'Low',
      description: 'Fresh cow milk cottage cheese lightly spiced with green cardamom and natural stevia.',
      whyItWorks: 'Replaces free liquid sucrose with slow-digesting milk casein protein, keeping post-dessert glucose virtually unchanged.',
    },
  },
  {
    id: 'aloo_paratha_paneer',
    category: 'Breakfast Breads',
    cuisine: 'North Indian',
    original: {
      name: '2 Stuffed Aloo Parathas with White Salted Butter',
      emoji: '🫓',
      carbsG: 74,
      proteinG: 8,
      fatG: 22,
      fiberG: 4,
      calories: 530,
      projectedPeak: 202,
      peakRise: 78,
      glycemicIndex: 'High',
      description: 'Starchy mashed potato filling encapsulated in pan-fried wheat dough with extra butter.',
    },
    swap: {
      name: 'Spiced Paneer & Gobhi (Cauliflower) Paratha with Flaxseed Curd',
      emoji: '🥙',
      carbsG: 28,
      proteinG: 18,
      fatG: 12,
      fiberG: 7,
      calories: 295,
      projectedPeak: 130,
      peakRise: 18,
      glycemicIndex: 'Low',
      description: 'Grated low-fat paneer and spiced grated cauliflower stuffed in whole wheat with omega-3 curd.',
      whyItWorks: 'Substitutes high-GI tuber starch with high-protein paneer and cruciferous fiber, reducing glycemic impact by 77%.',
    },
  },
  {
    id: 'chole_bhature_kulcha',
    category: 'Lunch Special',
    cuisine: 'North Indian',
    original: {
      name: 'Chole Bhature (2 Deep-Fried Maida Balloon Puffs)',
      emoji: '🥟',
      carbsG: 94,
      proteinG: 16,
      fatG: 38,
      fiberG: 6,
      calories: 780,
      projectedPeak: 224,
      peakRise: 94,
      glycemicIndex: 'High',
      description: 'Deep-fried leavened maida breads absorbing up to 40ml of vegetable cooking oil.',
    },
    swap: {
      name: 'Tandoori Whole Wheat Kulcha with Amritsari Kala Chana & Radish',
      emoji: '🫓',
      carbsG: 42,
      proteinG: 20,
      fatG: 8,
      fiberG: 11,
      calories: 320,
      projectedPeak: 135,
      peakRise: 22,
      glycemicIndex: 'Low',
      description: 'Clay-oven baked whole wheat bread with low-GI black chickpeas and vinegar-pickled radish.',
      whyItWorks: 'Black chickpeas (kala chana) have an ultra-low GI of 28; baking in tandoor removes 30g of absorbed fat.',
    },
  },
  {
    id: 'dal_makhani_tadka',
    category: 'Dinner Curries',
    cuisine: 'North Indian',
    original: {
      name: 'Restaurant Dal Makhani with Heavy Cream & White Butter',
      emoji: '🍲',
      carbsG: 48,
      proteinG: 14,
      fatG: 28,
      fiberG: 6,
      calories: 495,
      projectedPeak: 185,
      peakRise: 62,
      glycemicIndex: 'High',
      description: 'High saturated fat combined with black urad slows gastric emptying initially then causes prolonged 4-hour elevation.',
    },
    swap: {
      name: 'Slow-Simmered Yellow Moong Tadka Dal with Spinach & Jeera Ghee',
      emoji: '🥣',
      carbsG: 26,
      proteinG: 16,
      fatG: 7,
      fiberG: 8,
      calories: 230,
      projectedPeak: 126,
      peakRise: 14,
      glycemicIndex: 'Low',
      description: 'Easily digestible yellow mung lentils tempered with cumin, garlic, and fresh baby spinach.',
      whyItWorks: 'Yellow mung is the gentlest pulse on gut motility; cumin and garlic contain allicin which supports post-meal insulin sensitivity.',
    },
  },
  {
    id: 'kaju_katli_truffle',
    category: 'Desserts & Sweets',
    cuisine: 'North Indian',
    original: {
      name: '4 Slices Kaju Katli (Refined Sugar Cashew Diamond Fudge)',
      emoji: '🍬',
      carbsG: 46,
      proteinG: 6,
      fatG: 14,
      fiberG: 1,
      calories: 335,
      projectedPeak: 208,
      peakRise: 82,
      glycemicIndex: 'High',
      description: 'Fine cashew flour kneaded with pure sucrose syrup that dissolves directly into the bloodstream.',
    },
    swap: {
      name: 'Roasted Walnut & Date Truffle with Cardamom & Dark Cocoa',
      emoji: '🍫',
      carbsG: 14,
      proteinG: 5,
      fatG: 11,
      fiberG: 4,
      calories: 165,
      projectedPeak: 120,
      peakRise: 12,
      glycemicIndex: 'Low',
      description: 'Cold-pressed walnuts and Medjool date paste rolled in 85% polyphenol-rich cocoa powder.',
      whyItWorks: 'Walnut alpha-linolenic acid (ALA) and cocoa flavanols protect endothelial function and prevent glucose spikes.',
    },
  },

  // =========================================================================
  // --- 3. STREET FOOD & SNACKS (8 Presets) ---
  // =========================================================================
  {
    id: 'samosa_sundal',
    category: 'Evening Snacks',
    cuisine: 'Street Food & Snacks',
    original: {
      name: '2 Fried Potato Samosas with Sweet Tamarind Dip',
      emoji: '🥟',
      carbsG: 64,
      proteinG: 6,
      fatG: 24,
      fiberG: 2,
      calories: 495,
      projectedPeak: 210,
      peakRise: 84,
      glycemicIndex: 'High',
      description: 'Deep-fried maida shell filled with potato starch and dipped in high-fructose tamarind jaggery.',
    },
    swap: {
      name: 'Spiced Black Chickpea Sundal & Roasted Makhana (Foxnuts)',
      emoji: '🥜',
      carbsG: 26,
      proteinG: 11,
      fatG: 4,
      fiberG: 8,
      calories: 185,
      projectedPeak: 122,
      peakRise: 12,
      glycemicIndex: 'Low',
      description: 'Steamed kala chana tempered with mustard and curry leaves paired with crunchy roasted lotus seeds.',
      whyItWorks: 'High resistant starch and mineral-rich lotus seeds deliver crunch and satiety with less than one-third the carbohydrate load.',
    },
  },
  {
    id: 'boba_matcha',
    category: 'Beverage & Snack',
    cuisine: 'Street Food & Snacks',
    original: {
      name: 'Brown Sugar Tapioca Boba Milk Tea',
      emoji: '🧋',
      carbsG: 65,
      proteinG: 4,
      fatG: 12,
      fiberG: 0,
      calories: 390,
      projectedPeak: 215,
      peakRise: 85,
      glycemicIndex: 'High',
      description: 'Liquid sucrose and high-glycemic tapioca starch pearls.',
    },
    swap: {
      name: 'Iced Matcha Green Tea with Chia Seeds & Almond Milk',
      emoji: '🍵',
      carbsG: 12,
      proteinG: 6,
      fatG: 8,
      fiberG: 6,
      calories: 140,
      projectedPeak: 118,
      peakRise: 9,
      glycemicIndex: 'Low',
      description: 'Antioxidant-dense green tea with prebiotic omega-3 chia gel.',
      whyItWorks: 'Matcha EGCG polyphenols improve insulin sensitivity while chia seeds provide sustained hydration with near-zero spike.',
    },
  },
  {
    id: 'pani_puri_moong',
    category: 'Chaat & Street Food',
    cuisine: 'Street Food & Snacks',
    original: {
      name: '6 Fried Pani Puris with Potato Mash & Sweet Dates Chutney',
      emoji: '🥣',
      carbsG: 52,
      proteinG: 4,
      fatG: 14,
      fiberG: 2,
      calories: 350,
      projectedPeak: 198,
      peakRise: 74,
      glycemicIndex: 'High',
      description: 'Fried semolina shells filled with boiled potato and sugary dates-tamarind syrup.',
    },
    swap: {
      name: 'Sprouted Moong & Kala Chana Golgappe with Mint-Jeera Hing Pani',
      emoji: '🥗',
      carbsG: 22,
      proteinG: 9,
      fatG: 3,
      fiberG: 6,
      calories: 155,
      projectedPeak: 124,
      peakRise: 14,
      glycemicIndex: 'Low',
      description: 'Crisp whole wheat puris stuffed with sprouted green lentils and tangy unsweetened herbal digestive water.',
      whyItWorks: 'Replaces sweet syrup with prebiotic herbs (mint, roasted cumin, asafoetida) that promote digestive enzymes and avoid spikes.',
    },
  },
  {
    id: 'sev_puri_corn',
    category: 'Chaat & Street Food',
    cuisine: 'Street Food & Snacks',
    original: {
      name: 'Sev Puri / Papdi Chaat with Fried Flour Crisps & Sweet Curd',
      emoji: '🥙',
      carbsG: 62,
      proteinG: 6,
      fatG: 22,
      fiberG: 2.5,
      calories: 460,
      projectedPeak: 204,
      peakRise: 78,
      glycemicIndex: 'High',
      description: 'Deep-fried maida wafers smothered in sev and sugar-sweetened dahi.',
    },
    swap: {
      name: 'Steamed Sweet Corn & Black Chickpea Chaat with Pomegranate',
      emoji: '🥗',
      carbsG: 28,
      proteinG: 10,
      fatG: 4,
      fiberG: 8,
      calories: 190,
      projectedPeak: 126,
      peakRise: 16,
      glycemicIndex: 'Low',
      description: 'Tender steamed corn kernels and tender chickpeas tossed with chaat masala, lemon juice, and coriander.',
      whyItWorks: 'High insoluble fiber from whole pulses and corn pericarp slows intestinal sugar transit; zero refined deep-fried flour.',
    },
  },
  {
    id: 'vada_pav_paneer',
    category: 'Street Fast Food',
    cuisine: 'Street Food & Snacks',
    original: {
      name: 'Mumbai Vada Pav with Deep-Fried Potato Ball & Sweet Chutney',
      emoji: '🍔',
      carbsG: 58,
      proteinG: 7,
      fatG: 18,
      fiberG: 2,
      calories: 420,
      projectedPeak: 206,
      peakRise: 82,
      glycemicIndex: 'High',
      description: 'Batter-fried mashed potato enclosed in refined white flour bun with sugary garlic dip.',
    },
    swap: {
      name: 'Grilled Paneer Tikka Slider on Multigrain Bun with Mint Chutney',
      emoji: '🥪',
      carbsG: 24,
      proteinG: 17,
      fatG: 11,
      fiberG: 6,
      calories: 260,
      projectedPeak: 128,
      peakRise: 18,
      glycemicIndex: 'Low',
      description: 'Thick marinated cottage cheese steak grilled on skillet and served in whole grain bun with herbal dip.',
      whyItWorks: 'Exchanges high-GI potato for high-protein paneer, cutting net carbohydrate load by 60% and blunting spike excursion.',
    },
  },
  {
    id: 'fries_zucchini',
    category: 'Fast Food Sides',
    cuisine: 'Street Food & Snacks',
    original: {
      name: 'Deep-Fried Potato French Fries with Sweet Corn Syrup Ketchup',
      emoji: '🍟',
      carbsG: 66,
      proteinG: 4,
      fatG: 24,
      fiberG: 3,
      calories: 490,
      projectedPeak: 214,
      peakRise: 86,
      glycemicIndex: 'High',
      description: 'Ultra-fast gelatinized potato starch coated in oxidized trans fats and high-fructose corn syrup.',
    },
    swap: {
      name: 'Crispy Air-Fried Zucchini & Carrot Fries with Greek Yogurt Dip',
      emoji: '🥒',
      carbsG: 14,
      proteinG: 8,
      fatG: 5,
      fiberG: 5,
      calories: 135,
      projectedPeak: 116,
      peakRise: 8,
      glycemicIndex: 'Low',
      description: 'Parmesan-crusted vegetable batons air-fried to a crunch and dipped in garlic Greek yogurt.',
      whyItWorks: 'Vegetable batons deliver crunchy satisfaction with 78% fewer carbohydrates and zero oxidized fryer oil.',
    },
  },
  {
    id: 'lassi_chaas',
    category: 'Beverage & Tiffin',
    cuisine: 'Street Food & Snacks',
    original: {
      name: 'Sweet Mango Lassi with Full Cream Milk & Cane Sugar',
      emoji: '🥤',
      carbsG: 54,
      proteinG: 7,
      fatG: 11,
      fiberG: 0.5,
      calories: 340,
      projectedPeak: 210,
      peakRise: 82,
      glycemicIndex: 'High',
      description: 'Dense fruit puree with concentrated sucrose causing an immediate steep insulin spike.',
    },
    swap: {
      name: 'Chilled Salted Mint Chaas (Spiced Buttermilk) with Roasted Cumin',
      emoji: '🥛',
      carbsG: 6,
      proteinG: 5,
      fatG: 2,
      fiberG: 1,
      calories: 65,
      projectedPeak: 110,
      peakRise: 5,
      glycemicIndex: 'Low',
      description: 'Traditional churned probiotic curd thinned with cold water, pink Himalayan salt, and toasted cumin.',
      whyItWorks: 'Probiotic buttermilk has a negligible glycemic impact, hydrates cellular tissue, and enhances gut barrier function.',
    },
  },
  {
    id: 'aloo_tikki_beetroot',
    category: 'Chaat & Street Food',
    cuisine: 'Street Food & Snacks',
    original: {
      name: '2 Fried Aloo Tikkis with Sweet Tamarind & Curd',
      emoji: '🧆',
      carbsG: 60,
      proteinG: 5,
      fatG: 20,
      fiberG: 2.5,
      calories: 435,
      projectedPeak: 205,
      peakRise: 78,
      glycemicIndex: 'High',
      description: 'Shallow-fried mashed potato patties soaked in sugar syrups.',
    },
    swap: {
      name: 'Pan-Grilled Beetroot & Lentil Cutlet with Mint-Coriander Yogurt',
      emoji: '🥗',
      carbsG: 22,
      proteinG: 11,
      fatG: 5,
      fiberG: 7,
      calories: 180,
      projectedPeak: 124,
      peakRise: 14,
      glycemicIndex: 'Low',
      description: 'Grated ruby beetroot, roasted Bengal gram, and fragrant spices grilled on cast iron with green yogurt.',
      whyItWorks: 'Dietary nitrates in beetroot boost nitric oxide and peripheral blood flow, enhancing muscular glucose disposal.',
    },
  },

  // =========================================================================
  // --- 4. WESTERN & ITALIAN SWAPS (8 Presets) ---
  // =========================================================================
  {
    id: 'rice_khichdi',
    category: 'Dinner Grains',
    cuisine: 'Western & Italian',
    original: {
      name: 'White Jasmine Rice & Fried Chicken',
      emoji: '🍗',
      carbsG: 78,
      proteinG: 22,
      fatG: 24,
      fiberG: 1,
      calories: 630,
      projectedPeak: 198,
      peakRise: 68,
      glycemicIndex: 'High',
      description: 'Refined high-GI grain with rapid starch enzymatic hydrolysis.',
    },
    swap: {
      name: 'Brown Basmati Lentil Khichdi & Grilled Chicken',
      emoji: '🍛',
      carbsG: 42,
      proteinG: 34,
      fatG: 10,
      fiberG: 7,
      calories: 410,
      projectedPeak: 142,
      peakRise: 26,
      glycemicIndex: 'Low',
      description: 'Complex amylose structure with high-fiber whole lentils.',
      whyItWorks: 'Lentil soluble fiber creates a viscous gel matrix in the gut, cutting glucose absorption speed by 62%.',
    },
  },
  {
    id: 'pasta_edamame',
    category: 'Lunch & Italian',
    cuisine: 'Western & Italian',
    original: {
      name: 'Classic White Flour Penne with Bolognese',
      emoji: '🍝',
      carbsG: 85,
      proteinG: 24,
      fatG: 18,
      fiberG: 2,
      calories: 610,
      projectedPeak: 205,
      peakRise: 74,
      glycemicIndex: 'High',
      description: 'Dense semolina carbohydrate load with low dietary fiber.',
    },
    swap: {
      name: 'Edamame Protein Pasta with Spinach & Turkey',
      emoji: '🥗',
      carbsG: 28,
      proteinG: 44,
      fatG: 12,
      fiberG: 9,
      calories: 420,
      projectedPeak: 132,
      peakRise: 18,
      glycemicIndex: 'Low',
      description: 'High-protein plant-based noodle loaded with gut-friendly prebiotic fiber.',
      whyItWorks: 'Quadruples protein portion while slashing net carbs by 67%, keeping glucose safely under 140 mg/dL.',
    },
  },
  {
    id: 'bagel_ezekiel',
    category: 'Breakfast',
    cuisine: 'Western & Italian',
    original: {
      name: 'White Plain Bagel with Jam & Sweet Cream',
      emoji: '🥯',
      carbsG: 68,
      proteinG: 10,
      fatG: 14,
      fiberG: 2,
      calories: 440,
      projectedPeak: 188,
      peakRise: 62,
      glycemicIndex: 'High',
      description: 'Fast-digesting refined flour causing acute morning glucose spike.',
    },
    swap: {
      name: 'Sprouted Ezekiel Toast with Avocado & Poached Egg',
      emoji: '🥑',
      carbsG: 24,
      proteinG: 18,
      fatG: 16,
      fiberG: 8,
      calories: 330,
      projectedPeak: 128,
      peakRise: 14,
      glycemicIndex: 'Low',
      description: 'Living sprouted whole grains with mono-unsaturated healthy fats.',
      whyItWorks: 'Healthy fats from avocado and protein from egg delay gastric emptying, delivering smooth all-morning energy.',
    },
  },
  {
    id: 'pizza_cauli',
    category: 'Dinner & Fast Food',
    cuisine: 'Western & Italian',
    original: {
      name: 'Stuffed Crust Pepperoni Pizza (3 Large Slices)',
      emoji: '🍕',
      carbsG: 92,
      proteinG: 32,
      fatG: 38,
      fiberG: 3,
      calories: 840,
      projectedPeak: 218,
      peakRise: 88,
      glycemicIndex: 'High',
      description: 'Refined flour crust with high saturated fat delaying late insulin clearance.',
    },
    swap: {
      name: 'Cauliflower Crust Bell Pepper & Grilled Chicken Pizza',
      emoji: '🍕',
      carbsG: 26,
      proteinG: 36,
      fatG: 16,
      fiberG: 8,
      calories: 390,
      projectedPeak: 130,
      peakRise: 18,
      glycemicIndex: 'Low',
      description: 'Crust crafted from riced cauliflower and egg whites topped with lean poultry.',
      whyItWorks: 'Reduces net carbohydrates by 72% while dietary vegetable fiber stabilizes both 1-hour and 3-hour postprandial levels.',
    },
  },
  {
    id: 'sushi_sashimi',
    category: 'Lunch & Asian',
    cuisine: 'Western & Italian',
    original: {
      name: 'White Rice California Roll Sushi (8 pcs with Sweet Soy)',
      emoji: '🍣',
      carbsG: 64,
      proteinG: 10,
      fatG: 12,
      fiberG: 2,
      calories: 410,
      projectedPeak: 194,
      peakRise: 68,
      glycemicIndex: 'High',
      description: 'Sticky sushi rice seasoned with sugar and mirin paired with sweet eel glaze.',
    },
    swap: {
      name: 'Fresh Salmon Avocado Sashimi Salad with Edamame & Tamari',
      emoji: '🥗',
      carbsG: 12,
      proteinG: 32,
      fatG: 18,
      fiberG: 6,
      calories: 340,
      projectedPeak: 118,
      peakRise: 10,
      glycemicIndex: 'Low',
      description: 'Thick sashimi slices of wild salmon over mixed greens, avocado, and steamed edamame with gluten-free tamari.',
      whyItWorks: 'Omega-3 EPA/DHA fatty acids reduce systemic inflammation while eliminating high-GI sushi rice keeps glucose virtually flat.',
    },
  },
  {
    id: 'burger_lettuce',
    category: 'Dinner Fast Food',
    cuisine: 'Western & Italian',
    original: {
      name: 'Double Cheeseburger on White Brioche with French Fries',
      emoji: '🍔',
      carbsG: 86,
      proteinG: 36,
      fatG: 42,
      fiberG: 3,
      calories: 870,
      projectedPeak: 222,
      peakRise: 92,
      glycemicIndex: 'High',
      description: 'Sugar-glazed brioche bun combined with fatty ground beef and fried potatoes.',
    },
    swap: {
      name: 'Lettuce-Wrapped Grilled Turkey Burger with Roasted Sweet Potato',
      emoji: '🥬',
      carbsG: 26,
      proteinG: 38,
      fatG: 14,
      fiberG: 6,
      calories: 380,
      projectedPeak: 132,
      peakRise: 20,
      glycemicIndex: 'Low',
      description: 'Crisp iceberg lettuce leaf wrap enclosing a grilled lean herb turkey patty with slow-roasted sweet potato wedges.',
      whyItWorks: 'Removes refined bun starch entirely; sweet potato provides slow-release carotenoids and resistant starch.',
    },
  },
  {
    id: 'granola_chia',
    category: 'Breakfast Cereals',
    cuisine: 'Western & Italian',
    original: {
      name: 'Sweetened Honey Granola Bowl with Sweetened Fruit Yogurt',
      emoji: '🥣',
      carbsG: 68,
      proteinG: 8,
      fatG: 15,
      fiberG: 3,
      calories: 440,
      projectedPeak: 204,
      peakRise: 76,
      glycemicIndex: 'High',
      description: 'Clusters of oat flour coated in honey and cane sugar eaten with flavored yogurt.',
    },
    swap: {
      name: 'Chia Seed & Hemp Seed Pudding with Blueberries & Walnuts',
      emoji: '🫐',
      carbsG: 16,
      proteinG: 14,
      fatG: 18,
      fiberG: 10,
      calories: 280,
      projectedPeak: 118,
      peakRise: 10,
      glycemicIndex: 'Low',
      description: 'Overnight chia-hemp gel in unsweetened almond milk topped with fresh wild blueberries and raw walnuts.',
      whyItWorks: 'Presents an astounding 10g of soluble mucilage fiber that forms a gastric barrier, keeping glucose smooth all morning.',
    },
  },
  {
    id: 'fettuccine_zoodles',
    category: 'Dinner Italian',
    cuisine: 'Western & Italian',
    original: {
      name: 'Creamy Fettuccine Alfredo with White Flour Pasta',
      emoji: '🍝',
      carbsG: 78,
      proteinG: 18,
      fatG: 36,
      fiberG: 2,
      calories: 710,
      projectedPeak: 208,
      peakRise: 80,
      glycemicIndex: 'High',
      description: 'Refined wheat pasta smothered in heavy dairy cream and parmesan butter.',
    },
    swap: {
      name: 'Garlic-Sautéed Shrimp Zucchini Noodles (Zoodles) with Shaved Parmesan',
      emoji: '🍤',
      carbsG: 10,
      proteinG: 32,
      fatG: 14,
      fiberG: 4,
      calories: 295,
      projectedPeak: 120,
      peakRise: 10,
      glycemicIndex: 'Low',
      description: 'Spiralized fresh zucchini ribbons flash-sautéed in extra virgin olive oil with garlic and wild gulf shrimp.',
      whyItWorks: 'Slashes 68g of fast carbohydrates down to 10g while lean marine protein triggers sustained gut satiety peptides.',
    },
  },
];

interface SmartMealSwapsProps {
  patientName?: string;
  isModal?: boolean;
  onClose?: () => void;
}

export const SmartMealSwaps: React.FC<SmartMealSwapsProps> = ({
  patientName = 'Alex Rivera',
  isModal = false,
  onClose,
}) => {
  const [selectedCuisine, setSelectedCuisine] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'default' | 'spike' | 'carbs' | 'protein'>('default');
  const [selectedSwapId, setSelectedSwapId] = useState<string>(MEAL_SWAP_PRESETS[0].id);
  const [isSending, setIsSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  // Filtered and searched swap presets
  const filteredPresets = useMemo(() => {
    let result = MEAL_SWAP_PRESETS.filter((p) => {
      if (selectedCuisine !== 'All' && p.cuisine !== selectedCuisine) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesOriginal = p.original.name.toLowerCase().includes(q) || p.original.description.toLowerCase().includes(q);
        const matchesSwap = p.swap.name.toLowerCase().includes(q) || p.swap.description.toLowerCase().includes(q) || p.swap.whyItWorks.toLowerCase().includes(q);
        const matchesCategory = p.category.toLowerCase().includes(q);
        return matchesOriginal || matchesSwap || matchesCategory;
      }
      return true;
    });

    if (sortBy === 'spike') {
      result = [...result].sort((a, b) => {
        const diffA = a.original.peakRise - a.swap.peakRise;
        const diffB = b.original.peakRise - b.swap.peakRise;
        return diffB - diffA;
      });
    } else if (sortBy === 'carbs') {
      result = [...result].sort((a, b) => a.swap.carbsG - b.swap.carbsG);
    } else if (sortBy === 'protein') {
      result = [...result].sort((a, b) => b.swap.proteinG - a.swap.proteinG);
    }

    return result;
  }, [selectedCuisine, searchQuery, sortBy]);

  const activePair =
    filteredPresets.find((p) => p.id === selectedSwapId) ||
    filteredPresets[0] ||
    MEAL_SWAP_PRESETS[0];

  const spikeReductionPct = Math.round(
    ((activePair.original.peakRise - activePair.swap.peakRise) / activePair.original.peakRise) * 100
  );

  const carbReductionG = activePair.original.carbsG - activePair.swap.carbsG;

  const handleSendToPatient = () => {
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setSentSuccess(true);
      showToast({
        type: 'success',
        title: 'Smart Swap Sent to Patient',
        message: `Dietary coaching card "${activePair.swap.name}" dispatched to ${patientName}'s Care Plan.`,
      });
      setTimeout(() => setSentSuccess(false), 3000);
    }, 800);
  };

  const cuisines: Array<MealSwapPair['cuisine']> = [
    'All',
    'South Indian',
    'North Indian',
    'Street Food & Snacks',
    'Western & Italian',
  ];

  const content = (
    <div className="space-y-6">
      {/* Header and Explanation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-850">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Dietitian & Behavioral Suite
            </span>
            <span className="text-xs text-zinc-500 font-mono">Patient: {patientName}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
            <Utensils className="w-5 h-5 text-emerald-400" />
            <span>Smart Meal Swaps Generator</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
              {MEAL_SWAP_PRESETS.length} Curated Presets
            </span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
            Simulate realistic dietary substitutions side-by-side. Shows the exact postprandial glucose spike avoided using the digital twin.
          </p>
        </div>

        {isModal && onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors self-start"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Controls Bar: Cuisine Filters, Search Input, and Sort */}
      <div className="space-y-3">
        {/* Cuisine Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          {cuisines.map((c) => {
            const count = c === 'All' ? MEAL_SWAP_PRESETS.length : MEAL_SWAP_PRESETS.filter((p) => p.cuisine === c).length;
            const isSelected = selectedCuisine === c;
            return (
              <button
                key={c}
                onClick={() => {
                  setSelectedCuisine(c);
                  const nextMatches = MEAL_SWAP_PRESETS.filter((p) => c === 'All' || p.cuisine === c);
                  if (nextMatches.length > 0) {
                    setSelectedSwapId(nextMatches[0].id);
                  }
                }}
                className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-emerald-500 text-black font-bold shadow-sm'
                    : 'bg-zinc-900/80 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                <span>{c}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${isSelected ? 'bg-black/20 text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input & Sort Selector Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search swaps by dish name, ingredient (e.g. Dosa, Idli, Boba, Paneer, Pizza, Oats)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
              }}
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <span className="text-[11px] text-zinc-500 flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3" />
              <span>Sort:</span>
            </span>
            <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800 text-[11px]">
              <button
                onClick={() => setSortBy('default')}
                className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                  sortBy === 'default' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Standard
              </button>
              <button
                onClick={() => setSortBy('spike')}
                className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                  sortBy === 'spike' ? 'bg-emerald-500/20 text-emerald-300 font-medium' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Max Spike Saved
              </button>
              <button
                onClick={() => setSortBy('carbs')}
                className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                  sortBy === 'carbs' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Lowest Carbs
              </button>
              <button
                onClick={() => setSortBy('protein')}
                className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                  sortBy === 'protein' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                High Protein
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Preset Swap Selector Tabs */}
      {filteredPresets.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
          <p className="text-sm text-zinc-400">No meal swaps found matching "{searchQuery}".</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCuisine('All');
            }}
            className="mt-3 px-3 py-1.5 rounded-lg bg-zinc-800 text-xs text-white hover:bg-zinc-700 cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {filteredPresets.map((pair) => {
            const isSelected = pair.id === activePair.id;
            return (
              <button
                key={pair.id}
                onClick={() => {
                  setSelectedSwapId(pair.id);
                  setSentSuccess(false);
                }}
                className={`px-3.5 py-2.5 rounded-2xl border text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? 'bg-white text-black font-bold shadow-md border-white'
                    : 'bg-zinc-950 text-zinc-400 hover:text-white border-zinc-800'
                }`}
              >
                <span>{pair.original.emoji}</span>
                <span>&rarr;</span>
                <span>{pair.swap.emoji}</span>
                <span>{pair.original.name.split(' with ')[0].split(' & ')[0]}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Side-by-Side Comparison Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: Original Problem Meal */}
        <div className="bg-zinc-950 border border-rose-500/30 rounded-3xl p-5 shadow-sm space-y-4 relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl p-2 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                {activePair.original.emoji}
              </span>
              <div>
                <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider block">
                  Current Meal (Spike Inducer)
                </span>
                <h3 className="font-bold text-base text-white mt-0.5">{activePair.original.name}</h3>
                <span className="text-[11px] text-zinc-500">{activePair.category} &bull; {activePair.cuisine}</span>
              </div>
            </div>

            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
              High GI
            </span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">{activePair.original.description}</p>

          {/* Macro Breakdown */}
          <div className="grid grid-cols-4 gap-2 pt-2 border-t border-zinc-850 text-center font-mono">
            <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block">Carbs</span>
              <span className="text-xs font-bold text-rose-400">{activePair.original.carbsG}g</span>
            </div>
            <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block">Protein</span>
              <span className="text-xs font-bold text-zinc-300">{activePair.original.proteinG}g</span>
            </div>
            <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block">Fat</span>
              <span className="text-xs font-bold text-zinc-300">{activePair.original.fatG}g</span>
            </div>
            <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block">Fiber</span>
              <span className="text-xs font-bold text-zinc-500">{activePair.original.fiberG}g</span>
            </div>
          </div>

          {/* Glucose Peak Projection */}
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-rose-400 block">Projected Peak Rise</span>
              <span className="text-lg font-bold font-mono text-rose-300">
                +{activePair.original.peakRise} mg/dL
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-zinc-500 block">Peak Concentration</span>
              <span className="text-sm font-bold font-mono text-white">~{activePair.original.projectedPeak} mg/dL</span>
            </div>
          </div>
        </div>

        {/* Card 2: Recommended Smart Swap */}
        <div className="bg-zinc-950 border border-emerald-500/40 rounded-3xl p-5 shadow-sm space-y-4 relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl p-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                {activePair.swap.emoji}
              </span>
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider block">
                  Recommended Smart Swap
                </span>
                <h3 className="font-bold text-base text-white mt-0.5">{activePair.swap.name}</h3>
                <span className="text-[11px] text-emerald-500/80 font-medium">Clinically Modeled Alternative</span>
              </div>
            </div>

            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Low GI &bull; Safe
            </span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">{activePair.swap.description}</p>

          {/* Macro Breakdown */}
          <div className="grid grid-cols-4 gap-2 pt-2 border-t border-zinc-850 text-center font-mono">
            <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block">Carbs</span>
              <span className="text-xs font-bold text-emerald-400">{activePair.swap.carbsG}g</span>
            </div>
            <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block">Protein</span>
              <span className="text-xs font-bold text-indigo-400">{activePair.swap.proteinG}g</span>
            </div>
            <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block">Fat</span>
              <span className="text-xs font-bold text-zinc-300">{activePair.swap.fatG}g</span>
            </div>
            <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block">Fiber</span>
              <span className="text-xs font-bold text-emerald-400">{activePair.swap.fiberG}g</span>
            </div>
          </div>

          {/* Glucose Peak Projection */}
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-400 block">Projected Peak Rise</span>
              <span className="text-lg font-bold font-mono text-emerald-400">
                +{activePair.swap.peakRise} mg/dL
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-zinc-500 block">Peak Concentration</span>
              <span className="text-sm font-bold font-mono text-white">~{activePair.swap.projectedPeak} mg/dL</span>
            </div>
          </div>
        </div>
      </div>

      {/* Clinical Impact Summary Banner */}
      <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm font-mono shrink-0">
            -{spikeReductionPct}%
          </div>
          <div>
            <span className="text-xs font-bold text-white block">
              Saves -{carbReductionG}g Net Carbs &bull; Prevents +{activePair.original.peakRise - activePair.swap.peakRise} mg/dL Acute Spike
            </span>
            <span className="text-[11px] text-zinc-400">{activePair.swap.whyItWorks}</span>
          </div>
        </div>

        <button
          onClick={handleSendToPatient}
          disabled={isSending || sentSuccess}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 shadow-md ${
            sentSuccess
              ? 'bg-emerald-500 text-black'
              : 'bg-white hover:bg-zinc-200 text-black'
          }`}
        >
          {isSending ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : sentSuccess ? (
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          ) : (
            <Send className="w-3.5 h-3.5 text-black" />
          )}
          <span>{sentSuccess ? 'Recommendation Sent ✓' : 'Send Swap to Patient'}</span>
        </button>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 280 }}
          className="fixed inset-3 sm:inset-y-8 sm:inset-x-12 md:inset-x-24 lg:inset-x-52 z-50 bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl p-6 overflow-y-auto text-zinc-100"
        >
          {content}
        </motion.div>
      </AnimatePresence>
    );
  }

  return content;
};
