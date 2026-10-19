import React, { createContext, useContext, useEffect, useState } from 'react';

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
  const [activePatientId, setActivePatientIdState] = useState<number | null>(() => {
    const saved = localStorage.getItem('glucotwin_active_patient_id');
    return saved ? parseInt(saved, 10) : null;
  });

  const [viewMode, setViewModeState] = useState<'patient' | 'clinician'>(() => {
    const saved = localStorage.getItem('glucotwin_view_mode');
    return saved === 'clinician' ? 'clinician' : 'patient';
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const setActivePatientId = (id: number | null) => {
    setActivePatientIdState(id);
    if (id !== null) {
      localStorage.setItem('glucotwin_active_patient_id', id.toString());
    } else {
      localStorage.removeItem('glucotwin_active_patient_id');
    }
  };

  const setViewMode = (mode: 'patient' | 'clinician') => {
    setViewModeState(mode);
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
