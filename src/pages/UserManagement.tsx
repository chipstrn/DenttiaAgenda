"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, 
  Shield, 
  UserPlus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Key,
  Mail,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  last_login: string;
  updated_at: string;
  email?: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-ios-red',
  doctor: 'bg-ios-blue',
  receptionist: 'bg-ios-green',
  assistant: 'bg-ios-purple'
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  doctor: 'Doctor',
  receptionist: 'Recepcionista',
  assistant: 'Asistente'
};

const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'receptionist'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get current user's role
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      setCurrentUserRole(currentProfile?.role || '');

      // Only admins can see this page
      if (currentProfile?.role !== 'admin') {
        toast.error('No tienes permisos para acceder a esta página');
        return;
      }

      // Fetch all profiles
      const { data: profilesData, error } = await supabase
        .from('profiles')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setUsers(profilesData || []);

      // Fetch roles
      const { data: rolesData } = await supabase
        .from('roles')
        .select('*')
        .order('name');

      setRoles(rolesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      toast.error('Email y contraseña son requeridos');
      return;
    }

    setSaving(true);
    try {
      // Create user via Supabase Auth
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

      toast.success('Usuario creado correctamente');
      setShowDialog(false);
      setFormData({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        role: 'receptionist'
      });
      fetchData();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Error al crear usuario');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          role: formData.role,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingUser.id);

      if (error) throw error;

      toast.success('Usuario actualizado');
      setShowDialog(false);
      setEditingUser(null);
      fetchData();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Error al actualizar usuario');
    } finally {
      setSaving(false);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      toast.success(currentStatus ? 'Usuario desactivado' : 'Usuario activado');
      fetchData();
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Error al cambiar estado');
    }
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: '',
      password: '',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      role: user.role || 'receptionist'
    });
    setShowDialog(true);
  };

  const openCreateDialog = () => {
    setEditingUser(null);
    setFormData({
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      role: 'receptionist'
    });
    setShowDialog(true);
  };

  if (currentUserRole !== 'admin') {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-16">
          <Shield className="h-16 w-16 text-ios-red mb-4" />
          <h2 className="text-xl font-bold text-ios-gray-900">Acceso Denegado</h2>
          <p className="text-ios-gray-500 mt-2">Solo los administradores pueden acceder a esta página</p>
        </div>
      </MainLayout>
    );
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 border-3 border-ios-blue/30 border-t-ios-blue rounded-full animate-spin"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">Gestión de Usuarios</h1>
          <p className="text-ios-gray-500 mt-1 font-medium">Administra los usuarios y sus permisos</p>
        </div>
        <button
          onClick={openCreateDialog}
          className="flex items-center gap-2 h-11 px-5 rounded-xl bg-ios-blue text-white font-semibold text-sm shadow-ios-sm hover:bg-ios-blue/90 transition-all duration-200 touch-feedback"
        >
          <UserPlus className="h-5 w-5" />
          Nuevo Usuario
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
        <div className="ios-card p-5 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <div className="h-10 w-10 rounded-xl bg-ios-blue/15 flex items-center justify-center">
              <Users className="h-5 w-5 text-ios-blue" />
            </div>
          </div>
          <p className="text-2xl font-bold text-ios-gray-900">{users.length}</p>
          <p className="text-sm text-ios-gray-500">Total Usuarios</p>
        </div>

        <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '50ms' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="h-10 w-10 rounded-xl bg-ios-green/15 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-ios-green" />
            </div>
          </div>
          <p className="text-2xl font-bold text-ios-gray-900">
            {users.filter(u => u.is_active !== false).length}
          </p>
          <p className="text-sm text-ios-gray-500">Activos</p>
        </div>

        <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="h-10 w-10 rounded-xl bg-ios-red/15 flex items-center justify-center">
              <Shield className="h-5 w-5 text-ios-red" />
            </div>
          </div>
          <p className="text-2xl font-bold text-ios-gray-900">
            {users.filter(u => u.role === 'admin').length}
          </p>
          <p className="text-sm text-ios-gray-500">Administradores</p>
        </div>

        <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '150ms' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="h-10 w-10 rounded-xl bg-ios-purple/15 flex items-center justify-center">
              <Key className="h-5 w-5 text-ios-purple" />
            </div>
          </div>
          <p className="text-2xl font-bold text-ios-gray-900">{roles.length}</p>
          <p className="text-sm text-ios-gray-500">Roles</p>
        </div>
      </div>

      {/* Users List */}
      <div className="ios-card overflow-hidden animate-slide-up" style={{ animationDelay: '200ms' }}>
        <div className="p-5 border-b border-ios-gray-100">
          <h2 className="font-bold text-ios-gray-900">Lista de Usuarios</h2>
        </div>

        {users.length > 0 ? (
          <div className="divide-y divide-ios-gray-100">
            {users.map((user, index) => (
              <div
                key={user.id}
                className="flex items-center gap-4 p-4 hover:bg-ios-gray-50 transition-all duration-200 animate-fade-in"
                style={{ animationDelay: `${250 + index * 30}ms` }}
              >
                {/* Avatar */}
                <div className={cn(
                  "h-12 w-12 rounded-2xl flex items-center justify-center text-white font-semibold",
                  ROLE_COLORS[user.role] || 'bg-ios-gray-500'
                )}>
                  {user.first_name?.[0] || 'U'}{user.last_name?.[0] || ''}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-ios-gray-900">
                      {user.first_name} {user.last_name}
                    </p>
                    {user.is_active === false && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-ios-red/15 text-ios-red font-medium">
                        Inactivo
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-ios-gray-500">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-medium",
                      `${ROLE_COLORS[user.role]}/15`,
                      user.role === 'admin' ? 'text-ios-red' :
                      user.role === 'doctor' ? 'text-ios-blue' :
                      user.role === 'receptionist' ? 'text-ios-green' : 'text-ios-purple'
                    )}>
                      {ROLE_LABELS[user.role] || user.role}
                    </span>
                    {user.last_login && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Último acceso: {format(new Date(user.last_login), 'dd/MM/yy HH:mm')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ios-gray-500">Activo</span>
                  <Switch
                    checked={user.is_active !== false}
                    onCheckedChange={() => toggleUserStatus(user.id, user.is_active !== false)}
                  />
                </div>

                {/* Actions */}
                <button
                  onClick={() => openEditDialog(user)}
                  className="h-10 w-10 rounded-xl bg-ios-gray-100 flex items-center justify-center hover:bg-ios-gray-200 transition-colors touch-feedback"
                >
                  <Edit className="h-4 w-4 text-ios-gray-600" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Users className="h-16 w-16 text-ios-gray-300 mx-auto mb-4" />
            <p className="text-ios-gray-500">No hay usuarios registrados</p>
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[450px] rounded-3xl border-0 shadow-ios-xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="text-xl font-bold text-ios-gray-900">
              {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={editingUser ? (e) => { e.preventDefault(); handleUpdateUser(); } : handleCreateUser}>
            <div className="px-6 space-y-4">
              {!editingUser && (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-ios-gray-600">Email *</Label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ios-gray-400" />
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                        className="ios-input pl-12"
                        placeholder="correo@ejemplo.com"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-ios-gray-600">Contraseña *</Label>
                    <div className="relative">
                      <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ios-gray-400" />
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                        className="ios-input pl-12"
                        placeholder="Mínimo 6 caracteres"
                        minLength={6}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-ios-gray-600">Nombre</Label>
                  <input
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="ios-input"
                    placeholder="Nombre"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-ios-gray-600">Apellido</Label>
                  <input
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="ios-input"
                    placeholder="Apellido"
                  />
                </div>
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
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="doctor">Doctor</SelectItem>
                    <SelectItem value="receptionist">Recepcionista</SelectItem>
                    <SelectItem value="assistant">Asistente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-6 pt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setShowDialog(false)}
                className="flex-1 h-12 rounded-xl bg-ios-gray-100 text-ios-gray-900 font-semibold hover:bg-ios-gray-200 transition-colors touch-feedback"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 h-12 rounded-xl bg-ios-blue text-white font-semibold hover:bg-ios-blue/90 transition-colors touch-feedback disabled:opacity-50"
              >
                {saving ? 'Guardando...' : editingUser ? 'Guardar' : 'Crear Usuario'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default UserManagement;