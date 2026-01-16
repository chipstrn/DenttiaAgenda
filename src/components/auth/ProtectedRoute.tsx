"use client";

import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { ChangePasswordModal } from './ChangePasswordModal';
import { Activity } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'doctor' | 'receptionist';
  requiredPermission?: string;
}

export const ProtectedRoute = ({ children, requiredRole, requiredPermission }: ProtectedRouteProps) => {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { profile, loading: profileLoading, isAdmin, hasPermission, mustChangePassword } = useUserRole();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (profile && mustChangePassword) {
      setShowPasswordModal(true);
    }
  }, [profile, mustChangePassword]);

  const handlePasswordChanged = () => {
    setShowPasswordModal(false);
    window.location.reload();
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-ios-gray-50">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-ios-blue to-ios-indigo flex items-center justify-center shadow-ios-lg mb-4 animate-pulse">
          <Activity className="h-8 w-8 text-white" />
        </div>
        <div className="h-2 w-32 bg-ios-gray-200 rounded-full overflow-hidden">
          <div className="h-full w-1/2 bg-ios-blue rounded-full animate-[loading_1s_ease-in-out_infinite]" />
        </div>
        <p className="text-ios-gray-500 mt-4 font-medium">Cargando...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Verificar si el usuario está activo
  if (profile && !profile.is_active) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-ios-gray-50 p-6">
        <div className="ios-card p-8 max-w-md text-center">
          <div className="h-16 w-16 rounded-2xl bg-ios-red/15 flex items-center justify-center mx-auto mb-4">
            <Activity className="h-8 w-8 text-ios-red" />
          </div>
          <h2 className="text-xl font-bold text-ios-gray-900 mb-2">Cuenta Desactivada</h2>
          <p className="text-ios-gray-500 mb-6">Tu cuenta ha sido desactivada. Contacta al administrador para más información.</p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-full h-12 rounded-xl bg-ios-red text-white font-semibold"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  // Verificar rol requerido
  if (requiredRole && profile?.role !== requiredRole && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  // Verificar permiso requerido
  if (requiredPermission && !hasPermission(requiredPermission) && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <ChangePasswordModal 
        open={showPasswordModal} 
        onSuccess={handlePasswordChanged}
      />
      {children}
    </>
  );
};