"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { 
  Plus, Users, Shield, UserCheck, UserX, 
  Mail, Key, Loader2, AlertTriangle, Eye, EyeOff 
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  must_change_password: boolean;
  last_login: string | null;
  created_at?: string;
  email?: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
}

const StaffManagement = () => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'recepcion'
  });

  const fetchData = async () => {
    try {
      // Obtener perfiles con información de auth
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Obtener emails de auth.users a través de una función o vista
      // Por ahora usamos los datos disponibles
      setStaff(profilesData || []);

      // Obtener roles
      const { data: rolesData } = await supabase
        .from('roles')
        .select('*')
        .order('name');

      setRoles(rolesData || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
      toast.error('Error al cargar personal');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Crear usuario en auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.first_name,
            last_name: formData.last_name,
            role: formData.role
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // Actualizar perfil con rol correcto
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            role: formData.role,
            must_change_password: true
          })
          .eq('id', authData.user.id);

        if (profileError) throw profileError;
      }

      toast.success('Usuario creado correctamente');
      setIsDialogOpen(false);
      setFormData({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        role: 'recepcion'
      });
      fetchData();
    } catch (error: any) {
      console.error('Error creating user:', error);
      if (error.message?.includes('already registered')) {
        toast.error('Este correo ya está registrado');
      } else {
        toast.error(error.message || 'Error al crear usuario');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      toast.success(currentStatus ? 'Usuario desactivado' : 'Usuario activado');
      fetchData();
    } catch (error) {
      console.error('Error toggling user status:', error);
      toast.error('Error al cambiar estado');
    }
  };

  const handleResetPassword = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ must_change_password: true })
        .eq('id', userId);

      if (error) throw error;

      toast.success('El usuario deberá cambiar su contraseña en el próximo inicio');
    } catch (error) {
      console.error('Error resetting password flag:', error);
      toast.error('Error al marcar cambio de contraseña');
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-ios-red';
      case 'recepcion': return 'bg-ios-blue';
      case 'doctor': return 'bg-ios-green';
      default: return 'bg-ios-gray-400';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'recepcion': return 'Recepción';
      case 'doctor': return 'Doctor';
      default: return role;
    }
  };

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">Gestión de Personal</h1>
          <p className="text-ios-gray-500 mt-1 font-medium">Administra usuarios del sistema</p>
        </div>
        <button 
          onClick={() => setIsDialogOpen(true)}
          className="flex items-center gap-2 h-11 px-5 rounded-xl bg-ios-blue text-white font-semibold text-sm shadow-ios-sm hover:bg-ios-blue/90 transition-all duration-200 touch-feedback"
        >
          <Plus className="h-5 w-5" />
          Nuevo Usuario
        </button>
      </div>

      {/* Warning Banner */}
      <div className="mb-6 p-4 rounded-2xl bg-ios-orange/10 border border-ios-orange/20 flex items-start gap-3 animate-fade-in">
        <AlertTriangle className="h-5 w-5 text-ios-orange flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-ios-orange">Zona de Administración</p>
          <p className="text-sm text-ios-gray-600 mt-1">
            Los cambios aquí afectan el acceso de los usuarios al sistema. Los usuarios nuevos deberán cambiar su contraseña en el primer inicio de sesión.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '0ms' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="h-11 w-11 rounded-2xl bg-ios-blue flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-ios-gray-900">{staff.length}</p>
          <p className="text-sm text-ios-gray-500 font-medium mt-1">Total Usuarios</p>
        </div>
        
        <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '50ms' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="h-11 w-11 rounded-2xl bg-ios-green flex items-center justify-center">
              <UserCheck className="h-5 w-5 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-ios-gray-900">
            {staff.filter(s => s.is_active !== false).length}
          </p>
          <p className="text-sm text-ios-gray-500 font-medium mt-1">Usuarios Activos</p>
        </div>
        
        <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="h-11 w-11 rounded-2xl bg-ios-red flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-ios-gray-900">
            {staff.filter(s => s.role === 'admin').length}
          </p>
          <p className="text-sm text-ios-gray-500 font-medium mt-1">Administradores</p>
        </div>
      </div>

      {/* Staff List */}
      <div className="ios-card overflow-hidden animate-slide-up" style={{ animationDelay: '150ms' }}>
        <div className="p-5 border-b border-ios-gray-100">
          <h2 className="text-lg font-bold text-ios-gray-900">Lista de Personal</h2>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-ios-blue" />
          </div>
        ) : staff.length > 0 ? (
          <div className="divide-y divide-ios-gray-100">
            {staff.map((member, index) => (
              <div 
                key={member.id}
                className="flex items-center gap-4 p-4 hover:bg-ios-gray-50 transition-all duration-200 ease-ios animate-fade-in"
                style={{ animationDelay: `${200 + index * 30}ms` }}
              >
                <div className={cn(
                  "h-12 w-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg",
                  getRoleColor(member.role)
                )}>
                  {member.first_name?.[0]?.toUpperCase() || 'U'}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-ios-gray-900">
                      {member.first_name} {member.last_name}
                    </p>
                    {member.is_active === false && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-ios-red/10 text-ios-red font-medium">
                        Inactivo
                      </span>
                    )}
                    {member.must_change_password && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-ios-orange/10 text-ios-orange font-medium">
                        Cambio pendiente
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full font-medium",
                      member.role === 'admin' ? 'bg-ios-red/10 text-ios-red' :
                      member.role === 'recepcion' ? 'bg-ios-blue/10 text-ios-blue' :
                      'bg-ios-green/10 text-ios-green'
                    )}>
                      {getRoleLabel(member.role)}
                    </span>
                    {member.last_login && (
                      <span className="text-sm text-ios-gray-500">
                        Último acceso: {format(new Date(member.last_login), "dd/MM/yyyy HH:mm")}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleResetPassword(member.id)}
                    className="h-9 px-3 rounded-lg bg-ios-orange/10 text-ios-orange text-sm font-medium hover:bg-ios-orange/20 transition-colors"
                    title="Forzar cambio de contraseña"
                  >
                    <Key className="h-4 w-4" />
                  </button>
                  <Switch
                    checked={member.is_active !== false}
                    onCheckedChange={() => handleToggleActive(member.id, member.is_active !== false)}
                    disabled={member.role === 'admin'}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="h-20 w-20 rounded-full bg-ios-gray-100 flex items-center justify-center mx-auto mb-4">
              <Users className="h-10 w-10 text-ios-gray-400" />
            </div>
            <p className="text-ios-gray-900 font-semibold">Sin usuarios</p>
            <p className="text-ios-gray-500 text-sm mt-1">Crea el primer usuario del sistema</p>
          </div>
        )}
      </div>

      {/* Create User Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[450px] rounded-3xl border-0 shadow-ios-xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="text-xl font-bold text-ios-gray-900">Nuevo Usuario</DialogTitle>
            <DialogDescription className="text-ios-gray-500">
              Crea una cuenta para un nuevo miembro del equipo
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleCreateUser}>
            <div className="px-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-ios-gray-600">Nombre *</Label>
                  <input
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    placeholder="Nombre"
                    required
                    className="ios-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-ios-gray-600">Apellido *</Label>
                  <input
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    placeholder="Apellido"
                    required
                    className="ios-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Correo Electrónico *</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ios-gray-400" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="usuario@denttia.com"
                    required
                    className="ios-input pl-12"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Contraseña Temporal *</Label>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ios-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                    className="ios-input pl-12 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-ios-gray-400 hover:text-ios-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <p className="text-xs text-ios-gray-400">El usuario deberá cambiarla en su primer inicio</p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Rol *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger className="ios-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="recepcion">Recepción</SelectItem>
                    <SelectItem value="doctor">Doctor</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="p-6 pt-4 flex gap-3">
              <button 
                type="button" 
                onClick={() => setIsDialogOpen(false)}
                className="flex-1 h-12 rounded-xl bg-ios-gray-100 text-ios-gray-900 font-semibold hover:bg-ios-gray-200 transition-colors touch-feedback"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                disabled={saving}
                className="flex-1 h-12 rounded-xl bg-ios-blue text-white font-semibold hover:bg-ios-blue/90 transition-colors touch-feedback disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Creando...
                  </>
                ) : (
                  'Crear Usuario'
                )}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default StaffManagement;