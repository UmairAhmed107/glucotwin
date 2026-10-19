import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Cpu,
  Database,
  FlaskConical,
  GraduationCap,
  History,
  Layers,
  LineChart,
  LogOut,
  PlusCircle,
  ShieldAlert,
  Sliders,
  Sparkles,
  Stethoscope,
  TrendingUp,
  User,
  Users,
  Utensils,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { usePatients } from '../api/queries';
import { subscribeToToasts } from '../api/client';

interface NavItem {
  to: string;
  label: string;
  patientLabel?: string;
  icon: React.ElementType;
  clinicianOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Overview', patientLabel: 'My Twin Overview', icon: Activity },
  { to: '/timeline', label: 'Timeline & Replay', patientLabel: 'Glucose Diary & Replay', icon: History },
  { to: '/simulation', label: 'Simulation Lab', patientLabel: 'Meal & Walk Forecast', icon: Sliders },
  { to: '/treatment', label: 'Treatment Studio', patientLabel: 'Doctor Advice & Plan', icon: Sparkles },
  { to: '/governance', label: 'SCM Governance', icon: Database, clinicianOnly: true },
];

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Twin Overview',
  '/timeline': 'Glucose Timeline & Sensor Replay',
  '/simulation': 'Metabolic Simulation Lab',
  '/treatment': 'Clinical Care & Treatment Studio',
  '/governance': 'SCM Governance & Model Registry',
  '/patients/setup': 'Patient Setup',
  '/log': 'Log Data',
  '/predict': 'Prediction Engine',
  '/learning': 'Twin Learning',
  '/whatif': 'What-If Simulation Lab',
  '/meal-tools': 'Meal Tools & Planner',
  '/clinical-plan': 'Clinical Plan & Interventions',
  '/therapy-scenarios': 'Therapy Scenarios',
  '/plan': '4-Week Care Pathway',
  '/cohort': 'Cohort Position',
  '/validation': 'Validation & Model Registry',
  '/replay': 'CGM Sensor Replay',
  '/clinician-view': 'Clinician Decision Support View',
};

