import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bookmark, Compass, RefreshCw, Sliders, Sparkles } from 'lucide-react';
import { WhatIfLabPage } from './WhatIfLab';
import { SavedScenariosTab } from './SavedScenariosTab';
import { GoalPlannerTab } from './GoalPlannerTab';
import { SmartMealSwaps } from '../components/SmartMealSwaps';
import { useApp } from '../context/AppContext';

export const SimulationWorkspace: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  
  // Resolve initial tab
  const getInitialTab = (): 'forecast' | 'scenarios' | 'goal_planner' | 'swaps' => {
    if (requestedTab === 'swaps') return 'swaps';
    if (requestedTab === 'scenarios') return 'scenarios';
    if (requestedTab === 'goal_planner' || requestedTab === 'planner') return 'goal_planner';
    return 'forecast';
  };

  const [activeTab, setActiveTab] = useState<'forecast' | 'scenarios' | 'goal_planner' | 'swaps'>(getInitialTab());
  const { viewMode } = useApp();

  const handleTabChange = (tab: 'forecast' | 'scenarios' | 'goal_planner' | 'swaps') => {
    setActiveTab(tab);
    setSearchParams(tab === 'forecast' ? {} : { tab });
  };

  return (
    <div className="space-y-6">
      {/* Workspace Sub-Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-850 pb-4">
        <div className="flex flex-wrap items-center gap-1 bg-zinc-950 p-1.5 rounded-2xl border border-zinc-850">
          <button
            onClick={() => handleTabChange('forecast')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'forecast'
                ? 'bg-white text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>
              {viewMode === 'patient'
                ? 'What-If Lab & Forecast'
                : 'Meal Forecast & What-If Counterfactuals'}
            </span>
          </button>

          <button
            onClick={() => handleTabChange('scenarios')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'scenarios'
                ? 'bg-white text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Saved Scenarios & Compare</span>
          </button>

          <button
            onClick={() => handleTabChange('goal_planner')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'goal_planner'
                ? 'bg-white text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Goal-Based Planner</span>
          </button>

          <button
            onClick={() => handleTabChange('swaps')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'swaps'
                ? 'bg-white text-black shadow-sm'
                : 'text-amber-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Smart Meal Swaps (Dietitian AI)</span>
          </button>
        </div>

        <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-white" />
          <span>15-model bootstrap ensemble with personalized meal memory</span>
        </div>
      </div>

      {/* Active Tab View */}
      {activeTab === 'forecast' && <WhatIfLabPage />}
      {activeTab === 'scenarios' && <SavedScenariosTab />}
      {activeTab === 'goal_planner' && <GoalPlannerTab />}
      {activeTab === 'swaps' && <SmartMealSwaps />}
    </div>
  );
};

