import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
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
import FinanceAudit from "./pages/FinanceAudit";
import CashRegisterClose from "./pages/CashRegisterClose";
import StaffManagement from "./pages/StaffManagement";
import DoctorCommissions from "./pages/DoctorCommissions";
import Inventory from "./pages/Inventory";
import Reports from "./pages/Reports";
import ReceptionFinance from "./pages/ReceptionFinance";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
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
              <ProtectedRoute allowedRoles={['doctor', 'admin']}>
                <Treatments />
              </ProtectedRoute>
            } />

            <Route path="/doctors" element={
              <ProtectedRoute allowedRoles={['doctor', 'admin']}>
                <Doctors />
              </ProtectedRoute>
            } />

            <Route path="/prescriptions" element={
              <ProtectedRoute allowedRoles={['doctor', 'admin']}>
                <Prescriptions />
              </ProtectedRoute>
            } />

            {/* Cash Register - Recepción */}
            <Route path="/cash-register" element={
              <ProtectedRoute allowedRoles={['recepcion', 'admin']}>
                <CashRegisterClose />
              </ProtectedRoute>
            } />

            {/* Finance & Admin */}
            <Route path="/finance" element={
              <ProtectedRoute allowedRoles={['admin', 'recepcion']}>
                <Finance />
              </ProtectedRoute>
            } />

            <Route path="/inventory" element={
              <ProtectedRoute allowedRoles={['admin', 'recepcion', 'doctor']}>
                <Inventory />
              </ProtectedRoute>
            } />

            <Route path="/reception-finance" element={
              <ProtectedRoute allowedRoles={['recepcion', 'admin']}>
                <ReceptionFinance />
              </ProtectedRoute>
            } />

            <Route path="/finance-audit" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <FinanceAudit />
              </ProtectedRoute>
            } />

            <Route path="/finance/commissions" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <DoctorCommissions />
              </ProtectedRoute>
            } />

            <Route path="/staff" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <StaffManagement />
              </ProtectedRoute>
            } />

            <Route path="/reports" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Reports />
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
    </AuthProvider>
  </QueryClientProvider>
);

export default App;