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
  Shield, 
  UserPlus,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Mail,
  Building,
  FileText,
  Calendar,
  Copy,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays, addHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface AuditSession {
  id: string;
  user_id: string;
  auditor_name: string;
  auditor_email: string;
  auditor_company: string;
  purpose: string;
  access_level: string;
  can_view_patients: boolean;
  can_view_appointments: boolean;
  can_view_treatments: boolean;
  can_view_payments: boolean;
  can_view_cash_registers: boolean;
  can_export_data: boolean;
  starts_at: string;
  expires_at: string;
  is_active: boolean;
  revoked_at: string | null;
  revoke_reason: string | null;
  created_at: string;
  last_access: string | null;
}

const PURPOSE_LABELS: Record<string, string> = {
  migration: 'Migración de Datos',
  compliance: 'Cumplimiento Normativo',
  financial: 'Auditoría Financiera',
  other: 'Otro'
};

const AuditSessions = () => {
  const [sessions, setSessions] = useState<AuditSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [selectedSession, setSelectedSession] = useState<AuditSession | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const [generatedPassword, setGeneratedPassword] = useState('');

  const [formData, setFormData] = useState({
    auditor_name: '',
    auditor_email: '',
    auditor_company: '',
    purpose: 'migration',
    duration_hours: '72', // 3 días por defecto
    can_view_patients: true,
    can_view_appointments: true,
    can_view_treatments: true,
    can_view_payments: true,
    can_view_cash_registers: true,
    can_export_data: false
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      setCurrentUserRole(currentProfile?.role || '');

      if (currentProfile?.role !== 'admin') {
        toast.error('No tienes permisos para acceder a esta página');
        return;
      }

      const { data, error } = await supabase
        .from('audit_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleCreateAuditor = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.auditor_name || !formData.auditor_email) {
      toast.error('Nombre y email son requeridos');
      return;
    }

    setSaving(true);
    const tempPassword = generatePassword();
    setGeneratedPassword(tempPassword);

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      // 1. Crear usuario en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.auditor_email,
        password: tempPassword,
        options: {
          data: {
            first_name: formData.auditor_name.split(' ')[0],
            last_name: formData.auditor_name.split(' ').slice(1).join(' '),
            role: 'auditor'
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('No se pudo crear el usuario');

      // 2. Actualizar perfil con rol de auditor
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          role: 'auditor',
          first_name: formData.auditor_name.split(' ')[0],
          last_name: formData.auditor_name.split(' ').slice(1).join(' ')
        })
        .eq('id', authData.user.id);

      if (profileError) throw profileError;

      // 3. Crear sesión de auditoría
      const expiresAt = addHours(new Date(), parseInt(formData.duration_hours));
      
      const { error: sessionError } = await supabase
        .from('audit_sessions')
        .insert({
          user_id: authData.user.id,
          auditor_name: formData.auditor_name,
          auditor_email: formData.auditor_email,
          auditor_company: formData.auditor_company,
          purpose: formData.purpose,
          access_level: formData.can_export_data ? 'read_export' : 'read_only',
          can_view_patients: formData.can_view_patients,
          can_view_appointments: formData.can_view_appointments,
          can_view_treatments: formData.can_view_treatments,
          can_view_payments: formData.can_view_payments,
          can_view_cash_registers: formData.can_view_cash_registers,
          can_export_data: formData.can_export_data,
          expires_at: expiresAt.toISOString(),
          created_by: currentUser?.id
        });

      if (sessionError) throw sessionError;

      // 4. Registrar en auditoría
      await supabase.from('audit_logs').insert({
        user_id: currentUser?.id,
        user_email: currentUser?.email,
        user_role: 'admin',
        action: 'CREATE',
        entity_type: 'audit_sessions',
        new_data: { auditor_email: formData.auditor_email, purpose: formData.purpose }
      });

      toast.success('Auditor creado correctamente');
      // No cerrar el diálogo para mostrar las credenciales
    } catch (error: any) {
      console.error('Error creating auditor:', error);
      toast.error(error.message || 'Error al crear auditor');
      setGeneratedPassword('');
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeSession = async () => {
    if (!selectedSession) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('audit_sessions')
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoked_by: user?.id,
          revoke_reason: revokeReason
        })
        .eq('id', selectedSession.id);

      if (error) throw error;

      // Registrar en auditoría
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        user_email: user?.email,
        user_role: 'admin',
        action: 'UPDATE',
        entity_type: 'audit_sessions',
        entity_id: selectedSession.id,
        metadata: { action: 'revoke', reason: revokeReason }
      });

      toast.success('Sesión revocada');
      setShowRevokeDialog(false);
      setSelectedSession(null);
      setRevokeReason('');
      fetchData();
    } catch (error) {
      console.error('Error revoking session:', error);
      toast.error('Error al revocar sesión');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado al portapapeles');
  };

  const getSessionStatus = (session: AuditSession) => {
    if (session.revoked_at) return 'revoked';
    if (new Date(session.expires_at) < new Date()) return 'expired';
    if (!session.is_active) return 'inactive';
    return 'active';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-ios-green/15 text-ios-green flex items-center gap-1.5">
            <CheckCircle className="h-3.5 w-3.5" /> Activa
          </span>
        );
      case 'expired':
        return (
          <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-ios-orange/15 text-ios-orange flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Expirada
          </span>
        );
      case 'revoked':
        return (
          <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-ios-red/15 text-ios-red flex items-center gap-1.5">
            <XCircle className="h-3.5 w-3.5" /> Revocada
          </span>
        );
      default:
        return (
          <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-ios-gray-200 text-ios-gray-600 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Inactiva
          </span>
        );
    }
  };

  const resetForm = () => {
    setFormData({
      auditor_name: '',
      auditor_email: '',
      auditor_company: '',
      purpose: 'migration',
      duration_hours: '72',
      can_view_patients: true,
      can_view_appointments: true,
      can_view_treatments: true,
      can_view_payments: true,
      can_view_cash_registers: true,
      can_export_data: false
    });
    setGeneratedPassword('');
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
          <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">Auditoría Externa</h1>
          <p className="text-ios-gray-500 mt-1 font-medium">Gestiona el acceso de auditores externos al sistema</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowCreateDialog(true); }}
          className="flex items-center gap-2 h-11 px-5 rounded-xl bg-ios-teal text-white font-semibold text-sm shadow-ios-sm hover:bg-ios-teal/90 transition-all duration-200 touch-feedback"
        >
          <UserPlus className="h-5 w-5" />
          Crear Auditor
        </button>
      </div>

      {/* Info Card */}
      <div className="ios-card p-5 mb-6 animate-slide-up">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-ios-teal/15 flex items-center justify-center flex-shrink-0">
            <Shield className="h-6 w-6 text-ios-teal" />
          </div>
          <div>
            <h3 className="font-bold text-ios-gray-900">Modo Auditoría Externa</h3>
            <p className="text-sm text-ios-gray-500 mt-1">
              Crea usuarios temporales de <strong>solo lectura</strong> para auditores externos. 
              Estos usuarios pueden ver datos pero <strong>no pueden modificar nada</strong>. 
              El acceso expira automáticamente y todas sus acciones quedan registradas.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
        <div className="ios-card p-5 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <div className="h-10 w-10 rounded-xl bg-ios-teal/15 flex items-center justify-center">
              <Eye className="h-5 w-5 text-ios-teal" />
            </div>
          </div>
          <p className="text-2xl font-bold text-ios-gray-900">{sessions.length}</p>
          <p className="text-sm text-ios-gray-500">Total Sesiones</p>
        </div>

        <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '50ms' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="h-10 w-10 rounded-xl bg-ios-green/15 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-ios-green" />
            </div>
          </div>
          <p className="text-2xl font-bold text-ios-gray-900">
            {sessions.filter(s => getSessionStatus(s) === 'active').length}
          </p>
          <p className="text-sm text-ios-gray-500">Activas</p>
        </div>

        <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="h-10 w-10 rounded-xl bg-ios-orange/15 flex items-center justify-center">
              <Clock className="h-5 w-5 text-ios-orange" />
            </div>
          </div>
          <p className="text-2xl font-bold text-ios-gray-900">
            {sessions.filter(s => getSessionStatus(s) === 'expired').length}
          </p>
          <p className="text-sm text-ios-gray-500">Expiradas</p>
        </div>

        <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '150ms' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="h-10 w-10 rounded-xl bg-ios-red/15 flex items-center justify-center">
              <XCircle className="h-5 w-5 text-ios-red" />
            </div>
          </div>
          <p className="text-2xl font-bold text-ios-gray-900">
            {sessions.filter(s => getSessionStatus(s) === 'revoked').length}
          </p>
          <p className="text-sm text-ios-gray-500">Revocadas</p>
        </div>
      </div>

      {/* Sessions List */}
      <div className="ios-card overflow-hidden animate-slide-up" style={{ animationDelay: '200ms' }}>
        <div className="p-5 border-b border-ios-gray-100">
          <h2 className="font-bold text-ios-gray-900">Sesiones de Auditoría</h2>
        </div>

        {sessions.length > 0 ? (
          <div className="divide-y divide-ios-gray-100">
            {sessions.map((session, index) => {
              const status = getSessionStatus(session);
              
              return (
                <div
                  key={session.id}
                  className="flex items-center gap-4 p-4 hover:bg-ios-gray-50 transition-all duration-200 animate-fade-in"
                  style={{ animationDelay: `${250 + index * 30}ms` }}
                >
                  {/* Avatar */}
                  <div className="h-12 w-12 rounded-2xl bg-ios-teal/15 flex items-center justify-center text-ios-teal font-semibold">
                    {session.auditor_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-ios-gray-900">{session.auditor_name}</p>
                      {getStatusBadge(status)}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-ios-gray-500">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" />
                        {session.auditor_email}
                      </span>
                      {session.auditor_company && (
                        <span className="flex items-center gap-1">
                          <Building className="h-3.5 w-3.5" />
                          {session.auditor_company}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-ios-gray-400">
                      <span>{PURPOSE_LABELS[session.purpose]}</span>
                      <span>•</span>
                      <span>Expira: {format(new Date(session.expires_at), 'dd/MM/yy HH:mm')}</span>
                      {session.last_access && (
                        <>
                          <span>•</span>
                          <span>Último acceso: {format(new Date(session.last_access), 'dd/MM/yy HH:mm')}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {status === 'active' && (
                    <button
                      onClick={() => { setSelectedSession(session); setShowRevokeDialog(true); }}
                      className="h-10 px-4 rounded-xl bg-ios-red/10 text-ios-red font-semibold text-sm flex items-center gap-2 hover:bg-ios-red/20 transition-colors touch-feedback"
                    >
                      <XCircle className="h-4 w-4" />
                      Revocar
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <Shield className="h-16 w-16 text-ios-gray-300 mx-auto mb-4" />
            <p className="text-ios-gray-500 font-medium">No hay sesiones de auditoría</p>
            <p className="text-ios-gray-400 text-sm mt-1">Crea una para dar acceso temporal a un auditor externo</p>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) resetForm(); setShowCreateDialog(open); }}>
        <DialogContent className="max-w-lg rounded-3xl border-0 shadow-ios-xl p-0 overflow-hidden max-h-[90vh]">
          <DialogHeader className="p-6 pb-4 border-b border-ios-gray-100">
            <DialogTitle className="text-xl font-bold text-ios-gray-900 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-ios-teal/15 flex items-center justify-center">
                <UserPlus className="h-5 w-5 text-ios-teal" />
              </div>
              {generatedPassword ? 'Credenciales del Auditor' : 'Crear Auditor Externo'}
            </DialogTitle>
          </DialogHeader>

          {generatedPassword ? (
            // Show credentials
            <div className="p-6 space-y-6">
              <div className="p-4 rounded-2xl bg-ios-green/10 border border-ios-green/20">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-ios-green" />
                  <p className="font-semibold text-ios-green">Auditor Creado Exitosamente</p>
                </div>
                <p className="text-sm text-ios-gray-600">
                  Comparte estas credenciales de forma segura con el auditor. La contraseña no se puede recuperar.
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-ios-gray-50 rounded-2xl">
                  <Label className="text-xs text-ios-gray-500">Email</Label>
                  <div className="flex items-center justify-between mt-1">
                    <p className="font-mono font-semibold text-ios-gray-900">{formData.auditor_email}</p>
                    <button
                      onClick={() => copyToClipboard(formData.auditor_email)}
                      className="h-8 w-8 rounded-lg bg-ios-gray-200 flex items-center justify-center hover:bg-ios-gray-300 transition-colors"
                    >
                      <Copy className="h-4 w-4 text-ios-gray-600" />
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-ios-gray-50 rounded-2xl">
                  <Label className="text-xs text-ios-gray-500">Contraseña Temporal</Label>
                  <div className="flex items-center justify-between mt-1">
                    <p className="font-mono font-semibold text-ios-gray-900">{generatedPassword}</p>
                    <button
                      onClick={() => copyToClipboard(generatedPassword)}
                      className="h-8 w-8 rounded-lg bg-ios-gray-200 flex items-center justify-center hover:bg-ios-gray-300 transition-colors"
                    >
                      <Copy className="h-4 w-4 text-ios-gray-600" />
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-ios-orange/10 rounded-2xl border border-ios-orange/20">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-ios-orange flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-ios-gray-900 text-sm">Importante</p>
                      <p className="text-xs text-ios-gray-600 mt-1">
                        Esta contraseña solo se muestra una vez. Asegúrate de copiarla y compartirla de forma segura.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => { resetForm(); setShowCreateDialog(false); fetchData(); }}
                className="w-full h-12 rounded-xl bg-ios-blue text-white font-semibold hover:bg-ios-blue/90 transition-colors touch-feedback"
              >
                Cerrar
              </button>
            </div>
          ) : (
            // Create form
            <form onSubmit={handleCreateAuditor}>
              <div className="p-6 overflow-y-auto max-h-[60vh] space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-ios-gray-600">Nombre Completo *</Label>
                    <input
                      value={formData.auditor_name}
                      onChange={(e) => setFormData({ ...formData, auditor_name: e.target.value })}
                      required
                      className="ios-input"
                      placeholder="Juan Pérez"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-ios-gray-600">Email *</Label>
                    <input
                      type="email"
                      value={formData.auditor_email}
                      onChange={(e) => setFormData({ ...formData, auditor_email: e.target.value })}
                      required
                      className="ios-input"
                      placeholder="auditor@empresa.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-ios-gray-600">Empresa</Label>
                    <input
                      value={formData.auditor_company}
                      onChange={(e) => setFormData({ ...formData, auditor_company: e.target.value })}
                      className="ios-input"
                      placeholder="Deloitte, KPMG, etc."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-ios-gray-600">Propósito *</Label>
                    <Select
                      value={formData.purpose}
                      onValueChange={(value) => setFormData({ ...formData, purpose: value })}
                    >
                      <SelectTrigger className="ios-input">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="migration">Migración de Datos</SelectItem>
                        <SelectItem value="compliance">Cumplimiento Normativo</SelectItem>
                        <SelectItem value="financial">Auditoría Financiera</SelectItem>
                        <SelectItem value="other">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-ios-gray-600">Duración del Acceso *</Label>
                  <Select
                    value={formData.duration_hours}
                    onValueChange={(value) => setFormData({ ...formData, duration_hours: value })}
                  >
                    <SelectTrigger className="ios-input">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="24">24 horas (1 día)</SelectItem>
                      <SelectItem value="72">72 horas (3 días)</SelectItem>
                      <SelectItem value="168">168 horas (1 semana)</SelectItem>
                      <SelectItem value="336">336 horas (2 semanas)</SelectItem>
                      <SelectItem value="720">720 horas (1 mes)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-4 bg-ios-gray-50 rounded-2xl space-y-4">
                  <h4 className="font-semibold text-ios-gray-900 text-sm">Permisos de Lectura</h4>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-ios-gray-600">Pacientes</span>
                      <Switch
                        checked={formData.can_view_patients}
                        onCheckedChange={(checked) => setFormData({ ...formData, can_view_patients: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-ios-gray-600">Citas</span>
                      <Switch
                        checked={formData.can_view_appointments}
                        onCheckedChange={(checked) => setFormData({ ...formData, can_view_appointments: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-ios-gray-600">Tratamientos</span>
                      <Switch
                        checked={formData.can_view_treatments}
                        onCheckedChange={(checked) => setFormData({ ...formData, can_view_treatments: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-ios-gray-600">Pagos</span>
                      <Switch
                        checked={formData.can_view_payments}
                        onCheckedChange={(checked) => setFormData({ ...formData, can_view_payments: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-ios-gray-600">Cortes de Caja</span>
                      <Switch
                        checked={formData.can_view_cash_registers}
                        onCheckedChange={(checked) => setFormData({ ...formData, can_view_cash_registers: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-ios-gray-600">Exportar Datos</span>
                      <Switch
                        checked={formData.can_export_data}
                        onCheckedChange={(checked) => setFormData({ ...formData, can_export_data: checked })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 pt-4 border-t border-ios-gray-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => { resetForm(); setShowCreateDialog(false); }}
                  className="flex-1 h-12 rounded-xl bg-ios-gray-100 text-ios-gray-900 font-semibold hover:bg-ios-gray-200 transition-colors touch-feedback"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 h-12 rounded-xl bg-ios-teal text-white font-semibold hover:bg-ios-teal/90 transition-colors touch-feedback disabled:opacity-50"
                >
                  {saving ? 'Creando...' : 'Crear Auditor'}
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Revoke Dialog */}
      <Dialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl border-0 shadow-ios-xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="text-xl font-bold text-ios-gray-900 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-ios-red/15 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-ios-red" />
              </div>
              Revocar Acceso
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 space-y-4">
            <p className="text-sm text-ios-gray-600">
              ¿Estás seguro de revocar el acceso de <strong>{selectedSession?.auditor_name}</strong>? 
              Esta acción es irreversible y el auditor perderá acceso inmediatamente.
            </p>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-ios-gray-600">Motivo (opcional)</Label>
              <textarea
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                className="ios-input resize-none"
                rows={3}
                placeholder="Ej: Auditoría completada, acceso no autorizado, etc."
              />
            </div>
          </div>

          <div className="p-6 pt-4 flex gap-3">
            <button
              onClick={() => { setShowRevokeDialog(false); setSelectedSession(null); setRevokeReason(''); }}
              className="flex-1 h-12 rounded-xl bg-ios-gray-100 text-ios-gray-900 font-semibold hover:bg-ios-gray-200 transition-colors touch-feedback"
            >
              Cancelar
            </button>
            <button
              onClick={handleRevokeSession}
              disabled={saving}
              className="flex-1 h-12 rounded-xl bg-ios-red text-white font-semibold hover:bg-ios-red/90 transition-colors touch-feedback disabled:opacity-50"
            >
              {saving ? 'Revocando...' : 'Revocar Acceso'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default AuditSessions;