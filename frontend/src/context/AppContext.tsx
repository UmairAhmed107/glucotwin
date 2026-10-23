import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

export interface AppContextType {
  activePatientId: number | null;
  setActivePatientId: (id: number | null) => void;
  viewMode: 'patient' | 'clinician';
  setViewMode: (mode: 'patient' | 'clinician') => void;
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  theme?: 'dark' | 'light';
  toggleTheme?: () => void;
  setTheme?: (theme: 'dark' | 'light') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  let authUser = null;
  try {
    const auth = useAuth();
    authUser = auth?.user ?? null;
  } catch {
    // If rendered outside AuthProvider (e.g. in some isolated unit tests)
  }

  const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('glucotwin_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
      root.style.colorScheme = 'dark';
    }
    localStorage.setItem('glucotwin_theme', theme);
  }, [theme]);

  const setTheme = (t: 'dark' | 'light') => {
    setThemeState(t);
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const [activePatientId, setActivePatientIdState] = useState<number | null>(() => {
    const saved = localStorage.getItem('glucotwin_active_patient_id');
    return saved ? parseInt(saved, 10) : null;
  });

  const [fallbackViewMode, setFallbackViewMode] = useState<'patient' | 'clinician'>(() => {
    const saved = localStorage.getItem('glucotwin_view_mode');
    return saved === 'clinician' ? 'clinician' : 'patient';
  });

  // UI mode derived strictly from logged-in user role
  const viewMode: 'patient' | 'clinician' = authUser
    ? authUser.role === 'patient'
      ? 'patient'
      : 'clinician'
    : fallbackViewMode;

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // If authenticated user is a patient, automatically lock active patient to their own profile
  useEffect(() => {
    if (authUser?.role === 'patient' && authUser.patient_id) {
      setActivePatientIdState(authUser.patient_id);
      localStorage.setItem('glucotwin_active_patient_id', authUser.patient_id.toString());
    }
  }, [authUser]);

  const setActivePatientId = (id: number | null) => {
    // Patients cannot switch away from their own patient profile
    if (authUser?.role === 'patient' && authUser.patient_id && id !== authUser.patient_id) {
      return;
    }
    setActivePatientIdState(id);
    if (id !== null) {
      localStorage.setItem('glucotwin_active_patient_id', id.toString());
    } else {
      localStorage.removeItem('glucotwin_active_patient_id');
    }
  };

  const setViewMode = (mode: 'patient' | 'clinician') => {
    setFallbackViewMode(mode);
    localStorage.setItem('glucotwin_view_mode', mode);
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  return (
    <AppContext.Provider
      value={{
        activePatientId,
        setActivePatientId,
        viewMode,
        setViewMode,
        isSidebarCollapsed,
        toggleSidebar,
        theme,
        toggleTheme,
        setTheme,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    return {
      activePatientId: null,
      setActivePatientId: () => {},
      viewMode: 'patient',
      setViewMode: () => {},
      isSidebarCollapsed: false,
      toggleSidebar: () => {},
      theme: 'dark',
      toggleTheme: () => {},
      setTheme: () => {},
    };
  }
  return {
    ...context,
    theme: context.theme ?? 'dark',
    toggleTheme: context.toggleTheme ?? (() => {}),
    setTheme: context.setTheme ?? (() => {}),
  };
}
