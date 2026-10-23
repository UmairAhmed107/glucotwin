import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { History, LineChart, PlusCircle, Activity } from 'lucide-react';
import { TimelinePage } from './Timeline';
import { ReplayPage } from './Replay';
import { LogData } from './LogData';
import { useApp } from '../context/AppContext';

export const TimelineWorkspace: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'replay' ? 'replay' : 'timeline';
  const [activeTab, setActiveTab] = useState<'timeline' | 'replay' | 'log'>(initialTab);
  const { viewMode } = useApp();

  const handleTabChange = (tab: 'timeline' | 'replay' | 'log') => {
    setActiveTab(tab);
    setSearchParams(tab === 'replay' ? { tab: 'replay' } : tab === 'log' ? { tab: 'log' } : {});
  };

  return (
    <div className="space-y-6">
      {/* Workspace Sub-Navigation Tabs (Matches Reference UI) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-850 pb-4">
        <div className="flex items-center gap-1 bg-zinc-950 p-1.5 rounded-2xl border border-zinc-850 self-start">
          <button
            onClick={() => handleTabChange('timeline')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'timeline'
                ? 'bg-white text-black shadow-sm font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>{viewMode === 'patient' ? 'My Glucose Diary' : 'Patient Timeline'}</span>
          </button>

          <button
            onClick={() => handleTabChange('replay')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'replay'
                ? 'bg-white text-black shadow-sm font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <LineChart className="w-3.5 h-3.5" />
            <span>CGM Sensor Replay</span>
          </button>

          <button
            onClick={() => handleTabChange('log')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'log'
                ? 'bg-white text-black shadow-sm font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Log Meal & Glucose</span>
          </button>
        </div>

        <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 font-medium">
          <Activity className="w-3.5 h-3.5 text-white" />
          <span>Continuous metabolic history & simulated sensor telemetry</span>
        </div>
      </div>

      {/* Workspace Active View */}
      {activeTab === 'timeline' && <TimelinePage />}
      {activeTab === 'replay' && <ReplayPage />}
      {activeTab === 'log' && <LogData />}
    </div>
  );
};
