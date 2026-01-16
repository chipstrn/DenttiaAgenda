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
import { supabase } from '@/integrations/supabase/client';
import { 
  ClipboardCheck, AlertTriangle, CheckCircle, XCircle,
  Loader2, Eye, Calculator, FileText, TrendingUp, TrendingDown
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
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
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegister, setSelectedRegister] = useState<CashRegister | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Modo de auditoría
  const [useManualSource, setUseManualSource] = useState(false);
  const [manualExpected, setManualExpected] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [systemExpected, setSystemExpected] = useState(0);

  useEffect(() => {
    fetchRegisters();
  }, []);

  const fetchRegisters = async () => {
    try {
      const { data, error } = await supabase
        .from('cash_registers')
        .select('*, profiles!cash_registers_cashier_id_fkey(first_name, last_name)')
        .order('register_date', { ascending: false });

      if (error) throw error;
      setRegisters(data || []);
    } catch (error) {
      console.error('Error fetching registers:', error);
      toast.error('Error al cargar cortes');
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemExpected = async (date: string, userId: string) => {
    try {
      // Calcular el total esperado del sistema basado en pagos del día
      const startOfDay = `${date}T00:00:00`;
      const endOfDay = `${date}T23:59:59`;

      const { data: payments, error } = await supabase
        .from('payments')
        .select('amount, payment_method')
        .eq('user_id', userId)
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
  };

  const openDetail = async (register: CashRegister) => {
    setSelectedRegister(register);
    setAdminNotes(register.admin_notes || '');
    setManualExpected('');
    setUseManualSource(false);
    
    // Cargar el esperado del sistema
    await fetchSystemExpected(register.register_date, register.user_id);
    
    setIsDetailOpen(true);
  };

  const calculateDifference = () => {
    if (!selectedRegister) return 0;
    
    const declared = selectedRegister.closing_balance;
    const expected = useManualSource 
      ? (parseFloat(manualExpected) || 0)
      : systemExpected;
    
    return expected - declared;
  };

  const handleApprove = async () => {
    if (!selectedRegister) return;
    setSaving(true);

    try {
      const difference = calculateDifference();
      const expected = useManualSource 
        ? (parseFloat(manualExpected) || 0)
        : systemExpected;

      const { error } = await supabase
        .from('cash_registers')
        .update({
          status: 'approved',
          system_total: expected,
          difference: difference,
          admin_notes: adminNotes,
          reviewed_at: new Date().toISOString()
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
    if (!selectedRegister) return;
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
          reviewed_at: new Date().toISOString()
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

  const difference = calculateDifference();

  return (
    <MainLayout>
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">Auditoría Financiera</h1>
        <p className="text-ios-gray-500 mt-1 font-medium">Revisión de cortes de caja</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
        <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '0ms' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="h-11 w-11 rounded-2xl bg-ios-orange flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-ios-gray-900">
            {registers.filter(r => r.status === 'pending').length}
          </p>
          <p className="text-sm text-ios-gray-500 font-medium mt-1">Pendientes</p>
        </div>
        
        <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '50ms' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="h-11 w-11 rounded-2xl bg-ios-green flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-ios-gray-900">
            {registers.filter(r => r.status === 'approved').length}
          </p>
          <p className="text-sm text-ios-gray-500 font-medium mt-1">Aprobados</p>
        </div>
        
        <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="h-11 w-11 rounded-2xl bg-ios-red flex items-center justify-center">
              <TrendingDown className="h-5 w-5 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-ios-gray-900">
            {registers.filter(r => r.difference < 0).length}
          </p>
          <p className="text-sm text-ios-gray-500 font-medium mt-1">Con Faltante</p>
        </div>
        
        <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '150ms' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="h-11 w-11 rounded-2xl bg-ios-blue flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-ios-gray-900">
            {registers.filter(r => r.difference > 0).length}
          </p>
          <p className="text-sm text-ios-gray-500 font-medium mt-1">Con Sobrante</p>
        </div>
      </div>

      {/* Registers List */}
      <div className="ios-card overflow-hidden animate-slide-up" style={{ animationDelay: '200ms' }}>
        <div className="p-5 border-b border-ios-gray-100">
          <h2 className="text-lg font-bold text-ios-gray-900">Cortes de Caja</h2>
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
                    {format(new Date(register.register_date), "EEEE, d 'de' MMMM", { locale: es })}
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-bold text-ios-gray-900">
                    ${register.closing_balance.toFixed(2)}
                  </p>
                  {register.difference !== 0 && register.status !== 'pending' && (
                    <p className={cn(
                      "text-sm font-medium",
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
            <div className="h-20 w-20 rounded-full bg-ios-gray-100 flex items-center justify-center mx-auto mb-4">
              <ClipboardCheck className="h-10 w-10 text-ios-gray-400" />
            </div>
            <p className="text-ios-gray-900 font-semibold">Sin cortes</p>
            <p className="text-ios-gray-500 text-sm mt-1">No hay cortes de caja registrados</p>
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-[600px] rounded-3xl border-0 shadow-ios-xl p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
          <DialogHeader className="p-6 pb-4 sticky top-0 bg-white z-10">
            <DialogTitle className="text-xl font-bold text-ios-gray-900">
              Revisión de Corte
            </DialogTitle>
            <DialogDescription className="text-ios-gray-500">
              {selectedRegister && format(new Date(selectedRegister.register_date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
            </DialogDescription>
          </DialogHeader>
          
          {selectedRegister && (
            <div className="px-6 pb-6 space-y-6">
              {/* Cajero */}
              <div className="p-4 rounded-2xl bg-ios-gray-50">
                <p className="text-sm text-ios-gray-500 mb-1">Cajero</p>
                <p className="font-semibold text-ios-gray-900">
                  {selectedRegister.profiles?.first_name} {selectedRegister.profiles?.last_name}
                </p>
              </div>

              {/* Declarado por Recepción */}
              <div className="p-4 rounded-2xl bg-ios-blue/5 border border-ios-blue/20">
                <div className="flex items-center gap-2 mb-3">
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
                    <p className="font-semibold text-ios-gray-900">Saldo Final Declarado</p>
                    <p className="text-2xl font-bold text-ios-blue">${selectedRegister.closing_balance.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Fuente de Datos */}
              {selectedRegister.status === 'pending' && (
                <div className="p-4 rounded-2xl bg-ios-orange/5 border border-ios-orange/20">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-ios-orange" />
                      <p className="font-semibold text-ios-orange">Fuente de Datos Esperados</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm font-medium", !useManualSource ? 'text-ios-gray-900' : 'text-ios-gray-400')}>
                        Sistema
                      </span>
                      <Switch
                        checked={useManualSource}
                        onCheckedChange={setUseManualSource}
                      />
                      <span className={cn("text-sm font-medium", useManualSource ? 'text-ios-gray-900' : 'text-ios-gray-400')}>
                        Manual
                      </span>
                    </div>
                  </div>

                  {useManualSource ? (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-ios-gray-600">
                        Monto Esperado (Sistema Legacy)
                      </Label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ios-gray-400 font-medium">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={manualExpected}
                          onChange={(e) => setManualExpected(e.target.value)}
                          placeholder="Ingresa el total del sistema antiguo"
                          className="ios-input pl-8"
                        />
                      </div>
                      <p className="text-xs text-ios-gray-400">
                        Ingresa el total que debería haber según tu sistema anterior
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-ios-gray-500 mb-2">Total calculado del sistema</p>
                      <p className="text-3xl font-bold text-ios-gray-900">${systemExpected.toFixed(2)}</p>
                      <p className="text-xs text-ios-gray-400 mt-2">
                        Basado en pagos registrados en el sistema
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Resultado de Auditoría */}
              {selectedRegister.status === 'pending' && (useManualSource ? manualExpected : true) && (
                <div className={cn(
                  "p-4 rounded-2xl border",
                  difference === 0 ? 'bg-ios-green/5 border-ios-green/20' :
                  difference < 0 ? 'bg-ios-red/5 border-ios-red/20' : 'bg-ios-blue/5 border-ios-blue/20'
                )}>
                  <p className="text-sm font-medium text-ios-gray-600 mb-2">Resultado de Auditoría</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-ios-gray-500">
                        Esperado: ${(useManualSource ? parseFloat(manualExpected) || 0 : systemExpected).toFixed(2)}
                      </p>
                      <p className="text-sm text-ios-gray-500">
                        Declarado: ${selectedRegister.closing_balance.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        "text-3xl font-bold",
                        difference === 0 ? 'text-ios-green' :
                        difference < 0 ? 'text-ios-red' : 'text-ios-blue'
                      )}>
                        {difference === 0 ? 'CUADRA' :
                         difference < 0 ? `-$${Math.abs(difference).toFixed(2)}` : `+$${difference.toFixed(2)}`}
                      </p>
                      <p className="text-sm text-ios-gray-500">
                        {difference === 0 ? 'Sin diferencia' :
                         difference < 0 ? 'FALTANTE' : 'SOBRANTE'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Notas de Auditoría */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Notas de Auditoría</Label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                  placeholder="Agrega observaciones sobre este corte..."
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
                  "p-4 rounded-2xl text-center",
                  selectedRegister.status === 'approved' ? 'bg-ios-green/10' : 'bg-ios-red/10'
                )}>
                  <p className={cn(
                    "font-semibold",
                    selectedRegister.status === 'approved' ? 'text-ios-green' : 'text-ios-red'
                  )}>
                    {selectedRegister.status === 'approved' ? 'Corte Aprobado' : 'Corte Rechazado'}
                  </p>
                  {selectedRegister.difference !== 0 && (
                    <p className="text-sm text-ios-gray-600 mt-1">
                      Diferencia registrada: {selectedRegister.difference < 0 ? '-' : '+'}${Math.abs(selectedRegister.difference).toFixed(2)}
                    </p>
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