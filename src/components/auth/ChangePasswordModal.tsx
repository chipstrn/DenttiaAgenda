"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Shield, Eye, EyeOff, Lock } from 'lucide-react';

interface ChangePasswordModalProps {
  open: boolean;
  onSuccess: () => void;
}

export const ChangePasswordModal = ({ open, onSuccess }: ChangePasswordModalProps) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const validatePassword = (password: string): string[] => {
    const errors: string[] = [];
    if (password.length < 8) errors.push('Mínimo 8 caracteres');
    if (!/[A-Z]/.test(password)) errors.push('Al menos una mayúscula');
    if (!/[a-z]/.test(password)) errors.push('Al menos una minúscula');
    if (!/[0-9]/.test(password)) errors.push('Al menos un número');
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors = validatePassword(newPassword);
    if (errors.length > 0) {
      toast.error('La contraseña no cumple los requisitos: ' + errors.join(', '));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    try {
      // Actualizar contraseña en Auth
      const { error: authError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (authError) throw authError;

      // Marcar que ya no necesita cambiar contraseña
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ must_change_password: false })
          .eq('id', user.id);

        if (profileError) throw profileError;
      }

      toast.success('Contraseña actualizada correctamente');
      onSuccess();
    } catch (error: any) {
      console.error('Error updating password:', error);
      toast.error(error.message || 'Error al actualizar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  const passwordErrors = validatePassword(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-2xl bg-ios-orange flex items-center justify-center">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl">Cambio de Contraseña Requerido</DialogTitle>
              <DialogDescription>
                Por seguridad, debes cambiar tu contraseña inicial
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-ios-gray-600">Nueva Contraseña</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-ios-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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
            
            {/* Password Requirements */}
            <div className="grid grid-cols-2 gap-1 mt-2">
              {[
                { label: 'Mínimo 8 caracteres', valid: newPassword.length >= 8 },
                { label: 'Una mayúscula', valid: /[A-Z]/.test(newPassword) },
                { label: 'Una minúscula', valid: /[a-z]/.test(newPassword) },
                { label: 'Un número', valid: /[0-9]/.test(newPassword) },
              ].map((req, i) => (
                <div key={i} className={`text-xs flex items-center gap-1 ${req.valid ? 'text-ios-green' : 'text-ios-gray-400'}`}>
                  <div className={`h-1.5 w-1.5 rounded-full ${req.valid ? 'bg-ios-green' : 'bg-ios-gray-300'}`} />
                  {req.label}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-ios-gray-600">Confirmar Contraseña</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-ios-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`ios-input pl-10 ${confirmPassword && !passwordsMatch ? 'border-ios-red' : ''}`}
                placeholder="••••••••"
                required
              />
            </div>
            {confirmPassword && !passwordsMatch && (
              <p className="text-xs text-ios-red">Las contraseñas no coinciden</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || passwordErrors.length > 0 || !passwordsMatch}
            className="w-full h-12 rounded-xl bg-ios-blue text-white font-semibold hover:bg-ios-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Actualizando...' : 'Cambiar Contraseña'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
};