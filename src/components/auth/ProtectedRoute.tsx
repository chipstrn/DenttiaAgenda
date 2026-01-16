"use client";

import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);

        if (session) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*, roles(name, permissions)')
            .eq('id', session.user.id)
            .single();

          setProfile(profileData);
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*, roles(name, permissions)')
          .eq('id', session.user.id)
          .single();
        setProfile(profileData);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

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

  // Verificar si debe cambiar contraseña (excepto en la página de cambio)
  if (profile?.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  // Verificar roles si se especificaron
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = profile?.role || 'doctor';
    if (!allowedRoles.includes(userRole) && userRole !== 'admin') {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};

// Hook para obtener el perfil del usuario actual
export const useUserProfile = () => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from('profiles')
            .select('*, roles(name, permissions)')
            .eq('id', user.id)
            .single();
          setProfile(data);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const isAdmin = profile?.role === 'admin';
  const isRecepcion = profile?.role === 'recepcion';

  return { profile, loading, isAdmin, isRecepcion };
};