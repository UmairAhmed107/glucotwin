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
  PlusCircle,
  ShieldAlert,
  Sliders,
  Sparkles,
  Stethoscope,
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
}

const NAV_ITEMS: NavItem[] = [
  // Patient Panel: Clinicians, Dietitians, Admins
  { to: '/panel', label: 'Patient Panel', icon: Users, roles: ['clinician', 'dietitian', 'admin'] },

  // Patient Home: Patients only (Clinicians/Dietitians use /panel and /twin)
  { to: '/', label: 'Patient Home', patientLabel: 'Patient Home', icon: Home, roles: ['patient'] },

  // Core Metabolic Twin: All roles
  { to: '/twin', label: 'Metabolic Profile', patientLabel: 'My Health Summary', icon: Activity, roles: ['patient', 'clinician', 'dietitian', 'admin'] },

  // Fast Meal & Glucose Logging: All roles
  { to: '/log', label: 'Log Meal & Glucose', patientLabel: 'Fast Log Meal', icon: Utensils, roles: ['patient', 'clinician', 'dietitian', 'admin'] },

  // Timeline & Sensor Replay: All roles
  { to: '/timeline', label: 'Timeline & Replay', patientLabel: 'Glucose Diary & Replay', icon: History, roles: ['patient', 'clinician', 'dietitian', 'admin'] },

  // Simulation Lab: All roles
  { to: '/simulation', label: 'Scenario Planner', patientLabel: 'Meal & Walk Forecast', icon: Sliders, roles: ['patient', 'clinician', 'dietitian', 'admin'] },

  // Clinician Visit Workspace: Clinicians and Admins only (Excluded for Dietitians and Patients)
  { to: '/visits', label: 'Visit Workspace', icon: Stethoscope, roles: ['clinician', 'admin'], clinicianOnly: true },

  // Acute Metabolic Alerts: Clinicians and Admins only (Excluded for Dietitians and Patients)
  { to: '/alerts', label: 'Alerts Center', icon: ShieldAlert, roles: ['clinician', 'admin'], clinicianOnly: true },

  // 4-Week Care Plan: All roles
  { to: '/my-plan', label: 'My Care Plan', patientLabel: 'My 4-Week Plan', icon: ClipboardList, roles: ['patient', 'clinician', 'dietitian', 'admin'] },

  // Treatment & Lifestyle Studio: All roles
  { to: '/treatment', label: 'Doctor Advice & Plan', patientLabel: 'Doctor Advice & Plan', icon: Sparkles, roles: ['patient', 'clinician', 'dietitian', 'admin'] },

  // Care Team: All roles
  { to: '/care-team', label: 'My Care Team', patientLabel: 'My Care Team', icon: Users, roles: ['patient', 'clinician', 'dietitian', 'admin'] },

  // Care Team Messaging: All roles
  { to: '/messages', label: 'Messages', patientLabel: 'Care Team Chat', icon: MessageSquare, roles: ['patient', 'clinician', 'dietitian', 'admin'] },

  // Ingest CGM & Wearables: All roles
  { to: '/import', label: 'Import Data', patientLabel: 'Data Import', icon: UploadCloud, roles: ['patient', 'clinician', 'dietitian', 'admin'] },

  // Weekly Metabolic Reports: All roles
  { to: '/reports', label: 'Weekly Reports', patientLabel: 'Weekly Reports', icon: FileText, roles: ['patient', 'clinician', 'dietitian', 'admin'] },

  // About & Model Info: Clinicians, Dietitians, Admins
  { to: '/governance', label: 'System Architecture & Specs', icon: Database, roles: ['clinician', 'dietitian', 'admin'] },
];

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Metabolic Profile',
  '/panel': 'Clinical Patient Panel',
  '/visits': 'Clinician Visit Workspace',
  '/my-plan': 'My 4-Week Care Plan',
  '/alerts': 'Metabolic Alerts Center',
  '/timeline': 'Glucose Timeline & Sensor Replay',
  '/simulation': 'Scenario Planner & Forecasting',
  '/treatment': 'Doctor Advice & Care Plan',
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
  const { activePatientId, setActivePatientId, viewMode, isSidebarCollapsed, toggleSidebar } = useApp();
  const { user, logout } = useAuth();
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
                {effectiveRole === 'patient'
                  ? 'Patient Portal'
                  : effectiveRole === 'dietitian'
                  ? 'Dietitian Nutrition Suite'
                  : 'Clinical Decision Support'}
              </div>
            )}
            {visibleNavItems.map((item, idx) => {
              const Icon = item.icon;
              const displayLabel =
                viewMode === 'patient' && item.patientLabel
                  ? item.patientLabel
                  : item.label;

              // If entering clinician-only tools in the nav, add a small separator
              const isFirstClinicianTool =
                item.clinicianOnly &&
                (idx === 0 || !visibleNavItems[idx - 1].clinicianOnly);

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
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-teal-400 hover:text-teal-300 hover:bg-teal-500/10 border border-teal-500/20 transition-all cursor-pointer ${
                isSidebarCollapsed ? 'justify-center' : ''
              }`}
              title="Add New Patient"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              {!isSidebarCollapsed && <span>Add Patient</span>}
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
                Active Patient:
              </span>
              {isPatientUser ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0B1220] border border-slate-700/80 text-xs font-medium text-slate-200">
                  <User className="w-3.5 h-3.5 text-teal-400" />
                  <span>{activePatient?.display_name || user?.full_name || 'My Record'}</span>
                  {activePatient && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      (#{activePatient.id} • HbA1c {activePatient.hba1c_pct}%)
                    </span>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={activePatientId ?? ''}
                    onChange={(e) => setActivePatientId(Number(e.target.value))}
                    className="bg-[#0B1220] border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors cursor-pointer appearance-none font-medium min-w-[200px]"
                  >
                    {patientsLoading && <option>Loading patients...</option>}
                    {!patientsLoading && patients?.length === 0 && (
                      <option value="">No patients available</option>
                    )}
                    {patients?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.display_name} (#{p.id} • {p.age}y {p.sex} • HbA1c {p.hba1c_pct}%)
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                    ▼
                  </div>
                </div>
              )}
            </div>

            {/* Right: Authenticated User Badge & Logout (Persona toggle removed per prompt) */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border border-slate-800 bg-slate-900/60">
                {effectiveRole === 'patient' ? (
                  <>
                    <User className="w-3.5 h-3.5 text-teal-400" />
                    <span className="text-teal-300 font-semibold">Patient Portal:</span>
                    <span className="text-slate-400">Personal Simulations</span>
                  </>
                ) : effectiveRole === 'dietitian' ? (
                  <>
                    <Utensils className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-amber-300 font-semibold">Dietitian View:</span>
                    <span className="text-slate-400">Nutrition & Lifestyle Guidance</span>
                  </>
                ) : (
                  <>
                    <Stethoscope className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-indigo-300 font-semibold capitalize">{user?.role || 'Clinician'}:</span>
                    <span className="text-slate-400">CDS & Safety Governor Active</span>
                  </>
                )}
              </div>

              {/* Alert Notification Bell & Dropdown for Clinicians and Admins */}
              {!isPatientUser && !isDietitianUser && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsAlertsOpen(!isAlertsOpen)}
                    className="relative p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700"
                    title="Clinical Alerts"
                    aria-label="Clinical Alerts"
                  >
                    <Bell className="w-4 h-4" />
                    {unreadAlertsCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-[#111C30]">
                        {unreadAlertsCount > 99 ? '99+' : unreadAlertsCount}
                      </span>
                    )}
                  </button>

                  {/* Backdrop to close */}
                  {isAlertsOpen && (
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsAlertsOpen(false)}
                    />
                  )}

                  {/* Dropdown panel */}
                  {isAlertsOpen && (
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-[#0F172A] border border-slate-700 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 text-rose-400" />
                          <span className="text-xs font-bold text-slate-200">Active Metabolic Alerts</span>
                        </div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          {unreadAlertsCount} Open
                        </span>
                      </div>

                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/80">
                        {openAlerts.length === 0 ? (
                          <div className="p-6 text-center text-xs text-slate-400">
                            <Check className="w-8 h-8 mx-auto mb-2 text-emerald-400/80" />
                            All linked patients are within target metabolic boundaries.
                          </div>
                        ) : (
                          openAlerts.slice(0, 5).map((a) => (
                            <div key={a.id} className="p-3 hover:bg-slate-800/50 transition flex items-start justify-between gap-3">
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
                                  <span className="text-[11px] font-bold text-slate-200 truncate">
                                    {a.patient_name || `Patient #${a.patient_id}`}
                                  </span>
                                  <span className="text-[9px] uppercase px-1.5 py-0.2 rounded font-mono font-bold bg-slate-800 text-slate-400">
                                    {a.severity}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                                  {a.message}
                                </p>
                                <span className="text-[9px] text-slate-500 mt-1 block">
                                  {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => ackMutation.mutate(a.id)}
                                disabled={ackMutation.isPending}
                                className="px-2 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded text-[10px] font-medium transition shrink-0"
                                title="Acknowledge alert"
                              >
                                Ack
                              </button>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="p-2 bg-slate-900/90 border-t border-slate-800 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setIsAlertsOpen(false);
                            navigate('/alerts');
                          }}
                          className="w-full py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 hover:text-teal-200 text-xs font-semibold transition"
                        >
                          View All in Alerts Center →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* User Profile Info */}
              <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-500/20 to-indigo-500/20 border border-teal-500/30 text-teal-300 flex items-center justify-center text-xs font-bold shrink-0">
                  {user?.full_name ? user.full_name[0].toUpperCase() : 'U'}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-xs font-semibold text-slate-200 leading-tight truncate max-w-[140px]">
                    {user?.full_name || 'Guest User'}
                  </p>
                  <p className="text-[10px] text-teal-400/90 font-mono capitalize leading-none">
                    {user?.role || 'user'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    logout();
                    navigate('/login');
                  }}
                  className="p-1.5 ml-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors border border-transparent hover:border-rose-500/20"
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
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
