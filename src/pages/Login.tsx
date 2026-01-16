"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Activity, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    // Verificar si ya hay sesión activa
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/');
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
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
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Credenciales incorrectas');
        } else {
          toast.error(error.message);
        }
        return;
      }

      // Actualizar último login (sin bloquear el flujo)
      supabase
        .from('profiles')
        .update({ last_login: new Date().toISOString() })
        .eq('id', data.user.id)
        .then(() => {});

      toast.success('Bienvenido');
    } catch (error: any) {
      toast.error('Error al iniciar sesión');
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
          <h1 className="text-2xl font-bold text-ios-gray-900 tracking-tight">Denttia ERP</h1>
          <p className="text-ios-gray-500 mt-1 font-medium">Sistema de Gestión Dental</p>
        </div>
        
        {/* Login Card */}
        <div className="ios-card p-6 shadow-ios-lg">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-ios-gray-600">
                Correo Electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@denttia.com"
                required
                className="ios-input"
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-ios-gray-600">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="ios-input pr-12"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-ios-gray-400 hover:text-ios-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-ios-blue text-white font-semibold hover:bg-ios-blue/90 transition-colors touch-feedback disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Iniciando...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-ios-gray-100">
            <p className="text-center text-xs text-ios-gray-400">
              Sistema privado. Contacta al administrador para obtener acceso.
            </p>
          </div>
        </div>
        
        {/* Footer */}
        <p className="text-center text-xs text-ios-gray-400 mt-6 font-medium">
          © 2024 Denttia. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
};

export default Login;