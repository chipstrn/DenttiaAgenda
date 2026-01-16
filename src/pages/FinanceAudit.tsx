"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
import { useAuth } from '@/contexts/AuthContext';
import { 
  ClipboardCheck, AlertTriangle, CheckCircle, XCircle,
  Loader2, Eye, Calculator, FileText, TrendingUp, TrendingDown,
  Edit3, Save, Calendar, BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, subWeeks, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface CashRegister {
  id: string;
  user_id: string;
  cashier_id: string;
  register_date: string;
  opening_balance: number;
  closing_balance: number;
  services_cash: number;
  services_card: number;
  services_transfer: number;
  products_cash: number;
  products_card: number;
  products_transfer: number;
  expenses: number;
  other_income: number;
  cash_withdrawals: number;
  system_total: number;
  difference: number;
  status: string;
  admin_notes: string;
  created_at: string;
  profiles?: {
    first_name: string;
    last_name: string;
  };
}

const FinanceAudit = () => {
  const { user } = useAuth();
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegister, setSelectedRegister] = useState<CashRegister | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
  const [selectedWeek, setSelectedWeek] = useState(0); // 0 = current week, 1 = last week, etc.
  
  // Modo de auditoría externa (para migración)
  const [useManualSource, setUseManualSource] = useState(true);
  const [manualExpected, setManualExpected] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [systemExpected, setSystemExpected] = useState(0);

  const fetchRegisters = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('cash_registers')
        .select('*, profiles(first_name, last_name)')
        .order('register_date', { ascending: false });

      if (error) throw error;
      setRegisters(data || []);
    } catch (error) {
      console.error('Error fetching registers:', error);
      toast.error('Error al cargar cortes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRegisters();
  }, [fetchRegisters]);

  const fetchSystemExpected = useCallback(async (date: string) => {
    try {
      const startOfDay = `${date}T00:00:00`;
      const endOfDay = `${date}T23:59:59`;

      const { data: payments, error } = await supabase
        .from('payments')
        .select('amount, payment_method')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .eq('status', 'completed');

      if (error) throw error;

      const total = (payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      setSystemExpected(total);
    } catch (error) {
      console.error('Error fetching system expected:', error);
      setSystemExpected(0);
    }
  }, []);

  const openDetail = useCallback(async (register: CashRegister) => {
    setSelectedRegister(register);
    setAdminNotes(register.admin_notes || '');
    
    if (register.system_total > 0) {
      setManualExpected(register.system_total.toString());
    } else {
      setManualExpected('');
    }
    
    setUseManualSource(true);
    await fetchSystemExpected(register.register_date);
    setIsDetailOpen(true);
  }, [fetchSystemExpected]);

  const calculateDifference = useCallback(() => {
    if (!selectedRegister) return { difference: 0, expected: 0 };
    
    const declared = selectedRegister.closing_balance;
    const expected = useManualSource 
      ? (parseFloat(manualExpected) || 0)
      : systemExpected;
    
    return {
      difference: declared - expected,
      expected
    };
  }, [selectedRegister, useManualSource, manualExpected, systemExpected]);

  const handleApprove = async () => {
    if (!selectedRegister || !user?.id) return;
    
    const { difference, expected } = calculateDifference();
    
    if (useManualSource && !manualExpected) {
      toast.error('Ingresa el monto esperado del sistema externo');
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from('cash_registers')
        .update({
          status: 'approved',
          system_total: expected,
          difference: difference,
          admin_notes: adminNotes,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id
        })
        .eq('id', selectedRegister.id);

      if (error) throw error;

      toast.success('Corte aprobado');
      setIsDetailOpen(false);
      fetchRegisters();
    } catch (error) {
      console.error('Error approving register:', error);
      toast.error('Error al aprobar');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRegister || !user?.id) return;
    if (!adminNotes.trim()) {
      toast.error('Debes agregar una nota explicando el rechazo');
      return;
    }
    setSaving(true);

    try {
      const { error } = await supabase
        .from('cash_registers')
        .update({
          status: 'rejected',
          admin_notes: adminNotes,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id
        })
        .eq('id', selectedRegister.id);

      if (error) throw error;

      toast.success('Corte rechazado');
      setIsDetailOpen(false);
      fetchRegisters();
    } catch (error) {
      console.error('Error rejecting register:', error);
      toast.error('Error al rechazar');
    } finally {
      setSaving(false);
    }
  };

  // Weekly audit calculations
  const weeklyData = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(subWeeks(now, selectedWeek), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(subWeeks(now, selectedWeek), { weekStartsOn: 1 });

    const weekRegisters = registers.filter(r => {
      const date = parseISO(r.register_date);
      return date >= weekStart && date <= weekEnd;
    });

    const totalDeclared = weekRegisters.reduce((sum, r) => sum + r.closing_balance, 0);
    const totalExpected = weekRegisters.reduce((sum, r) => sum + (r.system_total || 0), 0);
    const totalDifference = weekRegisters.reduce((sum, r) => sum + (r.difference || 0), 0);
    const approvedCount = weekRegisters.filter(r => r.status === 'approved').length;
    const pendingCount = weekRegisters.filter(r => r.status === 'pending').length;

    return {
      weekStart,
      weekEnd,
      registers: weekRegisters,
      totalDeclared,
      totalExpected,
      totalDifference,
      approvedCount,
      pendingCount,
      totalCount: weekRegisters.length
    };
  }, [registers, selectedWeek]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-ios-green/10 text-ios-green font-medium">
            <CheckCircle className="h-3 w-3" />
            Aprobado
          </span>
        );
      case 'rejected':
        return (
          <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-ios-red/10 text-ios-red font-medium">
            <XCircle className="h-3 w-3" />
            Rechazado
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-ios-orange/10 text-ios-orange font-medium">
            <AlertTriangle className="h-3 w-3" />
            Pendiente
          </span>
        );
    }
  };

  const { difference, expected } = calculateDifference();

  const pendingCount = registers.filter(r => r.status === 'pending').length;
  const approvedCount = registers.filter(r => r.status === 'approved').length;
  const withShortage = registers.filter(r => r.status === 'approved' && r.difference < 0).length;
  const withSurplus = registers.filter(r => r.status === 'approved' && r.difference > 0).length;

  return (
    <MainLayout>
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">Auditoría Financiera</h1>
        <p className="text-ios-gray-500 mt-1 font-medium">Revisión de cortes de caja - Modo Migración</p>
      </div>

      {/* Info Banner */}
      <div className="mb-6 p-4 rounded-2xl bg-ios-blue/10 border border-ios-blue/20 animate-fade-in">
        <div className="flex items-start gap-3">
          <Edit3 className="h-5 w-5 text-ios-blue mt-0.5" />
          <div>
            <p className="font-semibold text-ios-blue">Modo Auditoría Externa Activo</p>
            <p className="text-sm text-ios-gray-600 mt-1">
              Ingresa manualmente el "Dinero Esperado" desde tu sistema anterior para compararlo con lo declarado por recepción.
            </p>
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2 mb-6 animate-fade-in">
        <button
          onClick={() => setViewMode('daily')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all",
            viewMode === 'daily' 
              ? 'bg-ios-blue text-white' 
              : 'bg-ios-gray-100 text-ios-gray-600 hover:bg-ios-gray-200'
          )}
        >
          <Calendar className="h-4 w-4" />
          Diario
        </button>
        <button
          onClick={() => setViewMode('weekly')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all",
            viewMode === 'weekly' 
              ? 'bg-ios-blue text-white' 
              : 'bg-ios-gray-100 text-ios-gray-600 hover:bg-ios-gray-200'
          )}
        >
          <BarChart3 className="h-4 w-4" />
          Semanal
        </button>
      </div>

      {viewMode === 'weekly' ? (
        /* Weekly Audit View */
        <>
          {/* Week Selector */}
          <div className="mb-6 animate-fade-in">
            <Select value={selectedWeek.toString()} onValueChange={(v) => setSelectedWeek(parseInt(v))}>
              <SelectTrigger className="w-[250px] ios-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="0">Esta semana</SelectItem>
                <SelectItem value="1">Semana pasada</SelectItem>
                <SelectItem value="2">Hace 2 semanas</SelectItem>
                <SelectItem value="3">Hace 3 semanas</SelectItem>
                <SelectItem value="4">Hace 4 semanas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Weekly Summary Card */}
          <div className="ios-card p-6 mb-6 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-ios-gray-900">
                Resumen Semanal
              </h2>
              <span className="text-sm text-ios-gray-500">
                {format(weeklyData.weekStart, "d MMM", { locale: es })} - {format(weeklyData.weekEnd, "d MMM yyyy", { locale: es })}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-ios-gray-50">
                <p className="text-sm text-ios-gray-500">Cortes Totales</p>
                <p className="text-2xl font-bold text-ios-gray-900">{weeklyData.totalCount}</p>
              </div>
              <div className="p-4 rounded-xl bg-ios-green/10">
                <p className="text-sm text-ios-green">Aprobados</p>
                <p className="text-2xl font-bold text-ios-green">{weeklyData.approvedCount}</p>
              </div>
              <div className="p-4 rounded-xl bg-ios-orange/10">
                <p className="text-sm text-ios-orange">Pendientes</p>
                <p className="text-2xl font-bold text-ios-orange">{weeklyData.pendingCount}</p>
              </div>
              <div className={cn(
                "p-4 rounded-xl",
                weeklyData.totalDifference < 0 ? 'bg-ios-red/10' : 
                weeklyData.totalDifference > 0 ? 'bg-ios-blue/10' : 'bg-ios-gray-50'
              )}>
                <p className={cn(
                  "text-sm",
                  weeklyData.totalDifference < 0 ? 'text-ios-red' : 
                  weeklyData.totalDifference > 0 ? 'text-ios-blue' : 'text-ios-gray-500'
                )}>
                  Diferencia Total
                </p>
                <p className={cn(
                  "text-2xl font-bold",
                  weeklyData.totalDifference < 0 ? 'text-ios-red' : 
                  weeklyData.totalDifference > 0 ? 'text-ios-blue' : 'text-ios-gray-900'
                )}>
                  {weeklyData.totalDifference === 0 ? '$0.00' :
                   weeklyData.totalDifference < 0 ? `-$${Math.abs(weeklyData.totalDifference).toFixed(2)}` : 
                   `+$${weeklyData.totalDifference.toFixed(2)}`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-ios-gray-200">
                <p className="text-sm text-ios-gray-500 mb-1">Total Declarado (Recepción)</p>
                <p className="text-xl font-bold text-ios-gray-900">
                  ${weeklyData.totalDeclared.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-4 rounded-xl border border-ios-gray-200">
                <p className="text-sm text-ios-gray-500 mb-1">Total Esperado (Sistema)</p>
                <p className="text-xl font-bold text-ios-gray-900">
                  ${weeklyData.totalExpected.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          {/* Weekly Registers List */}
          <div className="ios-card overflow-hidden animate-slide-up">
            <div className="p-5 border-b border-ios-gray-100">
              <h2 className="text-lg font-bold text-ios-gray-900">Cortes de la Semana</h2>
            </div>
            
            {weeklyData.registers.length > 0 ? (
              <div className="divide-y divide-ios-gray-100">
                {weeklyData.registers.map((register, index) => (
                  <div 
                    key={register.id}
                    className="flex items-center gap-4 p-4 hover:bg-ios-gray-50 transition-all cursor-pointer"
                    onClick={() => openDetail(register)}
                  >
                    <div className={cn(
                      "h-12 w-12 rounded-2xl flex items-center justify-center",
                      register.status === 'approved' ? 'bg-ios-green/15' :
                      register.status === 'rejected' ? 'bg-ios-red/15' : 'bg-ios-orange/15'
                    )}>
                      <ClipboardCheck className={cn(
                        "h-6 w-6",
                        register.status === 'approved' ? 'text-ios-green' :
                        register.status === 'rejected' ? 'text-ios-red' : 'text-ios-orange'
                      )} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-ios-gray-900">
                          {register.profiles?.first_name} {register.profiles?.last_name}
                        </p>
                        {getStatusBadge(register.status)}
                      </div>
                      <p className="text-sm text-ios-gray-500 mt-1">
                        {format(parseISO(register.register_date), "EEEE d", { locale: es })}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-ios-gray-900">
                        ${register.closing_balance.toFixed(2)}
                      </p>
                      {register.status === 'approved' && register.difference !== 0 && (
                        <p className={cn(
                          "text-sm font-semibold",
                          register.difference < 0 ? 'text-ios-red' : 'text-ios-green'
                        )}>
                          {register.difference < 0 ? '-' : '+'}${Math.abs(register.difference).toFixed(2)}
                        </p>
                      )}
                    </div>

                    <Eye className="h-5 w-5 text-ios-gray-300" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-ios-gray-500">No hay cortes para esta semana</p>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Daily View (Original) */
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
            <div className="ios-card p-5 animate-slide-up">
              <div className="flex items-start justify-between mb-4">
                <div className="h-11 w-11 rounded-2xl bg-ios-orange flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-white" />
                </div>
              </div>
              <p className="text-2xl font-bold text-ios-gray-900">{pendingCount}</p>
              <p className="text-sm text-ios-gray-500 font-medium mt-1">Pendientes</p>
            </div>
            
            <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '50ms' }}>
              <div className="flex items-start justify-between mb-4">
                <div className="h-11 w-11 rounded-2xl bg-ios-green flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-white" />
                </div>
              </div>
              <p className="text-2xl font-bold text-ios-gray-900">{approvedCount}</p>
              <p className="text-sm text-ios-gray-500 font-medium mt-1">Aprobados</p>
            </div>
            
            <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '100ms' }}>
              <div className="flex items-start justify-between mb-4">
                <div className="h-11 w-11 rounded-2xl bg-ios-red flex items-center justify-center">
                  <TrendingDown className="h-5 w-5 text-white" />
                </div>
              </div>
              <p className="text-2xl font-bold text-ios-gray-900">{withShortage}</p>
              <p className="text-sm text-ios-gray-500 font-medium mt-1">Con Faltante</p>
            </div>
            
            <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '150ms' }}>
              <div className="flex items-start justify-between mb-4">
                <div className="h-11 w-11 rounded-2xl bg-ios-blue flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
              </div>
              <p className="text-2xl font-bold text-ios-gray-900">{withSurplus}</p>
              <p className="text-sm text-ios-gray-500 font-medium mt-1">Con Sobrante</p>
            </div>
          </div>

          {/* Registers List */}
          <div className="ios-card overflow-hidden animate-slide-up" style={{ animationDelay: '200ms' }}>
            <div className="p-5 border-b border-ios-gray-100">
              <h2 className="text-lg font-bold text-ios-gray-900">Cortes de Caja</h2>
              <p className="text-sm text-ios-gray-500 mt-1">Haz clic en un corte para revisarlo</p>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-ios-blue" />
              </div>
            ) : registers.length > 0 ? (
              <div className="divide-y divide-ios-gray-100">
                {registers.map((register, index) => (
                  <div 
                    key={register.id}
                    className="flex items-center gap-4 p-4 hover:bg-ios-gray-50 transition-all duration-200 ease-ios cursor-pointer animate-fade-in"
                    style={{ animationDelay: `${250 + index * 30}ms` }}
                    onClick={() => openDetail(register)}
                  >
                    <div className={cn(
                      "h-12 w-12 rounded-2xl flex items-center justify-center",
                      register.status === 'approved' ? 'bg-ios-green/15' :
                      register.status === 'rejected' ? 'bg-ios-red/15' : 'bg-ios-orange/15'
                    )}>
                      <ClipboardCheck className={cn(
                        "h-6 w-6",
                        register.status === 'approved' ? 'text-ios-green' :
                        register.status === 'rejected' ? 'text-ios-red' : 'text-ios-orange'
                      )} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-ios-gray-900">
                          {register.profiles?.first_name} {register.profiles?.last_name}
                        </p>
                        {getStatusBadge(register.status)}
                      </div>
                      <p className="text-sm text-ios-gray-500 mt-1">
                        {format(parseISO(register.register_date), "EEEE, d 'de' MMMM", { locale: es })}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-ios-gray-900">
                        ${register.closing_balance.toFixed(2)}
                      </p>
                      <p className="text-xs text-ios-gray-500">Declarado</p>
                      {register.status === 'approved' && register.difference !== 0 && (
                        <p className={cn(
                          "text-sm font-semibold mt-1",
                          register.difference < 0 ? 'text-ios-red' : 'text-ios-green'
                        )}>
                          {register.difference < 0 ? 'Faltante' : 'Sobrante'}: ${Math.abs(register.difference).toFixed(2)}
                        </p>
                      )}
                    </div>

                    <Eye className="h-5 w-5 text-ios-gray-300" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="h-20 w-20 rounded-full bg-ios-gray-100 flex items-center justify-center mx-auto mb-4">
                  <ClipboardCheck className="h-10 w-10 text-ios-gray-400" />
                </div>
                <p className="text-ios-gray-900 font-semibold">Sin cortes</p>
                <p className="text-ios-gray-500 text-sm mt-1">No hay cortes de caja registrados</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-[650px] rounded-3xl border-0 shadow-ios-xl p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
          <DialogHeader className="p-6 pb-4 sticky top-0 bg-white z-10 border-b border-ios-gray-100">
            <DialogTitle className="text-xl font-bold text-ios-gray-900">
              Revisión de Corte de Caja
            </DialogTitle>
            <DialogDescription className="text-ios-gray-500">
              {selectedRegister && format(parseISO(selectedRegister.register_date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
            </DialogDescription>
          </DialogHeader>
          
          {selectedRegister && (
            <div className="px-6 pb-6 space-y-6">
              {/* Cajero */}
              <div className="p-4 rounded-2xl bg-ios-gray-50">
                <p className="text-sm text-ios-gray-500 mb-1">Cajero</p>
                <p className="font-semibold text-ios-gray-900 text-lg">
                  {selectedRegister.profiles?.first_name} {selectedRegister.profiles?.last_name}
                </p>
              </div>

              {/* Lo que declaró Recepción */}
              <div className="p-4 rounded-2xl bg-ios-blue/5 border border-ios-blue/20">
                <div className="flex items-center gap-2 mb-4">
                  <Calculator className="h-5 w-5 text-ios-blue" />
                  <p className="font-semibold text-ios-blue">Declarado por Recepción</p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-ios-gray-500">Saldo Inicial</p>
                    <p className="font-medium">${selectedRegister.opening_balance.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-ios-gray-500">Servicios (Efectivo)</p>
                    <p className="font-medium">${selectedRegister.services_cash.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-ios-gray-500">Servicios (Tarjeta)</p>
                    <p className="font-medium">${selectedRegister.services_card.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-ios-gray-500">Servicios (Transfer)</p>
                    <p className="font-medium">${selectedRegister.services_transfer.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-ios-gray-500">Gastos</p>
                    <p className="font-medium text-ios-red">-${selectedRegister.expenses.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-ios-gray-500">Retiros</p>
                    <p className="font-medium text-ios-red">-${selectedRegister.cash_withdrawals.toFixed(2)}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-ios-blue/20">
                  <div className="flex justify-between items-center">
                    <p className="font-semibold text-ios-gray-900">Total Declarado en Caja</p>
                    <p className="text-2xl font-bold text-ios-blue">${selectedRegister.closing_balance.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Saldo Sistema (Origen Externo) - EDITABLE */}
              {selectedRegister.status === 'pending' && (
                <div className="p-4 rounded-2xl bg-ios-orange/5 border-2 border-ios-orange/30">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-ios-orange" />
                      <p className="font-semibold text-ios-orange">Saldo Sistema (Origen Externo)</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs font-medium", !useManualSource ? 'text-ios-gray-900' : 'text-ios-gray-400')}>
                        Denttia
                      </span>
                      <Switch
                        checked={useManualSource}
                        onCheckedChange={setUseManualSource}
                      />
                      <span className={cn("text-xs font-medium", useManualSource ? 'text-ios-gray-900' : 'text-ios-gray-400')}>
                        Manual
                      </span>
                    </div>
                  </div>

                  {useManualSource ? (
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-ios-gray-600">
                        Ingresa el total esperado según tu sistema anterior
                      </Label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ios-gray-400 font-bold text-lg">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={manualExpected}
                          onChange={(e) => setManualExpected(e.target.value)}
                          placeholder="Ej: 7100.00"
                          className="ios-input pl-10 text-lg font-semibold h-14"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-ios-gray-500 mb-2">Total del sistema Denttia</p>
                      <p className="text-3xl font-bold text-ios-gray-900">${systemExpected.toFixed(2)}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Resultado de Auditoría */}
              {selectedRegister.status === 'pending' && (useManualSource ? manualExpected : true) && expected > 0 && (
                <div className={cn(
                  "p-5 rounded-2xl border-2",
                  difference === 0 ? 'bg-ios-green/5 border-ios-green/30' :
                  difference < 0 ? 'bg-ios-red/5 border-ios-red/30' : 'bg-ios-blue/5 border-ios-blue/30'
                )}>
                  <div className="flex items-center gap-2 mb-4">
                    <Save className="h-5 w-5 text-ios-gray-600" />
                    <p className="font-semibold text-ios-gray-900">Auditoría Automática</p>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-center mb-4">
                    <div>
                      <p className="text-sm text-ios-gray-500">Esperado</p>
                      <p className="text-xl font-bold text-ios-gray-900">${expected.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-ios-gray-500">Declarado</p>
                      <p className="text-xl font-bold text-ios-gray-900">${selectedRegister.closing_balance.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-ios-gray-500">Diferencia</p>
                      <p className={cn(
                        "text-xl font-bold",
                        difference === 0 ? 'text-ios-green' :
                        difference < 0 ? 'text-ios-red' : 'text-ios-blue'
                      )}>
                        {difference === 0 ? '$0.00' :
                         difference < 0 ? `-$${Math.abs(difference).toFixed(2)}` : `+$${difference.toFixed(2)}`}
                      </p>
                    </div>
                  </div>

                  <div className={cn(
                    "p-3 rounded-xl text-center",
                    difference === 0 ? 'bg-ios-green/10' :
                    difference < 0 ? 'bg-ios-red/10' : 'bg-ios-blue/10'
                  )}>
                    <p className={cn(
                      "text-lg font-bold",
                      difference === 0 ? 'text-ios-green' :
                      difference < 0 ? 'text-ios-red' : 'text-ios-blue'
                    )}>
                      {difference === 0 ? '✓ CUADRA PERFECTO' :
                       difference < 0 ? '⚠️ FALTANTE' : '📈 SOBRANTE'}
                    </p>
                  </div>
                </div>
              )}

              {/* Notas */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">
                  Notas de Auditoría
                </Label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                  placeholder="Ej: Faltaron $100, se pagó el garrafón..."
                  className="ios-input resize-none"
                  disabled={selectedRegister.status !== 'pending'}
                />
              </div>

              {/* Actions */}
              {selectedRegister.status === 'pending' && (
                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={handleReject}
                    disabled={saving}
                    className="flex-1 h-12 rounded-xl bg-ios-red/10 text-ios-red font-semibold hover:bg-ios-red/20 transition-colors touch-feedback disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                  <button 
                    onClick={handleApprove}
                    disabled={saving || (useManualSource && !manualExpected)}
                    className="flex-1 h-12 rounded-xl bg-ios-green text-white font-semibold hover:bg-ios-green/90 transition-colors touch-feedback disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      'Aprobar Corte'
                    )}
                  </button>
                </div>
              )}

              {/* Already reviewed */}
              {selectedRegister.status !== 'pending' && (
                <div className={cn(
                  "p-4 rounded-2xl",
                  selectedRegister.status === 'approved' ? 'bg-ios-green/10' : 'bg-ios-red/10'
                )}>
                  <div className="text-center mb-3">
                    <p className={cn(
                      "font-bold text-lg",
                      selectedRegister.status === 'approved' ? 'text-ios-green' : 'text-ios-red'
                    )}>
                      {selectedRegister.status === 'approved' ? '✓ Corte Aprobado' : '✗ Corte Rechazado'}
                    </p>
                  </div>
                  
                  {selectedRegister.status === 'approved' && (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-ios-gray-500">Esperado</p>
                        <p className="font-semibold">${selectedRegister.system_total?.toFixed(2) || '0.00'}</p>
                      </div>
                      <div>
                        <p className="text-ios-gray-500">Diferencia</p>
                        <p className={cn(
                          "font-semibold",
                          selectedRegister.difference < 0 ? 'text-ios-red' : 
                          selectedRegister.difference > 0 ? 'text-ios-blue' : 'text-ios-green'
                        )}>
                          {selectedRegister.difference === 0 ? 'Cuadra' :
                           selectedRegister.difference < 0 ? `-$${Math.abs(selectedRegister.difference).toFixed(2)}` : 
                           `+$${selectedRegister.difference.toFixed(2)}`}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {selectedRegister.admin_notes && (
                    <div className="mt-3 pt-3 border-t border-ios-gray-200">
                      <p className="text-sm text-ios-gray-500">Notas:</p>
                      <p className="text-ios-gray-900">{selectedRegister.admin_notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default FinanceAudit;