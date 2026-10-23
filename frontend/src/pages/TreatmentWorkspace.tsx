import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sparkles, TrendingUp, Calendar, Stethoscope, ShieldCheck } from 'lucide-react';
import { ClinicalPlanPage } from './ClinicalPlan';
import { TherapyScenariosPage } from './TherapyScenarios';
import { FourWeekPlanPage } from './FourWeekPlan';
import { ClinicianViewPage } from './ClinicianView';
import { useApp } from '../context/AppContext';

export const TreatmentWorkspace: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const initialTab =
    requestedTab === 'pathway'
      ? 'pathway'
      : requestedTab === 'cds'
      ? 'cds'
      : 'plan';

  const [activeTab, setActiveTab] = useState<'plan' | 'pathway' | 'cds'>(initialTab);
  const { viewMode } = useApp();

  const handleTabChange = (tab: 'plan' | 'pathway' | 'cds') => {
    setActiveTab(tab);
    setSearchParams(tab === 'plan' ? {} : { tab });
  };

  return (
    <div className="space-y-6">
      {/* Workspace Sub-Navigation Tabs (Matches Reference UI) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-850 pb-4">
        <div className="flex flex-wrap items-center gap-1 bg-zinc-950 p-1.5 rounded-2xl border border-zinc-850 self-start">
          <button
            onClick={() => handleTabChange('plan')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'plan'
                ? 'bg-white text-black shadow-sm font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{viewMode === 'patient' ? 'Doctor Advice & Plan' : 'Clinical Guidance & Action Plan'}</span>
          </button>

          <button
            onClick={() => handleTabChange('pathway')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'pathway'
                ? 'bg-white text-black shadow-sm font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>{viewMode === 'patient' ? 'My 4-Week Habits' : '4-Week Care Pathway'}</span>
          </button>

          <button
            onClick={() => handleTabChange('cds')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'cds'
                ? 'bg-white text-black shadow-sm font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5" />
            <span>Clinician CDS View</span>
          </button>
        </div>

        <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-white" />
          <span>ADA/ICMR Guideline-Concordant with Clinical Safety Verification</span>
        </div>
      </div>

      {/* Active Tab View */}
      {activeTab === 'plan' && <ClinicalPlanPage />}
      {activeTab === 'pathway' && <FourWeekPlanPage />}
      {activeTab === 'cds' && <ClinicianViewPage />}
    </div>
  );
};
