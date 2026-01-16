"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Activity, Lock, Mail, Key, Shield, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const Login = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAuditor, setIsAuditor] = useState(false);
  const [auditorSessionExpired, setAuditorSessionExpired] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        checkUserRoleAndRedirect(session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      if (event === 'SIGNED_IN' && session) {
        await checkUserRoleAndRedirect(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkUserRoleAndRedirect = async (userId: string) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (profile?.role === 'auditor') {
        // Verificar si la sesión de auditoría es válida
        const { data: auditSession } = await supabase
          .from('audit_sessions')
          .select('*')
          .eq('user_id', userId)
          .eq('is_active', true)
          .gte('expires_at', new Date().toISOString())
          .is('revoked_at', null)
          .single();

        if (!auditSession) {
          setAuditorSessionExpired(true);
          await supabase.auth.signOut();
          toast.error('Tu sesión de auditoría ha expirado o fue revocada');
          return;
        }

        // Registrar acceso del auditor
        await supabase.rpc('log_auditor_access', { p_entity_type: 'login' });
      }

      navigate('/');
    } catch (error) {
      console.error('Error checking user role:', error);
      navigate('/');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Por favor ingresa tu correo y contraseña');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Registrar intento fallido
        toast.error(error.message === 'Invalid login credentials' 
          ? 'Credenciales inválidas' 
          : error.message);
        return;
      }

      if (data.session) {
        toast.success('¡Bienvenido!');
      }
    } catch (error: any) {
      console.error('Login error:', error);
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
          <p className="text-ios-gray-500 mt-1 font-medium">Gestión Clínica Inteligente</p>
        </div>

        {/* Private SaaS Badge */}
        <div className="flex items-center justify-center gap-2 mb-6 animate-fade-in">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-ios-purple/10 border border-ios-purple/20">
            <Shield className="h-4 w-4 text-ios-purple" />
            <span className="text-xs font-semibold text-ios-purple">Sistema Privado</span>
          </div>
        </div>

        {/* Auditor Session Expired Warning */}
        {auditorSessionExpired && (
          <div className="mb-6 p-4 rounded-2xl bg-ios-orange/10 border border-ios-orange/20 animate-slide-up">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-ios-orange flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-ios-gray-900 text-sm">Sesión de Auditoría Expirada</p>
                <p className="text-xs text-ios-gray-600 mt-1">
                  Tu acceso como auditor ha expirado o fue revocado. Contacta al administrador si necesitas acceso nuevamente.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Login Card */}
        <div className="ios-card p-6 shadow-ios-lg">
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-ios-gray-600">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ios-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="ios-input pl-12"
                  placeholder="correo@ejemplo.com"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-ios-gray-600">
                Contraseña
              </label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ios-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="ios-input pl-12"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className={cn(
                "w-full h-12 rounded-xl bg-ios-blue text-white font-semibold text-base",
                "flex items-center justify-center gap-2",
                "hover:bg-ios-blue/90 transition-all duration-200",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "touch-feedback shadow-ios-sm"
              )}
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Lock className="h-5 w-5" />
                  Iniciar Sesión
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-ios-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-white text-ios-gray-400 font-medium">
                Acceso Restringido
              </span>
            </div>
          </div>

          {/* Private SaaS Notice */}
          <div className="p-4 rounded-2xl bg-ios-gray-50 border border-ios-gray-100">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-ios-gray-200 flex items-center justify-center flex-shrink-0">
                <Lock className="h-5 w-5 text-ios-gray-500" />
              </div>
              <div>
                <p className="font-semibold text-ios-gray-900 text-sm">Sistema Privado</p>
                <p className="text-xs text-ios-gray-500 mt-1">
                  El registro de nuevos usuarios está deshabilitado. Solo un administrador puede crear cuentas nuevas.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Auditor Access Info */}
        <div className="mt-6 p-4 rounded-2xl bg-ios-teal/5 border border-ios-teal/20 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-ios-teal flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-ios-gray-900 text-sm">¿Eres Auditor Externo?</p>
              <p className="text-xs text-ios-gray-600 mt-1">
                Si tienes credenciales de auditor, inicia sesión normalmente. Tu acceso es de solo lectura y está limitado en tiempo.
              </p>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <p className="text-center text-xs text-ios-gray-400 mt-6 font-medium">
          © 2024 Denttia ERP. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
};

export default Login;