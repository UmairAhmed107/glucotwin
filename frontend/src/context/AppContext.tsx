import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

interface AppContextType {
  activePatientId: number | null;
  setActivePatientId: (id: number | null) => void;
  viewMode: 'patient' | 'clinician';
  setViewMode: (mode: 'patient' | 'clinician') => void;
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
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
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
