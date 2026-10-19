import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/Layout';
import { TwinOverview } from './pages/TwinOverview';
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
import { TimelinePage } from './pages/Timeline';
import { ClinicianViewPage } from './pages/ClinicianView';
import { ValidationPage } from './pages/Validation';
import { ReplayPage } from './pages/Replay';
import { TimelineWorkspace } from './pages/TimelineWorkspace';
import { SimulationWorkspace } from './pages/SimulationWorkspace';
import { TreatmentWorkspace } from './pages/TreatmentWorkspace';
import { GovernanceWorkspace } from './pages/GovernanceWorkspace';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<TwinOverview />} />
              <Route path="patients/setup" element={<PatientSetup />} />

              {/* 5 Unified Primary Workspaces */}
              <Route path="timeline" element={<TimelineWorkspace />} />
              <Route path="simulation" element={<SimulationWorkspace />} />
              <Route path="treatment" element={<TreatmentWorkspace />} />
              <Route path="governance" element={<GovernanceWorkspace />} />

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
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </QueryClientProvider>
  );
};

export default App;
