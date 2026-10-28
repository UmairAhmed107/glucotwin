import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity,
  BookOpen,
  Calendar,
  HelpCircle,
  Pill,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { ClinicalPlanPage } from './ClinicalPlan';
import { FourWeekPlanPage } from './FourWeekPlan';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { usePatient } from '../api/queries';
import { MedicalMetricsGlossary } from '../components/MedicalMetricsGlossary';
import { PreConsultationBriefModal, PatientBriefData } from '../components/PreConsultationBriefModal';
import { SoapNoteModal } from '../components/SoapNoteModal';
import { Zap, FileText } from 'lucide-react';

export type ClinicalHubTab = 'plan' | 'pathway';

export const TreatmentWorkspace: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');

  const initialTab: ClinicalHubTab = requestedTab === 'pathway' ? 'pathway' : 'plan';

  const [activeTab, setActiveTab] = useState<ClinicalHubTab>(initialTab);
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);
  const [isBriefOpen, setIsBriefOpen] = useState(false);
  const [isSoapOpen, setIsSoapOpen] = useState(false);

  const { viewMode, activePatientId } = useApp();
  const { user } = useAuth();
  const { data: patient } = usePatient(activePatientId);

  const effectiveRole = user?.role || (viewMode === 'patient' ? 'patient' : 'clinician');
  const isDoctor = (effectiveRole === 'clinician' || effectiveRole === 'admin') && viewMode !== 'patient';

  const handleTabChange = (tab: ClinicalHubTab) => {
    setActiveTab(tab);
    setSearchParams(tab === 'plan' ? {} : { tab });
  };

  return (
    <div className="space-y-6">
      {/* Patient State & Clinical Hub Banner */}
      <div className="bg-zinc-950 border border-zinc-850 rounded-3xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/10 text-white border border-white/20">
                {viewMode === 'patient' ? 'Care Companion' : 'Clinical Decision Support (CDS)'}
              </span>
              <span className="text-xs text-zinc-500 font-mono">
                Patient #{patient?.id || activePatientId || '1'} &bull; {patient?.display_name || 'Arthur Pendelton'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
              <span>{viewMode === 'patient' ? 'My Health Plan & Doctor Advice' : 'Clinical Decision Support Hub'}</span>
            </h1>
            <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
              {viewMode === 'patient'
                ? 'Your comprehensive diabetes care summary, lifestyle goals, medication guidelines, and four-week milestones.'
                : 'Consolidated clinical decision workspace: guideline-grounded care directives, counterfactual therapy projections, 4-week pathways, and safety governance.'}
            </p>
          </div>

          {/* Quick Metrics Bar & Glossary Trigger */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Metrics Badges */}
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3.5 py-2 rounded-2xl">
              <div>
                <span className="text-[10px] text-zinc-500 block">Baseline HbA1c</span>
                <span className="text-xs font-bold text-white font-mono">
                  {patient?.baseline_hba1c ? `${patient.baseline_hba1c}%` : '8.2%'}
                </span>
              </div>
              <div className="w-px h-6 bg-zinc-800 mx-1" />
              <div>
                <span className="text-[10px] text-zinc-500 block">Target A1c</span>
                <span className="text-xs font-bold text-emerald-400 font-mono">
                  {patient?.target_hba1c ? `${patient.target_hba1c}%` : '< 7.0%'}
                </span>
              </div>
              <div className="w-px h-6 bg-zinc-800 mx-1" />
              <div>
                <span className="text-[10px] text-zinc-500 block">TIR Goal</span>
                <span className="text-xs font-bold text-emerald-400 font-mono">&gt; 70%</span>
              </div>
            </div>

            {/* Clinician Rapid Actions: 30s Brief & SOAP Note */}
            {isDoctor && (
              <>
                <button
                  onClick={() => setIsBriefOpen(true)}
                  className="px-3.5 py-2 rounded-2xl bg-zinc-900 hover:bg-zinc-850 text-amber-300 border border-amber-500/30 hover:border-amber-500/50 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  title="Open 30-Second Pre-Consultation Executive Brief"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>30s Brief</span>
                </button>

                <button
                  onClick={() => setIsSoapOpen(true)}
                  className="px-3.5 py-2 rounded-2xl bg-zinc-900 hover:bg-zinc-850 text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/50 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  title="Generate 1-Click Consultation SOAP Note & CPT Codes"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  <span>SOAP / CPT Note</span>
                </button>
              </>
            )}

            {/* Glossary Button */}
            <button
              onClick={() => setIsGlossaryOpen(true)}
              className="px-3.5 py-2 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 hover:border-zinc-700 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              title="Open Medical Terms & Metrics Glossary"
            >
              <BookOpen className="w-3.5 h-3.5 text-white" />
              <span>Medical Terms Guide</span>
            </button>
          </div>
        </div>
      </div>

      {/* Workspace Consolidated Sub-Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-850 pb-4">
        <div className="flex flex-wrap items-center gap-1.5 bg-zinc-950 p-1.5 rounded-2xl border border-zinc-850 self-start">
          {/* Sub-tab 1: Action Plan & Targets */}
          <button
            onClick={() => handleTabChange('plan')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'plan'
                ? 'bg-white text-black shadow-sm font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{viewMode === 'patient' ? 'Doctor Advice & Goals' : 'Action Plan & Directives'}</span>
          </button>

          {/* Sub-tab 2: 4-Week Care Pathway */}
          <button
            onClick={() => handleTabChange('pathway')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'pathway'
                ? 'bg-white text-black shadow-sm font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>{viewMode === 'patient' ? 'My 4-Week Habits' : '4-Week Milestone Pathway'}</span>
          </button>
        </div>

        <div className="text-[11px] text-zinc-400 flex items-center gap-2 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>ADA/ICMR Guideline-Concordant &bull; Rules R1–R9 Active</span>
        </div>
      </div>

      {/* Render Active View */}
      {activeTab === 'plan' && <ClinicalPlanPage />}
      {activeTab === 'pathway' && <FourWeekPlanPage />}

      {/* Slide-over Glossary Modal */}
      <MedicalMetricsGlossary
        isOpen={isGlossaryOpen}
        onClose={() => setIsGlossaryOpen(false)}
      />

      {/* 30-Second Pre-Consultation Briefing Modal */}
      <PreConsultationBriefModal
        isOpen={isBriefOpen}
        onClose={() => setIsBriefOpen(false)}
        patient={
          patient
            ? {
                patientId: patient.id,
                displayName: patient.display_name,
                age: patient.age,
                sex: patient.sex,
                hba1c: patient.baseline_hba1c,
                tir: 64.2,
                cv: 37.8,
                riskScore: 68,
                riskLevel: 'high',
                openAlertsCount: 2,
              }
            : null
        }
        onOpenSoapNote={() => {
          setIsBriefOpen(false);
          setIsSoapOpen(true);
        }}
      />

      {/* 1-Click Consultation SOAP Note & Billing Generator */}
      <SoapNoteModal
        isOpen={isSoapOpen}
        onClose={() => setIsSoapOpen(false)}
        patient={
          patient
            ? {
                patientId: patient.id,
                displayName: patient.display_name,
                age: patient.age,
                sex: patient.sex,
                hba1c: patient.baseline_hba1c,
                tir: 64.2,
                cv: 37.8,
                riskScore: 68,
                riskLevel: 'high',
                openAlertsCount: 2,
              }
            : null
        }
      />
    </div>
  );
};

export default TreatmentWorkspace;
