import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { CareTeamPage } from './pages/CareTeam';
import { TwinOverview } from './pages/TwinOverview';
import { PatientPanel } from './pages/PatientPanel';
import { AlertsPage } from './pages/Alerts';
import { PatientSetup } from './pages/PatientSetup';
import { LogData } from './pages/LogData';
import { PredictionPage } from './pages/Prediction';
import { TwinLearningPage } from './pages/TwinLearning';
import { WhatIfLabPage } from './pages/WhatIfLab';
import { MealToolsPage } from './pages/MealTools';
import { CohortPage } from './pages/Cohort';
import { ClinicalPlanPage } from './pages/ClinicalPlan';
import { TherapyScenariosPage } from './pages/TherapyScenarios';
import { FourWeekPlanPage } from './pages/FourWeekPlan';
import { ClinicianViewPage } from './pages/ClinicianView';
import { ValidationPage } from './pages/Validation';
import { ReplayPage } from './pages/Replay';
import { TimelineWorkspace } from './pages/TimelineWorkspace';
import { SimulationWorkspace } from './pages/SimulationWorkspace';
import { TreatmentWorkspace } from './pages/TreatmentWorkspace';
import { GovernanceWorkspace } from './pages/GovernanceWorkspace';
import { VisitWorkspace } from './pages/VisitWorkspace';
import { MyPlanPage } from './pages/MyPlan';
import { PatientHome } from './pages/PatientHome';
import { MessagesPage } from './pages/Messages';
import { DataImportPage } from './pages/DataImport';
import { ReportsPage } from './pages/ReportsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const HomeRoute: React.FC = () => {
  const { user } = useAuth();
  if (user?.role === 'patient') {
    return <PatientHome />;
  }
  return <PatientPanel />;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Authentication Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Protected Application Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<HomeRoute />} />
                <Route path="home" element={<PatientHome />} />
                <Route path="panel" element={<PatientPanel />} />
                <Route path="twin" element={<TwinOverview />} />
                <Route path="alerts" element={<AlertsPage />} />
                <Route path="patients/setup" element={<PatientSetup />} />

                {/* 5 Unified Primary Workspaces */}
                <Route path="timeline" element={<TimelineWorkspace />} />
                <Route path="simulation" element={<SimulationWorkspace />} />
                <Route path="treatment" element={<TreatmentWorkspace />} />
                <Route path="governance" element={<GovernanceWorkspace />} />

                {/* My Care Team */}
                <Route path="care-team" element={<CareTeamPage />} />

                {/* Clinician Visit Workspace & Patient Care Plan */}
                <Route path="visits" element={<VisitWorkspace />} />
                <Route path="my-plan" element={<MyPlanPage />} />

                {/* Platform Glue: Messages, Data Import, and Weekly Reports */}
                <Route path="messages" element={<MessagesPage />} />
                <Route path="import" element={<DataImportPage />} />
                <Route path="reports" element={<ReportsPage />} />

                {/* Preserved Granular Sub-Routes for Direct Deep Linking & Tests */}
                <Route path="log" element={<LogData />} />
                <Route path="predict" element={<PredictionPage />} />
                <Route path="learning" element={<TwinLearningPage />} />
                <Route path="whatif" element={<WhatIfLabPage />} />
                <Route path="meal-tools" element={<MealToolsPage />} />
                <Route path="cohort" element={<CohortPage />} />
                <Route path="clinical-plan" element={<ClinicalPlanPage />} />
                <Route path="therapy-scenarios" element={<TherapyScenariosPage />} />
                <Route path="plan" element={<FourWeekPlanPage />} />
                <Route path="clinician-view" element={<ClinicianViewPage />} />
                <Route path="validation" element={<ValidationPage />} />
                <Route path="replay" element={<ReplayPage />} />
              </Route>

              {/* Catch-all redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AppProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;

