"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
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
import { supabase } from '@/integrations/supabase/client';
import { 
  Shield, 
  Search,
  Eye,
  Calendar,
  User,
  FileText,
  Plus,
  Edit,
  Trash2,
  LogIn,
  Filter,
  Download
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface AuditLog {
  id: string;
  user_id: string;
  user_email: string;
  user_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_data: any;
  new_data: any;
  metadata: any;
  created_at: string;
}

const ACTION_ICONS: Record<string, any> = {
  CREATE: Plus,
  UPDATE: Edit,
  DELETE: Trash2,
  LOGIN: LogIn,
  REGISTER: User,
  READ: Eye
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-ios-green/15 text-ios-green',
  UPDATE: 'bg-ios-blue/15 text-ios-blue',
  DELETE: 'bg-ios-red/15 text-ios-red',
  LOGIN: 'bg-ios-purple/15 text-ios-purple',
  REGISTER: 'bg-ios-teal/15 text-ios-teal',
  READ: 'bg-ios-gray-200 text-ios-gray-600'
};

const ENTITY_LABELS: Record<string, string> = {
  patients: 'Pacientes',
  appointments: 'Citas',
  payments: 'Pagos',
  treatments: 'Tratamientos',
  cash_registers: 'Cortes de Caja',
  users: 'Usuarios',
  prescriptions: 'Recetas'
};

const AuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');

  // Filters
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterEntity, setFilterEntity] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchData();
  }, [filterAction, filterEntity, dateFrom, dateTo]);

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

      if (currentProfile?.role !== 'admin') {
        toast.error('No tienes permisos para acceder a esta página');
        return;
      }

      // Build query
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (filterAction !== 'all') {
        query = query.eq('action', filterAction);
      }

      if (filterEntity !== 'all') {
        query = query.eq('entity_type', filterEntity);
      }

      if (dateFrom) {
        query = query.gte('created_at', new Date(dateFrom).toISOString());
      }

      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
      toast.error('Error al cargar logs');
    } finally {
      setLoading(false);
    }
  };

  const openDetail = (log: AuditLog) => {
    setSelectedLog(log);
    setShowDetailDialog(true);
  };

  const exportLogs = () => {
    const csvContent = [
      ['Fecha', 'Usuario', 'Rol', 'Acción', 'Entidad', 'ID Entidad'].join(','),
      ...logs.map(log => [
        format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
        log.user_email,
        log.user_role,
        log.action,
        log.entity_type,
        log.entity_id || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit_logs_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      log.user_email?.toLowerCase().includes(search) ||
      log.entity_type?.toLowerCase().includes(search) ||
      log.action?.toLowerCase().includes(search)
    );
  });

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

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">Logs de Auditoría</h1>
          <p className="text-ios-gray-500 mt-1 font-medium">Registro de todas las acciones del sistema</p>
        </div>
        <button
          onClick={exportLogs}
          className="flex items-center gap-2 h-11 px-5 rounded-xl bg-ios-green text-white font-semibold text-sm shadow-ios-sm hover:bg-ios-green/90 transition-all duration-200 touch-feedback"
        >
          <Download className="h-5 w-5" />
          Exportar CSV
        </button>
      </div>

      {/* Filters */}
      <div className="ios-card p-5 mb-6 animate-slide-up">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-ios-gray-500" />
          <h3 className="font-semibold text-ios-gray-900">Filtros</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ios-gray-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ios-input pl-12"
            />
          </div>
          
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="ios-input">
              <SelectValue placeholder="Acción" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Todas las acciones</SelectItem>
              <SelectItem value="CREATE">Crear</SelectItem>
              <SelectItem value="UPDATE">Actualizar</SelectItem>
              <SelectItem value="DELETE">Eliminar</SelectItem>
              <SelectItem value="LOGIN">Login</SelectItem>
              <SelectItem value="REGISTER">Registro</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterEntity} onValueChange={setFilterEntity}>
            <SelectTrigger className="ios-input">
              <SelectValue placeholder="Entidad" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Todas las entidades</SelectItem>
              <SelectItem value="patients">Pacientes</SelectItem>
              <SelectItem value="appointments">Citas</SelectItem>
              <SelectItem value="payments">Pagos</SelectItem>
              <SelectItem value="cash_registers">Cortes de Caja</SelectItem>
              <SelectItem value="users">Usuarios</SelectItem>
            </SelectContent>
          </Select>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="ios-input"
            placeholder="Desde"
          />

          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="ios-input"
            placeholder="Hasta"
          />
        </div>
      </div>

      {/* Logs List */}
      <div className="ios-card overflow-hidden animate-slide-up" style={{ animationDelay: '100ms' }}>
        <div className="p-5 border-b border-ios-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-ios-gray-900">Registros ({filteredLogs.length})</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 border-3 border-ios-blue/30 border-t-ios-blue rounded-full animate-spin"></div>
          </div>
        ) : filteredLogs.length > 0 ? (
          <div className="divide-y divide-ios-gray-100 max-h-[600px] overflow-y-auto">
            {filteredLogs.map((log, index) => {
              const ActionIcon = ACTION_ICONS[log.action] || FileText;
              
              return (
                <div
                  key={log.id}
                  className="flex items-center gap-4 p-4 hover:bg-ios-gray-50 transition-all duration-200 cursor-pointer"
                  onClick={() => openDetail(log)}
                >
                  {/* Action Icon */}
                  <div className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center",
                    ACTION_COLORS[log.action] || 'bg-ios-gray-100'
                  )}>
                    <ActionIcon className="h-5 w-5" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-semibold",
                        ACTION_COLORS[log.action]
                      )}>
                        {log.action}
                      </span>
                      <span className="text-sm text-ios-gray-500">
                        {ENTITY_LABELS[log.entity_type] || log.entity_type}
                      </span>
                    </div>
                    <p className="text-sm text-ios-gray-600 mt-1">
                      <span className="font-medium">{log.user_email}</span>
                      {log.user_role && (
                        <span className="text-ios-gray-400"> ({log.user_role})</span>
                      )}
                    </p>
                  </div>

                  {/* Timestamp */}
                  <div className="text-right">
                    <p className="text-sm font-medium text-ios-gray-900">
                      {format(new Date(log.created_at), 'HH:mm:ss')}
                    </p>
                    <p className="text-xs text-ios-gray-500">
                      {format(new Date(log.created_at), 'dd/MM/yyyy')}
                    </p>
                  </div>

                  <Eye className="h-5 w-5 text-ios-gray-400" />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <FileText className="h-16 w-16 text-ios-gray-300 mx-auto mb-4" />
            <p className="text-ios-gray-500">No hay registros de auditoría</p>
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl rounded-3xl border-0 shadow-ios-xl p-0 overflow-hidden max-h-[90vh]">
          <DialogHeader className="p-6 pb-4 border-b border-ios-gray-100">
            <DialogTitle className="text-xl font-bold text-ios-gray-900 flex items-center gap-3">
              <div className={cn(
                "h-10 w-10 rounded-xl flex items-center justify-center",
                ACTION_COLORS[selectedLog?.action || '']
              )}>
                {selectedLog && React.createElement(ACTION_ICONS[selectedLog.action] || FileText, { className: "h-5 w-5" })}
              </div>
              Detalle del Registro
            </DialogTitle>
          </DialogHeader>

          {selectedLog && (
            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-ios-gray-50 rounded-2xl">
                  <p className="text-xs text-ios-gray-500 mb-1">Fecha y Hora</p>
                  <p className="font-medium text-ios-gray-900">
                    {format(new Date(selectedLog.created_at), "d 'de' MMMM yyyy, HH:mm:ss", { locale: es })}
                  </p>
                </div>
                <div className="p-4 bg-ios-gray-50 rounded-2xl">
                  <p className="text-xs text-ios-gray-500 mb-1">Usuario</p>
                  <p className="font-medium text-ios-gray-900">{selectedLog.user_email}</p>
                  <p className="text-xs text-ios-gray-500">{selectedLog.user_role}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-ios-gray-50 rounded-2xl">
                  <p className="text-xs text-ios-gray-500 mb-1">Acción</p>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-sm font-semibold",
                    ACTION_COLORS[selectedLog.action]
                  )}>
                    {selectedLog.action}
                  </span>
                </div>
                <div className="p-4 bg-ios-gray-50 rounded-2xl">
                  <p className="text-xs text-ios-gray-500 mb-1">Entidad</p>
                  <p className="font-medium text-ios-gray-900">
                    {ENTITY_LABELS[selectedLog.entity_type] || selectedLog.entity_type}
                  </p>
                  {selectedLog.entity_id && (
                    <p className="text-xs text-ios-gray-500 font-mono">{selectedLog.entity_id}</p>
                  )}
                </div>
              </div>

              {/* Old Data */}
              {selectedLog.old_data && (
                <div>
                  <h4 className="font-semibold text-ios-gray-900 mb-2 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-ios-red"></span>
                    Datos Anteriores
                  </h4>
                  <pre className="p-4 bg-ios-red/5 rounded-2xl text-xs overflow-x-auto border border-ios-red/20">
                    {JSON.stringify(selectedLog.old_data, null, 2)}
                  </pre>
                </div>
              )}

              {/* New Data */}
              {selectedLog.new_data && (
                <div>
                  <h4 className="font-semibold text-ios-gray-900 mb-2 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-ios-green"></span>
                    Datos Nuevos
                  </h4>
                  <pre className="p-4 bg-ios-green/5 rounded-2xl text-xs overflow-x-auto border border-ios-green/20">
                    {JSON.stringify(selectedLog.new_data, null, 2)}
                  </pre>
                </div>
              )}

              {/* Metadata */}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <h4 className="font-semibold text-ios-gray-900 mb-2">Metadata</h4>
                  <pre className="p-4 bg-ios-gray-50 rounded-2xl text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          <div className="p-6 pt-4 border-t border-ios-gray-100">
            <button
              onClick={() => setShowDetailDialog(false)}
              className="w-full h-12 rounded-xl bg-ios-gray-100 text-ios-gray-900 font-semibold hover:bg-ios-gray-200 transition-colors touch-feedback"
            >
              Cerrar
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default AuditLogs;