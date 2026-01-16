"use client";

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Activity, Eye, EyeOff, Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';

const ChangePassword = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      // Marcar que ya cambió la contraseña
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({ must_change_password: false })
          .eq('id', user.id);
      }

      toast.success('Contraseña actualizada correctamente');
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Error al cambiar contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ios-gray-100 flex flex-col items-center justify-center p-6">
      <div className="fixed inset-0 bg-gradient-to-br from-ios-orange/5 via-transparent to-ios-red/5 pointer-events-none" />
      
      <div className="w-full max-w-sm relative animate-scale-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-20 w-20 rounded-3xl bg-gradient-to-br from-ios-orange to-ios-red shadow-ios-lg mb-4">
            <Shield className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-ios-gray-900 tracking-tight">Cambio Requerido</h1>
          <p className="text-ios-gray-500 mt-1 font-medium">Debes cambiar tu contraseña</p>
        </div>
        
        {/* Form Card */}
        <div className="ios-card p-6 shadow-ios-lg">
          <div className="mb-4 p-3 rounded-xl bg-ios-orange/10 border border-ios-orange/20">
            <p className="text-sm text-ios-orange font-medium text-center">
              Por seguridad, debes establecer una nueva contraseña antes de continuar.
            </p>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-ios-gray-600">
                Nueva Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                  minLength={8}
                  className="ios-input pr-12"
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

            <div className="space-y-2">
              <label className="text-sm font-medium text-ios-gray-600">
                Confirmar Contraseña
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña"
                  required
                  className="ios-input pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-ios-gray-400 hover:text-ios-gray-600 transition-colors"
                >
                  {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-ios-green text-white font-semibold hover:bg-ios-green/90 transition-colors touch-feedback disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar Nueva Contraseña'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;