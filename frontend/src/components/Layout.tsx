import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Bell,
  BookOpen,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Cpu,
  Database,
  FileText,
  FlaskConical,
  GraduationCap,
  History,
  Home,
  Layers,
  LineChart,
  LogOut,
  MessageSquare,
  Plus,
  PlusCircle,
  Search,
  ShieldAlert,
  Sliders,
  Sparkles,
  Stethoscope,
  Sun,
  Moon,
  TrendingUp,
  UploadCloud,
  User,
  Users,
  Utensils,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { usePatients, useAlerts, useAcknowledgeAlert } from '../api/queries';
import { subscribeToToasts } from '../api/client';
import { UserRole } from '../api/types';

interface NavItem {
  to: string;
  label: string;
  patientLabel?: string;
  icon: React.ElementType;
  roles?: UserRole[];
  clinicianOnly?: boolean;
  group?: 'core' | 'tools';
}

const NAV_ITEMS: NavItem[] = [
  // --- CORE WORKSPACES ---
  // Patient Panel: Clinicians, Dietitians, Admins
  { to: '/panel', label: 'Patient Panel & Triage', icon: Users, roles: ['clinician', 'dietitian', 'admin'], group: 'core' },

  // Patient Home: Patients only
  { to: '/', label: 'Patient Home', patientLabel: 'Today’s Overview', icon: Home, roles: ['patient'], group: 'core' },

  // Fast Meal & Glucose Logging: All roles
  { to: '/log', label: 'Log Meal & Glucose', patientLabel: 'Log Meal & Glucose', icon: Utensils, roles: ['patient', 'clinician', 'dietitian', 'admin'], group: 'core' },

  // Simulation Lab: All roles
  { to: '/simulation', label: 'Scenario Planner', patientLabel: 'Meal & Walk Simulator', icon: Sliders, roles: ['patient', 'clinician', 'dietitian', 'admin'], group: 'core' },

  // Clinician Visit Workspace: Clinicians and Admins only
  { to: '/visits', label: 'Clinical Visit Workspace', icon: Stethoscope, roles: ['clinician', 'admin'], clinicianOnly: true, group: 'core' },

  // Acute Metabolic Alerts: Clinicians and Admins only
  { to: '/alerts', label: 'Alerts Center', icon: ShieldAlert, roles: ['clinician', 'admin'], clinicianOnly: true, group: 'core' },

  // Treatment & Doctor Advice: All roles
  { to: '/treatment', label: 'Clinical Decision Hub (CDS)', patientLabel: 'Care Plan & Doctor Advice', icon: Sparkles, roles: ['patient', 'clinician', 'dietitian', 'admin'], group: 'core' },

  // Core Metabolic Twin: All roles
  { to: '/twin', label: 'Twin Tuning & Calibration', patientLabel: 'My Digital Twin', icon: Activity, roles: ['patient', 'clinician', 'dietitian', 'admin'], group: 'core' },

  // --- SECONDARY DATA & TOOLS ---
  // Timeline & Sensor Replay: All roles
  { to: '/timeline', label: 'Timeline & Sensor Replay', patientLabel: 'Glucose Timeline', icon: History, roles: ['patient', 'clinician', 'dietitian', 'admin'], group: 'tools' },

  // Care Team Messaging: All roles
  { to: '/messages', label: 'Care Team Chat', patientLabel: 'Care Team Chat', icon: MessageSquare, roles: ['patient', 'clinician', 'dietitian', 'admin'], group: 'tools' },

  // Care Team Directory: All roles
  { to: '/care-team', label: 'Care Team Directory', patientLabel: 'My Care Team', icon: Users, roles: ['patient', 'clinician', 'dietitian', 'admin'], group: 'tools' },

  // Ingest CGM & Wearables: All roles
  { to: '/import', label: 'Import Sensor Data', patientLabel: 'Import Data', icon: UploadCloud, roles: ['patient', 'clinician', 'dietitian', 'admin'], group: 'tools' },

  // Weekly Metabolic Reports: All roles
  { to: '/reports', label: 'Weekly Reports', patientLabel: 'Weekly Reports', icon: FileText, roles: ['patient', 'clinician', 'dietitian', 'admin'], group: 'tools' },

  // About & Model Info: Clinicians, Dietitians, Admins
  { to: '/governance', label: 'System Architecture', icon: Database, roles: ['clinician', 'dietitian', 'admin'], group: 'tools' },
];

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Metabolic Profile',
  '/panel': 'Clinical Patient Panel',
  '/visits': 'Clinician Visit Workspace',
  '/my-plan': 'My 4-Week Care Plan',
  '/alerts': 'Metabolic Alerts Center',
  '/timeline': 'Glucose Timeline & Sensor Replay',
  '/simulation': 'Scenario Planner & Forecasting',
  '/treatment': 'Clinical Decision Support & Care Hub',
  '/governance': 'System Architecture & Specifications',
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
  '/messages': 'Care Team Messages',
  '/import': 'Clinical Data Import',
  '/reports': 'Weekly Metabolic Reports & Interoperability',
};

