import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAuditorValid, setIsAuditorValid] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      if (session) {
        // Check if user is an auditor
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (profile?.role === 'auditor') {
          // Verify audit session is valid
          const { data: auditSession } = await supabase
            .from('audit_sessions')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('is_active', true)
            .gte('expires_at', new Date().toISOString())
            .is('revoked_at', null)
            .single();

          if (!auditSession) {
            setIsAuditorValid(false);
            toast.error('Tu sesión de auditoría ha expirado');
            await supabase.auth.signOut();
          } else {
            // Log auditor page access
            await supabase.rpc('log_auditor_access', { 
              p_entity_type: 'page_view',
              p_entity_id: null
            }).catch(() => {}); // Ignore errors
          }
        }
      }
      
      setLoading(false);
    };

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ios-gray-50">
        <div className="text-center">
          <div className="h-10 w-10 border-3 border-ios-blue/30 border-t-ios-blue rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-ios-gray-500 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!session || !isAuditorValid) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};