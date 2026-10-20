import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bookmark, Compass, Sliders, Sparkles, Utensils } from 'lucide-react';
import { WhatIfLabPage } from './WhatIfLab';
import { MealToolsPage } from './MealTools';
import { SavedScenariosTab } from './SavedScenariosTab';
import { GoalPlannerTab } from './GoalPlannerTab';
import { useApp } from '../context/AppContext';

export const SimulationWorkspace: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  
  // Resolve initial tab
  const getInitialTab = (): 'forecast' | 'scenarios' | 'goal_planner' | 'tools' => {
    if (requestedTab === 'scenarios') return 'scenarios';
    if (requestedTab === 'goal_planner' || requestedTab === 'planner') return 'goal_planner';
    if (requestedTab === 'tools') return 'tools';
    return 'forecast';
  };

  const [activeTab, setActiveTab] = useState<'forecast' | 'scenarios' | 'goal_planner' | 'tools'>(getInitialTab());
  const { viewMode } = useApp();

  const handleTabChange = (tab: 'forecast' | 'scenarios' | 'goal_planner' | 'tools') => {
    setActiveTab(tab);
    setSearchParams(tab === 'forecast' ? {} : { tab });
  };

  return (
    <div className="space-y-6">
      {/* Workspace Sub-Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 self-start">
          <button
            onClick={() => handleTabChange('forecast')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'forecast'
                ? 'bg-teal-500 text-slate-950 shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
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
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'scenarios'
                ? 'bg-teal-500 text-slate-950 shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Saved Scenarios & Compare</span>
          </button>

          <button
            onClick={() => handleTabChange('goal_planner')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'goal_planner'
                ? 'bg-teal-500 text-slate-950 shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Goal-Based Planner</span>
          </button>

          <button
            onClick={() => handleTabChange('tools')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'tools'
                ? 'bg-teal-500 text-slate-950 shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Meal Tools & Timing</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-teal-400" />
          <span>15-model bootstrap ensemble with personalized meal memory</span>
        </div>
      </div>

      {/* Active Tab View */}
      {activeTab === 'forecast' && <WhatIfLabPage />}
      {activeTab === 'scenarios' && <SavedScenariosTab />}
      {activeTab === 'goal_planner' && <GoalPlannerTab />}
      {activeTab === 'tools' && <MealToolsPage />}
    </div>
  );
};
