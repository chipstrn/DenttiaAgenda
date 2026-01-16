"use client";

import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { session, profile, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ios-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-ios-blue mx-auto mb-3" />
          <p className="text-ios-gray-500 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Verificar roles si se especificaron
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = profile?.role || 'doctor';
    // Admin siempre tiene acceso
    if (!isAdmin && !allowedRoles.includes(userRole)) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};

// Hook para obtener el perfil del usuario actual (ahora usa el contexto)
export const useUserProfile = () => {
  const { profile, loading, isAdmin, isRecepcion } = useAuth();
  return { profile, loading, isAdmin, isRecepcion };
};