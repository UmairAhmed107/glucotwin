import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus,
  Database,
  UserCheck,
  Shield,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useCreatePatient, useDropdownParticipants, useDropdownProfiles } from '../api/queries';
import { useApp } from '../context/AppContext';
import { SectionCard } from '../components/Cards';
import { ProvenanceBadge } from '../components/ProvenanceBadge';

const ALLOWED_MED_CLASSES = [
  { id: 'metformin', label: 'Metformin' },
  { id: 'sglt2_inhibitor', label: 'SGLT2 Inhibitor' },
  { id: 'glp1_receptor_agonist', label: 'GLP-1 Receptor Agonist' },
  { id: 'dpp4_inhibitor', label: 'DPP-4 Inhibitor' },
  { id: 'thiazolidinedione', label: 'Thiazolidinedione (TZD)' },
  { id: 'sulfonylurea', label: 'Sulfonylurea' },
  { id: 'basal_insulin', label: 'Basal Insulin' },
];

export const PatientSetup: React.FC = () => {
  const navigate = useNavigate();
  const { setActivePatientId } = useApp();
  const [activeTab, setActiveTab] = useState<'new' | 'cgmacros' | 'shanghai'>('new');

  const createPatientMutation = useCreatePatient();
  const { data: cgParticipants, isLoading: loadingParticipants } = useDropdownParticipants();
  const { data: shanghaiProfiles, isLoading: loadingProfiles } = useDropdownProfiles();

  // Tab 1: New Patient Form State
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState<number>(54);
  const [sex, setSex] = useState<'M' | 'F' | 'Other'>('M');
  const [bmi, setBmi] = useState<number>(27.5);
  const [hba1c, setHba1c] = useState<number>(7.8);
  const [fastingGlucose, setFastingGlucose] = useState<number>(135);
  const [hypoHistory, setHypoHistory] = useState<string>('unknown'); // 'true', 'false', 'unknown'
  const [kidneyFlag, setKidneyFlag] = useState<boolean>(false);
  const [selectedMeds, setSelectedMeds] = useState<string[]>(['metformin']);

  // Tab 2: CGMacros selection
  const [selectedParticipantId, setSelectedParticipantId] = useState<number | null>(null);

  // Tab 3: Shanghai selection
  const [selectedShanghaiId, setSelectedShanghaiId] = useState<number | null>(null);

  const handleAutoFill = () => {
    setDisplayName('Marcus Bell');
    setAge(56);
    setSex('M');
    setBmi(28.2);
    setHba1c(7.5);
    setFastingGlucose(138);
    setHypoHistory('false');
    setKidneyFlag(false);
    setSelectedMeds(['metformin', 'sglt2_inhibitor']);
  };

  const toggleMed = (medId: string) => {
    setSelectedMeds((prev) =>
      prev.includes(medId) ? prev.filter((m) => m !== medId) : [...prev, medId]
    );
  };

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    const hypoBool =
      hypoHistory === 'true' ? true : hypoHistory === 'false' ? false : null;

    try {
      const patient = await createPatientMutation.mutateAsync({
        mode: 'new',
        display_name: displayName.trim() || 'New Patient',
        age,
        sex,
        bmi,
        hba1c_pct: hba1c,
        fasting_glucose_mgdl: fastingGlucose,
        hypoglycemia_history: hypoBool,
        kidney_flag: kidneyFlag,
        current_meds: selectedMeds,
      });
      setActivePatientId(patient.id);
      navigate('/');
    } catch {
      // Error handled by client toast
    }
  };

  const handleSelectCGMacros = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParticipantId) return;

    try {
      const patient = await createPatientMutation.mutateAsync({
        mode: 'cgmacros',
        cgmacros_participant_id: selectedParticipantId,
      });
      setActivePatientId(patient.id);
      navigate('/');
    } catch {
      // Error handled by client toast
    }
  };

  const handleSelectShanghai = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShanghaiId) return;

    try {
      const patient = await createPatientMutation.mutateAsync({
        mode: 'shanghai_profile',
        shanghai_patient_id: selectedShanghaiId,
      });
      setActivePatientId(patient.id);
      navigate('/');
    } catch {
      // Error handled by client toast
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-teal-400" />
            Patient Registration & Clinical Intake
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Register a new patient record with demographic, biochemical, and pharmacological parameters.
          </p>
        </div>

        {activeTab === 'new' && (
          <button
            type="button"
            onClick={handleAutoFill}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            <span>Auto-fill Sample Data</span>
          </button>
        )}
      </div>

      {/* Mode Selector */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('new')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'new'
                ? 'bg-teal-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>New Patient Form</span>
          </button>

          <button
            onClick={() => setActiveTab('cgmacros')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-all ${
              activeTab === 'cgmacros'
                ? 'bg-slate-800 text-slate-100 border border-slate-700'
                : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Load Sample Cohort Profile</span>
          </button>

          <button
            onClick={() => setActiveTab('shanghai')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-all ${
              activeTab === 'shanghai'
                ? 'bg-slate-800 text-slate-100 border border-slate-700'
                : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Load Clinical Test Profile</span>
          </button>
        </div>
      </div>

      {/* TAB 1: New Patient Form */}
      {activeTab === 'new' && (
        <SectionCard
          title="Clinical Characteristics & Baseline Data"
          subtitle="Enter demographic, biochemical, and pharmacological parameters with field-level range validation."
        >
          <form onSubmit={handleCreateNew} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Display Name or Identifier
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Patient Alpha-101"
                  className="w-full bg-[#0B1220] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Biological Sex
                </label>
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value as any)}
                  className="w-full bg-[#0B1220] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                >
                  <option value="M">Male (M)</option>
                  <option value="F">Female (F)</option>
                  <option value="Other">Other / Non-specified</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Age (18 – 100 years)
                </label>
                <input
                  type="number"
                  required
                  min={18}
                  max={100}
                  value={age}
                  onChange={(e) => setAge(parseInt(e.target.value, 10))}
                  className="w-full bg-[#0B1220] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Body Mass Index (BMI, kg/m²)
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  min={12}
                  max={60}
                  value={bmi}
                  onChange={(e) => setBmi(parseFloat(e.target.value))}
                  className="w-full bg-[#0B1220] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  HbA1c (% in blood)
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  min={4.0}
                  max={18.0}
                  value={hba1c}
                  onChange={(e) => setHba1c(parseFloat(e.target.value))}
                  className="w-full bg-[#0B1220] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Fasting Glucose (mg/dL)
                </label>
                <input
                  type="number"
                  required
                  min={50}
                  max={500}
                  value={fastingGlucose}
                  onChange={(e) => setFastingGlucose(parseFloat(e.target.value))}
                  className="w-full bg-[#0B1220] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            {/* Risk factors */}
            <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-2">
                  Hypoglycemia History
                </label>
                <div className="flex items-center gap-4 text-xs text-slate-300">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="hypo"
                      value="false"
                      checked={hypoHistory === 'false'}
                      onChange={() => setHypoHistory('false')}
                      className="text-teal-500 focus:ring-0"
                    />
                    <span>None (False)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="hypo"
                      value="true"
                      checked={hypoHistory === 'true'}
                      onChange={() => setHypoHistory('true')}
                      className="text-teal-500 focus:ring-0"
                    />
                    <span className="text-amber-400 font-medium">History Present</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="hypo"
                      value="unknown"
                      checked={hypoHistory === 'unknown'}
                      onChange={() => setHypoHistory('unknown')}
                      className="text-teal-500 focus:ring-0"
                    />
                    <span>Unknown / Null</span>
                  </label>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Enforces Governor rule R4/R4b on secretagogues and insulin.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-2">
                  Kidney Risk / Renal Flag
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={kidneyFlag}
                    onChange={(e) => setKidneyFlag(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-teal-500 focus:ring-0"
                  />
                  <span>Known renal impairment or elevated eGFR/creatinine risk</span>
                </label>
                <p className="text-[11px] text-slate-400 mt-1">
                  Enforces Governor rule R5 (demotes metformin & SGLT2 with review caution).
                </p>
              </div>
            </div>

            {/* Current Medications */}
            <div className="pt-3 border-t border-slate-800/80">
              <label className="block text-xs font-semibold text-slate-200 mb-2">
                Current Medication Classes
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {ALLOWED_MED_CLASSES.map((med) => {
                  const checked = selectedMeds.includes(med.id);
                  return (
                    <button
                      type="button"
                      key={med.id}
                      onClick={() => toggleMed(med.id)}
                      className={`text-left px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                        checked
                          ? 'bg-teal-500/15 border-teal-500/40 text-teal-300 shadow-sm'
                          : 'bg-[#0B1220] border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {med.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="submit"
                disabled={createPatientMutation.isPending}
                className="px-5 py-2.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-[#0B1220] font-semibold text-xs rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-teal-500/20"
              >
                {createPatientMutation.isPending ? 'Initializing Twin...' : 'Create & Launch Digital Twin'}
              </button>
            </div>
          </form>
        </SectionCard>
      )}

      {/* TAB 2: Load CGMacros Participant */}
      {activeTab === 'cgmacros' && (
        <SectionCard
          title="Seed Twin from CGMacros Participant Cohort"
          subtitle="Choose an established participant from the 45-person clinical dataset. Their prior meals will immediately calibrate the twin's memory."
          badge={<ProvenanceBadge kind="TWIN_PREDICTED" size="sm" />}
        >
          <form onSubmit={handleSelectCGMacros} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Select CGMacros Participant ID
              </label>
              {loadingParticipants ? (
                <div className="text-xs text-slate-400">Loading cohort participants...</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-96 overflow-y-auto pr-1">
                  {cgParticipants?.map((item) => {
                    const isSelected = selectedParticipantId === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedParticipantId(item.id)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-teal-500/15 border-teal-500 text-teal-200 shadow-md'
                            : 'bg-[#0B1220] border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between font-semibold text-xs">
                          <span>Participant #{item.id}</span>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-teal-400" />}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {item.summary}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-3 bg-teal-950/20 border border-teal-500/30 rounded-lg text-xs text-teal-300 flex items-start gap-2">
              <Sparkles className="w-4 h-4 shrink-0 text-teal-400 mt-0.5" />
              <span>
                <strong>Personalised from Start:</strong> The patient will be created with their existing meal history loaded, ensuring confident, narrow ensemble prediction bands immediately.
              </span>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="submit"
                disabled={!selectedParticipantId || createPatientMutation.isPending}
                className="px-5 py-2.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-40 text-[#0B1220] font-semibold text-xs rounded-lg transition-colors shadow-lg shadow-teal-500/20"
              >
                {createPatientMutation.isPending ? 'Seeding Twin...' : 'Load & Personalize Twin'}
              </button>
            </div>
          </form>
        </SectionCard>
      )}

      {/* TAB 3: Shanghai Clinical Profile */}
      {activeTab === 'shanghai' && (
        <SectionCard
          title="Shanghai Hospital Clinical Profiles (109 Synthetic Cases)"
          subtitle="Explore distinct metabolic phenotypes (mild, high glycemic variability, severe) from real clinical trials."
          badge={<ProvenanceBadge kind="DEMO_FIXTURE" size="sm" />}
        >
          <form onSubmit={handleSelectShanghai} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Select Clinical Profile
              </label>
              {loadingProfiles ? (
                <div className="text-xs text-slate-400">Loading Shanghai profiles...</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-96 overflow-y-auto pr-1">
                  {shanghaiProfiles?.slice(0, 30).map((item) => {
                    const isSelected = selectedShanghaiId === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedShanghaiId(item.id)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-purple-500/15 border-purple-500 text-purple-200 shadow-md'
                            : 'bg-[#0B1220] border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between font-semibold text-xs">
                          <span>Patient Profile #{item.id}</span>
                          <span className="text-[10px] px-1.5 py-0.2 bg-purple-500/20 text-purple-300 rounded">
                            Synthetic demo
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {item.summary}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-3 bg-purple-950/20 border border-purple-500/30 rounded-lg text-xs text-purple-300 flex items-start gap-2">
              <Shield className="w-4 h-4 shrink-0 text-purple-400 mt-0.5" />
              <span>
                <strong>Synthetic Demo Label:</strong> All profiles imported from Shanghai dataset are explicitly flagged as synthetic demo cases with population baseline twin memory.
              </span>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="submit"
                disabled={!selectedShanghaiId || createPatientMutation.isPending}
                className="px-5 py-2.5 bg-purple-500 hover:bg-purple-600 disabled:opacity-40 text-white font-semibold text-xs rounded-lg transition-colors shadow-lg shadow-purple-500/20"
              >
                {createPatientMutation.isPending ? 'Importing Profile...' : 'Import Synthetic Profile'}
              </button>
            </div>
          </form>
        </SectionCard>
      )}
    </div>
  );
};
