import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Patients from "./pages/Patients";
import PatientIntake from "./pages/PatientIntake";
import PatientAnamnesis from "./pages/PatientAnamnesis";
import PatientExam from "./pages/PatientExam";
import Agenda from "./pages/Agenda";
import Treatments from "./pages/Treatments";
import Doctors from "./pages/Doctors";
import Prescriptions from "./pages/Prescriptions";
import Finance from "./pages/Finance";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/agenda" element={
            <ProtectedRoute>
              <Agenda />
            </ProtectedRoute>
          } />
          
          <Route path="/patients" element={
            <ProtectedRoute>
              <Patients />
            </ProtectedRoute>
          } />
          
          {/* Patient Flow */}
          <Route path="/patient/new" element={
            <ProtectedRoute>
              <PatientIntake />
            </ProtectedRoute>
          } />
          
          <Route path="/patient/:patientId/intake" element={
            <ProtectedRoute>
              <PatientIntake />
            </ProtectedRoute>
          } />
          
          <Route path="/patient/:patientId/anamnesis" element={
            <ProtectedRoute>
              <PatientAnamnesis />
            </ProtectedRoute>
          } />
          
          <Route path="/patient/:patientId/exam" element={
            <ProtectedRoute>
              <PatientExam />
            </ProtectedRoute>
          } />
          
          {/* Clinical */}
          <Route path="/treatments" element={
            <ProtectedRoute>
              <Treatments />
            </ProtectedRoute>
          } />
          
          <Route path="/doctors" element={
            <ProtectedRoute>
              <Doctors />
            </ProtectedRoute>
          } />
          
          <Route path="/prescriptions" element={
            <ProtectedRoute>
              <Prescriptions />
            </ProtectedRoute>
          } />
          
          {/* Admin */}
          <Route path="/finance" element={
            <ProtectedRoute>
              <Finance />
            </ProtectedRoute>
          } />
          
          <Route path="/settings" element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;