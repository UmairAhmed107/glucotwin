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
      {/* Workspace Sub-Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 self-start">
          <button
            onClick={() => handleTabChange('timeline')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'timeline'
                ? 'bg-teal-500 text-slate-950 shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>{viewMode === 'patient' ? 'My Glucose Diary' : 'Patient Timeline'}</span>
          </button>

          <button
            onClick={() => handleTabChange('replay')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'replay'
                ? 'bg-teal-500 text-slate-950 shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <LineChart className="w-3.5 h-3.5" />
            <span>CGM Sensor Replay</span>
          </button>

          <button
            onClick={() => handleTabChange('log')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'log'
                ? 'bg-teal-500 text-slate-950 shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Log Meal & Glucose</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-teal-400" />
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
