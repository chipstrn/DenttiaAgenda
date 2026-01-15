"use client";

import { useEffect, useState } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Activity } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);

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
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-ios-gray-100 flex flex-col items-center justify-center p-6">
      {/* Background Gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-ios-blue/5 via-transparent to-ios-purple/5 pointer-events-none" />
      
      <div className="w-full max-w-sm relative animate-scale-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-20 w-20 rounded-3xl bg-gradient-to-br from-ios-blue to-ios-indigo shadow-ios-lg mb-4">
            <Activity className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-ios-gray-900 tracking-tight">Dental ERP</h1>
          <p className="text-ios-gray-500 mt-1 font-medium">Gestión Clínica Inteligente</p>
        </div>
        
        {/* Auth Card */}
        <div className="ios-card p-6 shadow-ios-lg">
          <Auth
            supabaseClient={supabase}
            providers={[]} 
            appearance={{
              theme: ThemeSupa,
              style: {
                button: {
                  borderRadius: '12px',
                  height: '48px',
                  fontSize: '15px',
                  fontWeight: '600',
                  background: 'hsl(211, 100%, 50%)',
                  border: 'none',
                },
                input: {
                  borderRadius: '12px',
                  height: '48px',
                  fontSize: '15px',
                  background: 'hsl(0, 0%, 96%)',
                  border: 'none',
                  padding: '0 16px',
                },
                label: {
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'hsl(0, 0%, 45%)',
                  marginBottom: '6px',
                },
                anchor: {
                  color: 'hsl(211, 100%, 50%)',
                  fontWeight: '500',
                  fontSize: '14px',
                },
                message: {
                  borderRadius: '12px',
                  fontSize: '14px',
                },
                container: {
                  gap: '16px',
                },
              },
              variables: {
                default: {
                  colors: {
                    brand: 'hsl(211, 100%, 50%)',
                    brandAccent: 'hsl(211, 100%, 45%)',
                    inputBackground: 'hsl(0, 0%, 96%)',
                    inputBorder: 'transparent',
                    inputBorderFocus: 'hsl(211, 100%, 50%)',
                    inputBorderHover: 'transparent',
                  },
                  radii: {
                    borderRadiusButton: '12px',
                    buttonBorderRadius: '12px',
                    inputBorderRadius: '12px',
                  },
                  fontSizes: {
                    baseBodySize: '15px',
                    baseInputSize: '15px',
                    baseLabelSize: '14px',
                    baseButtonSize: '15px',
                  },
                  fonts: {
                    bodyFontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                    buttonFontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                    inputFontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                    labelFontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
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
                  link_text: '¿Ya tienes cuenta? Inicia sesión',
                },
                sign_up: {
                  email_label: 'Correo Electrónico',
                  password_label: 'Contraseña',
                  button_label: 'Crear Cuenta',
                  link_text: '¿No tienes cuenta? Regístrate',
                },
                forgotten_password: {
                  email_label: 'Correo Electrónico',
                  button_label: 'Enviar instrucciones',
                  link_text: '¿Olvidaste tu contraseña?',
                },
              }
            }}
          />
        </div>
        
        {/* Footer */}
        <p className="text-center text-xs text-ios-gray-400 mt-6 font-medium">
          © 2024 Dental ERP. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
};

export default Login;