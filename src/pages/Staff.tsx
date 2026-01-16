"use client";

import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Users, Plus, Search, Shield, UserCheck, UserX, 
  Mail, Key, Edit2, MoreHorizontal, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface StaffMember {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  is_active: boolean;
  must_change_password: boolean;
  last_login: string | null;
  created_at: string;
}

const Staff = () => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formEmail, setFormEmail] = useState('');
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formRole, setFormRole] = useState('doctor');
  const [formPassword, setFormPassword] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      // Obtener perfiles con información de auth
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Obtener emails de auth.users mediante una función o join
      const staffWithEmails = await Promise.all(
        (data || []).map(async (profile) => {
          // Intentar obtener el email del usuario
          const { data: userData } = await supabase.auth.admin?.getUserById?.(profile.id) || { data: null };
          return {
            ...profile,
            email: userData?.user?.email || 'Email no disponible',
            created_at: profile.updated_at || new Date().toISOString()
          };
        })
      );

      setStaff(data?.map(p => ({
        ...p,
        email: '', // Se llenará después
        created_at: p.updated_at || new Date().toISOString()
      })) || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
      toast.error('Error al cargar el personal');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormEmail('');
    setFormFirstName('');
    setFormLastName('');
    setFormRole('doctor');
    setFormPassword('');
    setFormIsActive(true);
    setEditingStaff(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (member: StaffMember) => {
    setEditingStaff(member);
    setFormFirstName(member.first_name || '');
    setFormLastName(member.last_name || '');
    setFormRole(member.role);
    setFormIsActive(member.is_active);
    setFormPassword('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingStaff) {
        // Actualizar usuario existente
        const { error } = await supabase
          .from('profiles')
          .update({
            first_name: formFirstName,
            last_name: formLastName,
            role: formRole,
            is_active: formIsActive,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingStaff.id);

        if (error) throw error;

        // Si se proporcionó nueva contraseña, actualizarla
        if (formPassword) {
          // Nota: Esto requiere permisos de admin o una edge function
          toast.info('Para cambiar la contraseña, el usuario debe usar "Olvidé mi contraseña"');
        }

        toast.success('Usuario actualizado correctamente');
      } else {
        // Crear nuevo usuario
        if (!formEmail || !formPassword) {
          toast.error('Email y contraseña son requeridos');
          setSaving(false);
          return;
        }

        // Crear usuario en Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formEmail,
          password: formPassword,
          options: {
            data: {
              first_name: formFirstName,
              last_name: formLastName,
              role: formRole
            }
          }
        });

        if (authError) throw authError;

        if (authData.user) {
          // Actualizar el perfil con el rol correcto y marcar que debe cambiar contraseña
          const { error: profileError } = await supabase
            .from('profiles')
            .update({
              first_name: formFirstName,
              last_name: formLastName,
              role: formRole,
              is_active: formIsActive,
              must_change_password: true
            })
            .eq('id', authData.user.id);

          if (profileError) {
            console.error('Error updating profile:', profileError);
          }
        }

        toast.success('Usuario creado correctamente. Deberá cambiar su contraseña en el primer inicio de sesión.');
      }

      setShowModal(false);
      resetForm();
      fetchStaff();
    } catch (error: any) {
      console.error('Error saving staff:', error);
      toast.error(error.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const toggleUserStatus = async (member: StaffMember) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !member.is_active })
        .eq('id', member.id);

      if (error) throw error;

      toast.success(member.is_active ? 'Usuario desactivado' : 'Usuario activado');
      fetchStaff();
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Error al cambiar estado');
    }
  };

  const resetPassword = async (member: StaffMember) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ must_change_password: true })
        .eq('id', member.id);

      if (error) throw error;

      toast.success('El usuario deberá cambiar su contraseña en el próximo inicio de sesión');
    } catch (error) {
      console.error('Error resetting password flag:', error);
      toast.error('Error al marcar cambio de contraseña');
    }
  };

  const getRoleInfo = (role: string) => {
    const roles: Record<string, { label: string; color: string; bgColor: string }> = {
      admin: { label: 'Administrador', color: 'text-ios-purple', bgColor: 'bg-ios-purple/15' },
      doctor: { label: 'Doctor', color: 'text-ios-blue', bgColor: 'bg-ios-blue/15' },
      receptionist: { label: 'Recepción', color: 'text-ios-orange', bgColor: 'bg-ios-orange/15' },
      auditor: { label: 'Auditor', color: 'text-ios-teal', bgColor: 'bg-ios-teal/15' }
    };
    return roles[role] || { label: role, color: 'text-ios-gray-500', bgColor: 'bg-ios-gray-100' };
  };

  const filteredStaff = staff.filter(member => {
    const searchLower = searchTerm.toLowerCase();
    return (
      member.first_name?.toLowerCase().includes(searchLower) ||
      member.last_name?.toLowerCase().includes(searchLower) ||
      member.role.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 border-3 border-ios-blue/30 border-t-ios-blue rounded-full animate-spin" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">Gestión de Personal</h1>
          <p className="text-ios-gray-500 mt-1 font-medium">Administra usuarios y permisos del sistema</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 h-11 px-5 rounded-xl bg-ios-blue text-white font-semibold hover:bg-ios-blue/90 transition-all duration-200 shadow-ios-sm touch-feedback"
        >
          <Plus className="h-5 w-5" />
          Nuevo Usuario
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: staff.length, color: 'bg-ios-blue', icon: Users },
          { label: 'Activos', value: staff.filter(s => s.is_active).length, color: 'bg-ios-green', icon: UserCheck },
          { label: 'Inactivos', value: staff.filter(s => !s.is_active).length, color: 'bg-ios-red', icon: UserX },
          { label: 'Admins', value: staff.filter(s => s.role === 'admin').length, color: 'bg-ios-purple', icon: Shield },
        ].map((stat, i) => (
          <div key={i} className="ios-card p-4 animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
            <div className="flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", stat.color)}>
                <stat.icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-ios-gray-900">{stat.value}</p>
                <p className="text-sm text-ios-gray-500">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="ios-card p-4 mb-6 animate-slide-up" style={{ animationDelay: '200ms' }}>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ios-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o rol..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-12 pl-12 pr-4 rounded-xl bg-ios-gray-100 border-none text-ios-gray-900 placeholder:text-ios-gray-400 focus:ring-2 focus:ring-ios-blue/20"
          />
        </div>
      </div>

      {/* Staff List */}
      <div className="ios-card overflow-hidden animate-slide-up" style={{ animationDelay: '250ms' }}>
        <div className="divide-y divide-ios-gray-100">
          {filteredStaff.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="h-12 w-12 text-ios-gray-300 mx-auto mb-3" />
              <p className="text-ios-gray-500 font-medium">No se encontraron usuarios</p>
            </div>
          ) : (
            filteredStaff.map((member) => {
              const roleInfo = getRoleInfo(member.role);
              return (
                <div
                  key={member.id}
                  className="flex items-center gap-4 p-4 hover:bg-ios-gray-50 transition-colors"
                >
                  {/* Avatar */}
                  <div className={cn(
                    "h-12 w-12 rounded-2xl flex items-center justify-center font-bold text-lg",
                    member.is_active ? 'bg-ios-blue/15 text-ios-blue' : 'bg-ios-gray-200 text-ios-gray-400'
                  )}>
                    {(member.first_name?.[0] || '?').toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn(
                        "font-semibold truncate",
                        member.is_active ? 'text-ios-gray-900' : 'text-ios-gray-400'
                      )}>
                        {member.first_name} {member.last_name}
                      </p>
                      {!member.is_active && (
                        <span className="px-2 py-0.5 rounded-full bg-ios-red/15 text-ios-red text-xs font-medium">
                          Inactivo
                        </span>
                      )}
                      {member.must_change_password && (
                        <span className="px-2 py-0.5 rounded-full bg-ios-orange/15 text-ios-orange text-xs font-medium">
                          Cambio de contraseña pendiente
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-medium",
                        roleInfo.bgColor, roleInfo.color
                      )}>
                        {roleInfo.label}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="h-10 w-10 rounded-xl hover:bg-ios-gray-100 flex items-center justify-center transition-colors">
                        <MoreHorizontal className="h-5 w-5 text-ios-gray-400" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => openEditModal(member)}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => resetPassword(member)}>
                        <Key className="h-4 w-4 mr-2" />
                        Forzar cambio de contraseña
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => toggleUserStatus(member)}
                        className={member.is_active ? 'text-ios-red' : 'text-ios-green'}
                      >
                        {member.is_active ? (
                          <>
                            <UserX className="h-4 w-4 mr-2" />
                            Desactivar
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-4 w-4 mr-2" />
                            Activar
                          </>
                        )}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-ios-blue flex items-center justify-center">
                <Users className="h-5 w-5 text-white" />
              </div>
              {editingStaff ? 'Editar Usuario' : 'Nuevo Usuario'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {!editingStaff && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Correo Electrónico *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-ios-gray-400" />
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="ios-input pl-10"
                    placeholder="usuario@denttia.com"
                    required
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Nombre</Label>
                <input
                  type="text"
                  value={formFirstName}
                  onChange={(e) => setFormFirstName(e.target.value)}
                  className="ios-input"
                  placeholder="Nombre"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Apellido</Label>
                <input
                  type="text"
                  value={formLastName}
                  onChange={(e) => setFormLastName(e.target.value)}
                  className="ios-input"
                  placeholder="Apellido"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-ios-gray-600">Rol *</Label>
              <Select value={formRole} onValueChange={setFormRole}>
                <SelectTrigger className="ios-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="doctor">Doctor</SelectItem>
                  <SelectItem value="receptionist">Recepción</SelectItem>
                  <SelectItem value="auditor">Auditor</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-ios-gray-400">
                {formRole === 'admin' && 'Acceso total al sistema, incluyendo auditorías y gestión de usuarios'}
                {formRole === 'doctor' && 'Acceso a pacientes, tratamientos, recetas y odontograma'}
                {formRole === 'receptionist' && 'Acceso a agenda, citas y caja (sin ver auditorías)'}
                {formRole === 'auditor' && 'Solo lectura de registros para auditoría'}
              </p>
            </div>

            {!editingStaff && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Contraseña Inicial *</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-ios-gray-400" />
                  <input
                    type="text"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="ios-input pl-10"
                    placeholder="Contraseña temporal"
                    required
                  />
                </div>
                <p className="text-xs text-ios-orange">
                  ⚠️ El usuario deberá cambiar esta contraseña en su primer inicio de sesión
                </p>
              </div>
            )}

            <div className="flex items-center justify-between p-4 bg-ios-gray-50 rounded-xl">
              <div>
                <p className="font-medium text-ios-gray-900">Usuario Activo</p>
                <p className="text-sm text-ios-gray-500">Puede iniciar sesión en el sistema</p>
              </div>
              <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 h-12 rounded-xl bg-ios-gray-100 text-ios-gray-700 font-semibold hover:bg-ios-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 h-12 rounded-xl bg-ios-blue text-white font-semibold hover:bg-ios-blue/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando...' : editingStaff ? 'Actualizar' : 'Crear Usuario'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Staff;