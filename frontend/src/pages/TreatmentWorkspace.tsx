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
      {/* Workspace Sub-Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 self-start">
          <button
            onClick={() => handleTabChange('plan')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'plan'
                ? viewMode === 'clinician'
                  ? 'bg-indigo-500 text-white shadow-sm font-bold'
                  : 'bg-teal-500 text-slate-950 shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{viewMode === 'patient' ? 'Doctor Advice & Plan' : 'Clinical Guidance & Action Plan'}</span>
          </button>

          <button
            onClick={() => handleTabChange('pathway')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'pathway'
                ? viewMode === 'clinician'
                  ? 'bg-indigo-500 text-white shadow-sm font-bold'
                  : 'bg-teal-500 text-slate-950 shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>{viewMode === 'patient' ? 'My 4-Week Habits' : '4-Week Care Pathway'}</span>
          </button>

          <button
            onClick={() => handleTabChange('cds')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'cds'
                ? 'bg-indigo-500 text-white shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5 text-indigo-400" />
            <span>Clinician CDS View</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
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
