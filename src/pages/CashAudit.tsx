"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  Eye,
  Check,
  X,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface CashRegister {
  id: string;
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
  expenses_notes: string;
  other_income: number;
  cash_withdrawals: number;
  withdrawals_notes: string;
  system_services_cash: number;
  system_services_card: number;
  system_services_transfer: number;
  system_total: number;
  difference: number;
  status: string;
  admin_notes: string;
  created_at: string;
}

const CashAudit = () => {
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegister, setSelectedRegister] = useState<CashRegister | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    pending: 0,
    discrepancies: 0,
    approved: 0,
    totalDifference: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('cash_registers')
        .select('*')
        .eq('user_id', user.id)
        .order('register_date', { ascending: false });

      if (error) throw error;
      setRegisters(data || []);

      // Calculate stats
      const pending = data?.filter(r => r.status === 'pending').length || 0;
      const discrepancies = data?.filter(r => r.status === 'discrepancy').length || 0;
      const approved = data?.filter(r => r.status === 'approved').length || 0;
      const totalDiff = data?.reduce((sum, r) => sum + Math.abs(r.difference || 0), 0) || 0;

      setStats({ pending, discrepancies, approved, totalDifference: totalDiff });
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const openDetail = (register: CashRegister) => {
    setSelectedRegister(register);
    setAdminNotes(register.admin_notes || '');
    setShowDetailDialog(true);
  };

  const updateStatus = async (status: 'approved' | 'reviewed') => {
    if (!selectedRegister) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('cash_registers')
        .update({
          status,
          admin_notes: adminNotes,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id
        })
        .eq('id', selectedRegister.id);

      if (error) throw error;

      toast.success(status === 'approved' ? 'Corte aprobado' : 'Corte revisado');
      setShowDetailDialog(false);
      fetchData();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-ios-green/15 text-ios-green flex items-center gap-1.5">
            <CheckCircle className="h-3.5 w-3.5" /> Aprobado
          </span>
        );
      case 'discrepancy':
        return (
          <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-ios-red/15 text-ios-red flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Discrepancia
          </span>
        );
      case 'reviewed':
        return (
          <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-ios-blue/15 text-ios-blue flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" /> Revisado
          </span>
        );
      default:
        return (
          <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-ios-orange/15 text-ios-orange flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Pendiente
          </span>
        );
    }
  };

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
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">Auditoría de Caja</h1>
        <p className="text-ios-gray-500 mt-1 font-medium">Revisión y aprobación de cortes de caja</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
        <div className="ios-card p-5 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <div className="h-10 w-10 rounded-xl bg-ios-orange/15 flex items-center justify-center">
              <Clock className="h-5 w-5 text-ios-orange" />
            </div>
          </div>
          <p className="text-2xl font-bold text-ios-gray-900">{stats.pending}</p>
          <p className="text-sm text-ios-gray-500">Pendientes</p>
        </div>

        <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '50ms' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="h-10 w-10 rounded-xl bg-ios-red/15 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-ios-red" />
            </div>
          </div>
          <p className="text-2xl font-bold text-ios-gray-900">{stats.discrepancies}</p>
          <p className="text-sm text-ios-gray-500">Con Discrepancias</p>
        </div>

        <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="h-10 w-10 rounded-xl bg-ios-green/15 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-ios-green" />
            </div>
          </div>
          <p className="text-2xl font-bold text-ios-gray-900">{stats.approved}</p>
          <p className="text-sm text-ios-gray-500">Aprobados</p>
        </div>

        <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '150ms' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="h-10 w-10 rounded-xl bg-ios-purple/15 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-ios-purple" />
            </div>
          </div>
          <p className="text-2xl font-bold text-ios-gray-900">${stats.totalDifference.toFixed(2)}</p>
          <p className="text-sm text-ios-gray-500">Diferencia Total</p>
        </div>
      </div>

      {/* Registers List */}
      <div className="ios-card overflow-hidden animate-slide-up" style={{ animationDelay: '200ms' }}>
        <div className="p-5 border-b border-ios-gray-100">
          <h2 className="font-bold text-ios-gray-900">Historial de Cortes</h2>
        </div>

        {registers.length > 0 ? (
          <div className="divide-y divide-ios-gray-100">
            {registers.map((register, index) => {
              const totalReported = register.services_cash + register.services_card + register.services_transfer +
                                   register.products_cash + register.products_card + register.products_transfer +
                                   register.other_income;
              
              return (
                <div
                  key={register.id}
                  className="flex items-center gap-4 p-4 hover:bg-ios-gray-50 transition-all duration-200 cursor-pointer animate-fade-in"
                  style={{ animationDelay: `${250 + index * 30}ms` }}
                  onClick={() => openDetail(register)}
                >
                  <div className="h-12 w-12 rounded-2xl bg-ios-blue/10 flex items-center justify-center flex-shrink-0">
                    <Calendar className="h-6 w-6 text-ios-blue" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ios-gray-900">
                      {format(new Date(register.register_date), "EEEE, d 'de' MMMM", { locale: es })}
                    </p>
                    <div className="flex items-center gap-4 mt-1 text-sm text-ios-gray-500">
                      <span>Reportado: ${totalReported.toFixed(2)}</span>
                      <span>Sistema: ${register.system_total.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "text-right",
                      register.difference === 0 ? "text-ios-green" :
                      Math.abs(register.difference) > 50 ? "text-ios-red" : "text-ios-orange"
                    )}>
                      <div className="flex items-center gap-1 justify-end">
                        {register.difference > 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : register.difference < 0 ? (
                          <TrendingDown className="h-4 w-4" />
                        ) : null}
                        <span className="font-bold">
                          {register.difference >= 0 ? '+' : ''}${register.difference.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-xs">Diferencia</p>
                    </div>

                    {getStatusBadge(register.status)}

                    <button className="h-10 w-10 rounded-xl bg-ios-gray-100 flex items-center justify-center hover:bg-ios-gray-200 transition-colors">
                      <Eye className="h-5 w-5 text-ios-gray-600" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="h-20 w-20 rounded-full bg-ios-gray-100 flex items-center justify-center mx-auto mb-4">
              <FileText className="h-10 w-10 text-ios-gray-400" />
            </div>
            <p className="text-ios-gray-900 font-semibold">Sin cortes de caja</p>
            <p className="text-ios-gray-500 text-sm mt-1">Los cortes aparecerán aquí cuando se registren</p>
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl rounded-3xl border-0 shadow-ios-xl p-0 overflow-hidden max-h-[90vh]">
          <DialogHeader className="p-6 pb-4 border-b border-ios-gray-100">
            <DialogTitle className="text-xl font-bold text-ios-gray-900 flex items-center justify-between">
              <span>Detalle del Corte</span>
              {selectedRegister && getStatusBadge(selectedRegister.status)}
            </DialogTitle>
            {selectedRegister && (
              <p className="text-ios-gray-500 text-sm">
                {format(new Date(selectedRegister.register_date), "EEEE, d 'de' MMMM yyyy", { locale: es })}
              </p>
            )}
          </DialogHeader>

          {selectedRegister && (
            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
              {/* Comparison Table */}
              <div className="overflow-hidden rounded-2xl border border-ios-gray-200">
                <table className="w-full">
                  <thead className="bg-ios-gray-50">
                    <tr>
                      <th className="text-left p-3 text-sm font-semibold text-ios-gray-600">Concepto</th>
                      <th className="text-right p-3 text-sm font-semibold text-ios-gray-600">Reportado</th>
                      <th className="text-right p-3 text-sm font-semibold text-ios-gray-600">Sistema</th>
                      <th className="text-right p-3 text-sm font-semibold text-ios-gray-600">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ios-gray-100">
                    <tr>
                      <td className="p-3 text-sm">Servicios (Efectivo)</td>
                      <td className="p-3 text-sm text-right">${selectedRegister.services_cash.toFixed(2)}</td>
                      <td className="p-3 text-sm text-right">${selectedRegister.system_services_cash.toFixed(2)}</td>
                      <td className={cn(
                        "p-3 text-sm text-right font-medium",
                        selectedRegister.services_cash - selectedRegister.system_services_cash === 0 ? "text-ios-green" : "text-ios-red"
                      )}>
                        ${(selectedRegister.services_cash - selectedRegister.system_services_cash).toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 text-sm">Servicios (Tarjeta)</td>
                      <td className="p-3 text-sm text-right">${selectedRegister.services_card.toFixed(2)}</td>
                      <td className="p-3 text-sm text-right">${selectedRegister.system_services_card.toFixed(2)}</td>
                      <td className={cn(
                        "p-3 text-sm text-right font-medium",
                        selectedRegister.services_card - selectedRegister.system_services_card === 0 ? "text-ios-green" : "text-ios-red"
                      )}>
                        ${(selectedRegister.services_card - selectedRegister.system_services_card).toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 text-sm">Servicios (Transferencia)</td>
                      <td className="p-3 text-sm text-right">${selectedRegister.services_transfer.toFixed(2)}</td>
                      <td className="p-3 text-sm text-right">${selectedRegister.system_services_transfer.toFixed(2)}</td>
                      <td className={cn(
                        "p-3 text-sm text-right font-medium",
                        selectedRegister.services_transfer - selectedRegister.system_services_transfer === 0 ? "text-ios-green" : "text-ios-red"
                      )}>
                        ${(selectedRegister.services_transfer - selectedRegister.system_services_transfer).toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 text-sm">Productos (Total)</td>
                      <td className="p-3 text-sm text-right">
                        ${(selectedRegister.products_cash + selectedRegister.products_card + selectedRegister.products_transfer).toFixed(2)}
                      </td>
                      <td className="p-3 text-sm text-right text-ios-gray-400">N/A</td>
                      <td className="p-3 text-sm text-right text-ios-gray-400">-</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-sm">Otros Ingresos</td>
                      <td className="p-3 text-sm text-right">${selectedRegister.other_income.toFixed(2)}</td>
                      <td className="p-3 text-sm text-right text-ios-gray-400">N/A</td>
                      <td className="p-3 text-sm text-right text-ios-gray-400">-</td>
                    </tr>
                    <tr className="bg-ios-gray-50">
                      <td className="p-3 font-semibold">TOTAL</td>
                      <td className="p-3 text-right font-bold">
                        ${(selectedRegister.services_cash + selectedRegister.services_card + selectedRegister.services_transfer +
                           selectedRegister.products_cash + selectedRegister.products_card + selectedRegister.products_transfer +
                           selectedRegister.other_income).toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-bold">${selectedRegister.system_total.toFixed(2)}</td>
                      <td className={cn(
                        "p-3 text-right font-bold",
                        selectedRegister.difference === 0 ? "text-ios-green" :
                        Math.abs(selectedRegister.difference) > 50 ? "text-ios-red" : "text-ios-orange"
                      )}>
                        {selectedRegister.difference >= 0 ? '+' : ''}${selectedRegister.difference.toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Cash Flow */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-ios-gray-50 rounded-2xl">
                  <p className="text-sm text-ios-gray-500 mb-1">Saldo Inicial</p>
                  <p className="text-xl font-bold text-ios-gray-900">${selectedRegister.opening_balance.toFixed(2)}</p>
                </div>
                <div className="p-4 bg-ios-gray-50 rounded-2xl">
                  <p className="text-sm text-ios-gray-500 mb-1">Saldo Final</p>
                  <p className="text-xl font-bold text-ios-gray-900">${selectedRegister.closing_balance.toFixed(2)}</p>
                </div>
              </div>

              {/* Expenses & Withdrawals */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-ios-red/5 rounded-2xl border border-ios-red/20">
                  <p className="text-sm text-ios-red font-medium mb-1">Gastos del Día</p>
                  <p className="text-xl font-bold text-ios-red">-${selectedRegister.expenses.toFixed(2)}</p>
                  {selectedRegister.expenses_notes && (
                    <p className="text-xs text-ios-gray-500 mt-2">{selectedRegister.expenses_notes}</p>
                  )}
                </div>
                <div className="p-4 bg-ios-orange/5 rounded-2xl border border-ios-orange/20">
                  <p className="text-sm text-ios-orange font-medium mb-1">Salidas de Efectivo</p>
                  <p className="text-xl font-bold text-ios-orange">-${selectedRegister.cash_withdrawals.toFixed(2)}</p>
                  {selectedRegister.withdrawals_notes && (
                    <p className="text-xs text-ios-gray-500 mt-2">{selectedRegister.withdrawals_notes}</p>
                  )}
                </div>
              </div>

              {/* Admin Notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-ios-gray-600">Notas del Administrador</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="ios-input resize-none"
                  rows={3}
                  placeholder="Agregar observaciones..."
                />
              </div>
            </div>
          )}

          <div className="p-6 pt-4 border-t border-ios-gray-100 flex gap-3">
            <button
              onClick={() => setShowDetailDialog(false)}
              className="flex-1 h-12 rounded-xl bg-ios-gray-100 text-ios-gray-900 font-semibold hover:bg-ios-gray-200 transition-colors touch-feedback"
            >
              Cerrar
            </button>
            {selectedRegister?.status !== 'approved' && (
              <>
                <button
                  onClick={() => updateStatus('reviewed')}
                  disabled={saving}
                  className="flex-1 h-12 rounded-xl bg-ios-orange text-white font-semibold flex items-center justify-center gap-2 hover:bg-ios-orange/90 transition-colors touch-feedback disabled:opacity-50"
                >
                  <Eye className="h-5 w-5" />
                  Marcar Revisado
                </button>
                <button
                  onClick={() => updateStatus('approved')}
                  disabled={saving}
                  className="flex-1 h-12 rounded-xl bg-ios-green text-white font-semibold flex items-center justify-center gap-2 hover:bg-ios-green/90 transition-colors touch-feedback disabled:opacity-50"
                >
                  <Check className="h-5 w-5" />
                  Aprobar
                </button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default CashAudit;