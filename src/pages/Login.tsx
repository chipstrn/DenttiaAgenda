"use client";

import { useEffect, useState } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Activity, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const Login = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) navigate('/');
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'SIGNED_IN' && session) {
        navigate('/');
      }
      if (event === 'SIGNED_OUT') {
        setSession(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden border border-slate-100">
        <div className="p-8 pb-0 text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-blue-50 mb-4">
            <Activity className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Dental ERP</h1>
          <p className="text-slate-500 mt-2 text-sm">Ingresa a tu cuenta para gestionar la clínica</p>
        </div>
        
        <div className="p-8 pt-6">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <Auth
            supabaseClient={supabase}
            providers={[]} 
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#2563eb',
                    brandAccent: '#1d4ed8',
                  },
                },
              },
            }}
            theme="light"
            localization={{
              variables: {
                sign_in: {
                  email_label: 'Correo Electrónico',
                  password_label: 'Contraseña',
                  button_label: 'Iniciar Sesión',
                },
                sign_up: {
                  email_label: 'Correo Electrónico',
                  password_label: 'Contraseña',
                  button_label: 'Registrarse',
                }
              }
            }}
          />
        </div>
      </div>
      
      <div className="max-w-md mt-4 text-center">
        <p className="text-xs text-slate-400">
          Nota: Si te registras, asegúrate de que la confirmación de email esté desactivada en tu proyecto de Supabase si quieres acceso inmediato.
        </p>
        <p className="mt-2 text-xs text-slate-400">
          © 2024 Dental ERP System. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
};

export default Login;