export const Layout: React.FC = () => {
  const { activePatientId, setActivePatientId, viewMode, setViewMode, isSidebarCollapsed, toggleSidebar } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  // Dynamic Page Title
  useEffect(() => {
    const pageTitle = ROUTE_TITLES[location.pathname] || 'Metabolic Digital Twin';
    document.title = `${pageTitle} | GlucoTwin`;
  }, [location.pathname]);

  const { data: patients, isLoading: patientsLoading } = usePatients();

  // Toast notifications state
  const [toasts, setToasts] = useState<Array<{ id: number; type: 'success' | 'error' | 'info'; title: string; message: string }>>([]);

  useEffect(() => {
    return subscribeToToasts((toast) => {
      const id = Date.now();
      setToasts((prev) => [...prev, { ...toast, id }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    });
  }, []);

  // Ensure an active patient is selected if available
  useEffect(() => {
    if (patients && patients.length > 0 && activePatientId === null) {
      setActivePatientId(patients[0].id);
    }
  }, [patients, activePatientId, setActivePatientId]);

  const activePatient = patients?.find((p) => p.id === activePatientId);

  return (
    <div className="flex flex-col min-h-screen bg-[#0B1220] text-slate-100 font-sans">

      <div className="flex flex-1 overflow-hidden">
        {/* 2. Left Collapsible Sidebar */}
        <aside
          className={`bg-[#0F172A] border-r border-slate-800/90 transition-all duration-300 flex flex-col shrink-0 select-none ${
            isSidebarCollapsed ? 'w-16' : 'w-64'
          }`}
        >
          {/* Brand header */}
          <div className="h-14 px-4 flex items-center justify-between border-b border-slate-800">
            {!isSidebarCollapsed && (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-teal-700 flex items-center justify-center text-[#0B1220] shadow-md shadow-teal-500/20">
                  <Activity className="w-5 h-5 font-bold" />
                </div>
                <div>
                  <h1 className="text-sm font-bold text-slate-100 tracking-tight flex items-center gap-1.5">
                    GlucoTwin
                    <span className="text-[10px] font-mono px-1 py-0.2 bg-teal-500/20 text-teal-300 rounded border border-teal-500/30">
                      v0.2
                    </span>
                  </h1>
                  <p className="text-[10px] text-slate-400">Metabolic Digital Twin</p>
                </div>
              </div>
            )}
            <button
              onClick={toggleSidebar}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-md transition-colors mx-auto"
              title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isSidebarCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
            {!isSidebarCollapsed && (
              <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {viewMode === 'patient' ? 'Patient Portal' : 'Clinical Decision Support'}
              </div>
            )}
            {NAV_ITEMS.map((item, idx) => {
              const Icon = item.icon;
              const displayLabel =
                viewMode === 'patient' && item.patientLabel
                  ? item.patientLabel
                  : item.label;

              // If entering clinician-only tools in the nav, add a small separator
              const isFirstClinicianTool =
                item.clinicianOnly &&
                (idx === 0 || !NAV_ITEMS[idx - 1].clinicianOnly);

              return (
                <React.Fragment key={item.to}>
                  {isFirstClinicianTool && !isSidebarCollapsed && (
                    <div className="pt-3 pb-1 px-3 flex items-center justify-between border-t border-slate-800/80 my-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                        Clinician Tools
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 bg-indigo-500/10 text-indigo-300 rounded border border-indigo-500/20">
                        CDS
                      </span>
                    </div>
                  )}
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? viewMode === 'clinician' && item.clinicianOnly
                            ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shadow-sm'
                            : 'bg-teal-500/15 text-teal-300 border border-teal-500/30 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`
                    }
                    title={isSidebarCollapsed ? displayLabel : undefined}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        item.clinicianOnly ? 'text-indigo-400/90' : 'text-teal-400/80'
                      }`}
                    />
                    {!isSidebarCollapsed && (
                      <span className="truncate flex-1">{displayLabel}</span>
                    )}
                    {!isSidebarCollapsed && item.clinicianOnly && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                        MD
                      </span>
                    )}
                  </NavLink>
                </React.Fragment>
              );
            })}
          </nav>

          {/* Sidebar Footer: Patient Setup link */}
          <div className="p-2 border-t border-slate-800">
            <button
              onClick={() => navigate('/patients/setup')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-teal-400 hover:text-teal-300 hover:bg-teal-500/10 border border-teal-500/20 transition-all ${
                isSidebarCollapsed ? 'justify-center' : ''
              }`}
              title="Add or Setup Patient"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              {!isSidebarCollapsed && <span>Setup Patient</span>}
            </button>
          </div>
        </aside>

        {/* 3. Main Workspace Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Top Bar */}
          <header className="h-14 bg-[#111C30]/80 border-b border-slate-800 px-5 flex items-center justify-between gap-4 backdrop-blur-md sticky top-0 z-40">
            {/* Left: Patient Switcher */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                Active Twin:
              </span>
              <div className="relative">
                <select
                  value={activePatientId ?? ''}
                  onChange={(e) => setActivePatientId(Number(e.target.value))}
                  className="bg-[#0B1220] border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors cursor-pointer appearance-none font-medium min-w-[200px]"
                >
                  {patientsLoading && <option>Loading patients...</option>}
                  {!patientsLoading && patients?.length === 0 && (
                    <option value="">No patients created</option>
                  )}
                  {patients?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name} (#{p.id} • {p.age}y {p.sex} • HbA1c {p.hba1c_pct}%)
                      {p.is_synthetic ? ' [Synthetic]' : ''}
                    </option>
                  ))}
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                  ▼
                </div>
              </div>

              {activePatient?.is_synthetic && (
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  Synthetic demo patient
                </span>
              )}
            </div>

            {/* Right: Active Mode Pill & Mode Toggle (Patient vs Clinician) */}
            <div className="flex items-center gap-3">
              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border border-slate-800 bg-slate-900/60">
                {viewMode === 'clinician' ? (
                  <>
                    <Stethoscope className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-indigo-300 font-semibold">Clinician View:</span>
                    <span className="text-slate-400">R1–R9 rules & pharmacological dosing</span>
                  </>
                ) : (
                  <>
                    <User className="w-3.5 h-3.5 text-teal-400" />
                    <span className="text-teal-300 font-semibold">Patient View:</span>
                    <span className="text-slate-400">Lifestyle habits & doctor questions</span>
                  </>
                )}
              </div>

              <div className="flex items-center bg-[#0B1220] p-1 rounded-lg border border-slate-700">
                <button
                  type="button"
                  onClick={() => setViewMode('patient')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                    viewMode === 'patient'
                      ? 'bg-teal-500 text-[#0B1220] shadow-sm font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <User className="w-3 h-3" />
                  <span>Patient View</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('clinician')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                    viewMode === 'clinician'
                      ? 'bg-indigo-500 text-white shadow-sm font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Stethoscope className="w-3 h-3" />
                  <span>Clinician Mode</span>
                </button>
              </div>
            </div>
          </header>

          {/* Page View Body */}
          <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
            <Outlet />
          </main>
        </div>
      </div>

      {/* 4. Global Toast Notifications Floating Area */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto p-3.5 rounded-lg border shadow-xl backdrop-blur-md text-xs transition-all animate-in slide-in-from-bottom-3 duration-200 ${
              t.type === 'error'
                ? 'bg-[#1a0f18]/90 border-red-500/40 text-red-200'
                : t.type === 'success'
                ? 'bg-[#0f1f1d]/90 border-teal-500/40 text-teal-200'
                : 'bg-[#111C30]/90 border-slate-700 text-slate-200'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h5 className="font-semibold">{t.title}</h5>
                <p className="mt-0.5 text-[11px] opacity-90 leading-relaxed">
                  {t.message}
                </p>
              </div>
              <button
                onClick={() =>
                  setToasts((prev) => prev.filter((item) => item.id !== t.id))
                }
                className="opacity-70 hover:opacity-100 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
