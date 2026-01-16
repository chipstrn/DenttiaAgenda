"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Activity, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const Login = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Credenciales incorrectas');
        } else if (error.message.includes('Email not confirmed')) {
          toast.error('Email no confirmado. Contacta al administrador.');
        } else {
          toast.error(error.message);
        }
        return;
      }

      // Verificar si el usuario está activo
      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_active')
          .eq('id', data.user.id)
          .single();

        if (profile && !profile.is_active) {
          await supabase.auth.signOut();
          toast.error('Tu cuenta ha sido desactivada. Contacta al administrador.');
          return;
        }
      }

      toast.success('¡Bienvenido!');
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error('Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Ingresa tu correo electrónico');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`
      });

      if (error) throw error;

      toast.success('Se ha enviado un enlace de recuperación a tu correo');
      setShowForgotPassword(false);
    } catch (error: any) {
      console.error('Reset password error:', error);
      toast.error('Error al enviar el correo de recuperación');
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="text-2xl font-bold text-ios-gray-900 tracking-tight">Denttia</h1>
          <p className="text-ios-gray-500 mt-1 font-medium">ERP Dental Profesional</p>
        </div>
        
        {/* Auth Card */}
        <div className="ios-card p-6 shadow-ios-lg">
          {showForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="text-center mb-4">
                <h2 className="text-lg font-semibold text-ios-gray-900">Recuperar Contraseña</h2>
                <p className="text-sm text-ios-gray-500 mt-1">
                  Ingresa tu correo y te enviaremos un enlace
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-ios-gray-600">Correo Electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-ios-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="ios-input pl-10"
                    placeholder="tu@email.com"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-ios-blue text-white font-semibold hover:bg-ios-blue/90 transition-colors disabled:opacity-50"
              >
                {loading ? 'Enviando...' : 'Enviar Enlace'}
              </button>

              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                className="w-full text-sm text-ios-blue font-medium hover:underline"
              >
                Volver al inicio de sesión
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-ios-gray-600">Correo Electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-ios-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="ios-input pl-10"
                    placeholder="tu@email.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-ios-gray-600">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-ios-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="ios-input pl-10 pr-10"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ios-gray-400 hover:text-ios-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-ios-blue font-medium hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-ios-blue text-white font-semibold hover:bg-ios-blue/90 transition-colors disabled:opacity-50"
              >
                {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-ios-gray-400 font-medium">
            Sistema privado. Solo usuarios autorizados.
          </p>
          <p className="text-xs text-ios-gray-400 mt-1">
            © 2024 Denttia. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;