export const Layout: React.FC = () => {
  const { activePatientId, setActivePatientId, viewMode, isSidebarCollapsed, toggleSidebar, theme, toggleTheme } = useApp();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Search input state in top bar
  const [navSearch, setNavSearch] = useState('');

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
  const effectiveRole: UserRole = (user?.role as UserRole) || (viewMode === 'patient' ? 'patient' : 'clinician');
  const isPatientUser = effectiveRole === 'patient';
  const isDietitianUser = effectiveRole === 'dietitian';

  // Alerts notification state for clinicians / providers
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const { data: openAlerts = [] } = useAlerts({ status: 'open' });
  const ackMutation = useAcknowledgeAlert();
  const unreadAlertsCount = openAlerts.length;

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.roles && !item.roles.includes(effectiveRole) && effectiveRole !== 'admin') {
      return false;
    }
    if (isPatientUser && item.clinicianOnly) {
      return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col min-h-screen bg-[#030303] text-zinc-100 font-sans bg-dot-grid">
      {/* 1. Top Header Bar (Pixel-matching Reference Image 1) */}
      <header className="h-16 bg-[#000000]/95 border-b border-zinc-800/80 px-4 md:px-6 flex items-center justify-between gap-4 backdrop-blur-xl sticky top-0 z-40">
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white shadow-sm shrink-0">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm tracking-tight text-white">
                GlucoTwin OS
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-300 border border-zinc-750 font-semibold tracking-wider">
                {effectiveRole === 'patient' ? 'METABOLIC TWIN' : effectiveRole === 'dietitian' ? 'NUTRITION SUITE' : 'CLINICAL CDS'}
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 font-medium leading-none mt-0.5">
              Personalised Metabolic Digital Twin & Clinical Operations Console
            </p>
          </div>
        </div>

        {/* Center Search Bar with shortcut '/' */}
        <div className="hidden md:flex items-center flex-1 max-w-md mx-4">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={navSearch}
              onChange={(e) => setNavSearch(e.target.value)}
              placeholder="Search patients, glucose telemetry, meals..."
              className="w-full bg-zinc-950/80 border border-zinc-800/90 rounded-full pl-9 pr-9 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all font-normal"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
              /
            </span>
          </div>
        </div>

        {/* Right Section: Patient Switcher, Alerts, Theme Sun, User Pill */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Active Patient Switcher */}
          <div className="flex items-center">
            {isPatientUser ? (
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-semibold text-white truncate max-w-[120px]">
                  {activePatient?.display_name || user?.full_name || 'My Record'}
                </span>
                {activePatient && (
                  <span className="text-[10px] font-mono text-zinc-400">
                    HbA1c {activePatient.hba1c_pct}%
                  </span>
                )}
              </div>
            ) : (
              <div className="relative">
                <select
                  value={activePatientId ?? ''}
                  onChange={(e) => setActivePatientId(Number(e.target.value))}
                  className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-full pl-3.5 pr-8 py-1.5 focus:outline-none focus:border-zinc-600 transition-colors cursor-pointer appearance-none font-medium min-w-[150px] sm:min-w-[190px]"
                >
                  {patientsLoading && <option>Loading...</option>}
                  {patients?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name} (#{p.id} • {p.hba1c_pct}%)
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400 text-[10px]">
                  ▼
                </div>
              </div>
            )}
          </div>

          {/* Alert Notification Bell for Clinicians and Admins */}
          {!isPatientUser && !isDietitianUser && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsAlertsOpen(!isAlertsOpen)}
                className="w-9 h-9 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors relative"
                title="Clinical Alerts"
                aria-label="Clinical Alerts"
              >
                <Bell className="w-4 h-4" />
                {unreadAlertsCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-black">
                    {unreadAlertsCount > 99 ? '99+' : unreadAlertsCount}
                  </span>
                )}
              </button>

              {/* Backdrop */}
              {isAlertsOpen && (
                <div className="fixed inset-0 z-40" onClick={() => setIsAlertsOpen(false)} />
              )}

              {/* Dropdown panel */}
              {isAlertsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[#09090b] border border-zinc-800 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-4 py-3 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-400" />
                      <span className="text-xs font-bold text-white">Active Metabolic Alerts</span>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      {unreadAlertsCount} Open
                    </span>
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-zinc-850">
                    {openAlerts.length === 0 ? (
                      <div className="p-6 text-center text-xs text-zinc-400">
                        <Check className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                        All linked patients are within target metabolic boundaries.
                      </div>
                    ) : (
                      openAlerts.slice(0, 5).map((a) => (
                        <div key={a.id} className="p-3 hover:bg-zinc-900/60 transition flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  a.severity === 'critical'
                                    ? 'bg-rose-500 animate-pulse'
                                    : a.severity === 'warning'
                                    ? 'bg-amber-500'
                                    : 'bg-blue-500'
                                }`}
                              />
                              <span className="text-[11px] font-bold text-zinc-200 truncate">
                                {a.patient_name || `Patient #${a.patient_id}`}
                              </span>
                              <span className="text-[9px] uppercase px-1.5 py-0.2 rounded font-mono font-bold bg-zinc-900 text-zinc-400 border border-zinc-800">
                                {a.severity}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                              {a.message}
                            </p>
                            <span className="text-[9px] text-zinc-500 mt-1 block">
                              {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => ackMutation.mutate(a.id)}
                            disabled={ackMutation.isPending}
                            className="px-2 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded text-[10px] font-medium transition shrink-0"
                          >
                            Ack
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-2.5 bg-zinc-950 border-t border-zinc-800 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAlertsOpen(false);
                        navigate('/alerts');
                      }}
                      className="w-full py-1.5 px-3 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/80 text-xs font-semibold transition"
                    >
                      View All in Alerts Center →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Theme Sun/Moon Toggle Button (Matches reference UI) */}
          <button
            id="theme-toggle-btn"
            type="button"
            onClick={toggleTheme}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              theme === 'dark'
                ? 'bg-zinc-900/80 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                : 'bg-slate-100 border border-slate-300 text-indigo-600 hover:text-indigo-800 hover:border-slate-400 shadow-sm'
            }`}
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600 fill-indigo-100" />
            )}
          </button>

          {/* User Profile Pill */}
          <div className="flex items-center gap-2 pl-2 border-l border-zinc-800">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-zinc-950 border border-zinc-850 text-xs">
              <div className="w-6 h-6 rounded-full bg-white text-black font-bold flex items-center justify-center text-xs shrink-0">
                {user?.full_name ? user.full_name[0].toUpperCase() : 'U'}
              </div>
              <span className="font-semibold text-white truncate max-w-[110px] hidden sm:inline">
                {user?.full_name?.split(' ')[0] || 'User'}
              </span>
              <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded-full border border-zinc-800 hidden md:inline">
                {effectiveRole === 'patient'
                  ? `Pt #${activePatientId || 1}`
                  : effectiveRole === 'clinician'
                  ? 'Clinician'
                  : 'Dietitian'}
              </span>
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="text-zinc-500 hover:text-rose-400 p-0.5 transition-colors ml-0.5"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container: Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Collapsible Dark Sidebar */}
        <aside
          className={`bg-[#000000] border-r border-zinc-800/80 transition-all duration-300 flex flex-col shrink-0 select-none ${
            isSidebarCollapsed ? 'w-16' : 'w-64'
          }`}
        >
          {/* Sidebar Collapse Toggle */}
          <div className="h-12 px-4 flex items-center justify-between border-b border-zinc-850">
            {!isSidebarCollapsed && (
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Operations Menu
              </span>
            )}
            <button
              onClick={toggleSidebar}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors mx-auto"
              title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
            {visibleNavItems.map((item, idx) => {
              const Icon = item.icon;
              const displayLabel =
                viewMode === 'patient' && item.patientLabel
                  ? item.patientLabel
                  : item.label;

              const isFirstTool =
                item.group === 'tools' &&
                (idx === 0 || visibleNavItems[idx - 1].group !== 'tools');

              return (
                <React.Fragment key={item.to}>
                  {isFirstTool && !isSidebarCollapsed && (
                    <div className="pt-3 pb-1.5 px-3 flex items-center justify-between border-t border-zinc-800/80 my-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                        {isPatientUser ? 'Data & Care Team' : 'Clinical Data & Tools'}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 bg-zinc-900 text-zinc-400 rounded border border-zinc-800 font-mono">
                        TOOLS
                      </span>
                    </div>
                  )}
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-zinc-900 text-white border border-zinc-700 shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                      }`
                    }
                    title={isSidebarCollapsed ? displayLabel : undefined}
                  >
                    <Icon className="w-4 h-4 shrink-0 text-zinc-300" />
                    {!isSidebarCollapsed && <span className="truncate flex-1">{displayLabel}</span>}
                    {!isSidebarCollapsed && item.clinicianOnly && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-900 text-zinc-400 font-mono border border-zinc-800">
                        MD
                      </span>
                    )}
                  </NavLink>
                </React.Fragment>
              );
            })}
          </nav>

          {/* Sidebar Footer: Add Patient */}
          <div className="p-3 border-t border-zinc-850">
            <button
              onClick={() => navigate('/patients/setup')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-full text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer ${
                isSidebarCollapsed ? 'justify-center px-0' : ''
              }`}
              title="Add New Patient Profile"
            >
              <Plus className="w-4 h-4 shrink-0" />
              {!isSidebarCollapsed && <span>Add Patient</span>}
            </button>
          </div>
        </aside>

        {/* Main Workspace Body */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Floating Global Toasts */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto p-4 rounded-2xl border shadow-2xl backdrop-blur-xl text-xs transition-all animate-in slide-in-from-bottom-3 duration-200 ${
              t.type === 'error'
                ? 'bg-[#09090b] border-rose-500/50 text-rose-200'
                : t.type === 'success'
                ? 'bg-[#09090b] border-emerald-500/50 text-emerald-200'
                : 'bg-[#09090b] border-zinc-800 text-zinc-200'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h5 className="font-bold text-white">{t.title}</h5>
                <p className="mt-1 text-[11px] text-zinc-400 leading-relaxed">
                  {t.message}
                </p>
              </div>
              <button
                onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
                className="text-zinc-500 hover:text-white p-0.5"
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
