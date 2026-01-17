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

const App = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-gray-100">
          <div className="h-16 w-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Configuración Incompleta</h1>
          <p className="text-gray-500 mb-6 leading-relaxed">
            La aplicación no puede iniciar porque faltan las variables de entorno de Supabase.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 text-left text-sm font-mono text-gray-600 mb-6 border border-gray-200">
            <div className="flex items-center gap-2 mb-1">
              <div className={`h-2 w-2 rounded-full ${supabaseUrl ? 'bg-green-500' : 'bg-red-500'}`} />
              <span>VITE_SUPABASE_URL</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${supabaseKey ? 'bg-green-500' : 'bg-red-500'}`} />
              <span>VITE_SUPABASE_ANON_KEY</span>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Por favor configura estas variables en el panel de Netlify bajo <span className="font-medium">Site configuration {'>'} Environment variables</span>.
          </p>
        </div>
      </div>
    );
  }

  return (
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
};

export default App;