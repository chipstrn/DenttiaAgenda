"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Label } from '@/components/ui/label';
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
import { Plus, DollarSign, TrendingUp, CreditCard, Banknote, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';

interface Payment {
  id: string;
  patient_id: string;
  amount: number;
  payment_method: string;
  status: string;
  notes: string;
  created_at: string;
  patients?: {
    first_name: string;
    last_name: string;
  };
}

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
}

const Finance = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [stats, setStats] = useState({
    totalMonth: 0,
    totalToday: 0,
    countMonth: 0
  });
  const [formData, setFormData] = useState({
    patient_id: '',
    amount: '',
    payment_method: 'cash',
    notes: ''
  });

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*, patients(first_name, last_name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (paymentsError) throw paymentsError;
      setPayments(paymentsData || []);

      const now = new Date();
      const monthStart = startOfMonth(now).toISOString();
      const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      const todayEnd = new Date(now.setHours(23, 59, 59, 999)).toISOString();

      const monthPayments = (paymentsData || []).filter(p => 
        p.created_at >= monthStart && p.status === 'completed'
      );
      const todayPayments = (paymentsData || []).filter(p => 
        p.created_at >= todayStart && p.created_at <= todayEnd && p.status === 'completed'
      );

      setStats({
        totalMonth: monthPayments.reduce((sum, p) => sum + (p.amount || 0), 0),
        totalToday: todayPayments.reduce((sum, p) => sum + (p.amount || 0), 0),
        countMonth: monthPayments.length
      });

      const { data: patientsData } = await supabase
        .from('patients')
        .select('id, first_name, last_name')
        .eq('user_id', user.id)
        .order('first_name', { ascending: true });

      setPatients(patientsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('payments')
        .insert({
          user_id: user.id,
          patient_id: formData.patient_id || null,
          amount: parseFloat(formData.amount),
          payment_method: formData.payment_method,
          notes: formData.notes,
          status: 'completed'
        });

      if (error) throw error;
      toast.success('Pago registrado');
      setIsDialogOpen(false);
      setFormData({
        patient_id: '',
        amount: '',
        payment_method: 'cash',
        notes: ''
      });
      fetchData();
    } catch (error) {
      console.error('Error creating payment:', error);
      toast.error('Error al registrar pago');
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'card': return <CreditCard className="h-4 w-4" />;
      case 'transfer': return <ArrowUpRight className="h-4 w-4" />;
      default: return <Banknote className="h-4 w-4" />;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'card': return 'Tarjeta';
      case 'transfer': return 'Transferencia';
      default: return 'Efectivo';
    }
  };

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">Finanzas</h1>
          <p className="text-ios-gray-500 mt-1 font-medium">Gestión de pagos</p>
        </div>
        <button 
          onClick={() => setIsDialogOpen(true)}
          className="flex items-center gap-2 h-11 px-5 rounded-xl bg-ios-green text-white font-semibold text-sm shadow-ios-sm hover:bg-ios-green/90 transition-all duration-200 touch-feedback"
        >
          <Plus className="h-5 w-5" />
          Registrar Pago
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '0ms' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="h-11 w-11 rounded-2xl bg-ios-green flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-ios-gray-900">
            ${stats.totalMonth.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-ios-gray-500 font-medium mt-1">Ingresos del Mes</p>
        </div>
        
        <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '50ms' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="h-11 w-11 rounded-2xl bg-ios-blue flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-ios-gray-900">
            ${stats.totalToday.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-ios-gray-500 font-medium mt-1">Ingresos de Hoy</p>
        </div>
        
        <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="h-11 w-11 rounded-2xl bg-ios-purple flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-ios-gray-900">{stats.countMonth}</p>
          <p className="text-sm text-ios-gray-500 font-medium mt-1">Transacciones del Mes</p>
        </div>
      </div>

      {/* Payments List */}
      <div className="ios-card overflow-hidden animate-slide-up" style={{ animationDelay: '150ms' }}>
        <div className="p-5 border-b border-ios-gray-100">
          <h2 className="text-lg font-bold text-ios-gray-900">Historial de Pagos</h2>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 border-3 border-ios-green/30 border-t-ios-green rounded-full animate-spin"></div>
          </div>
        ) : payments.length > 0 ? (
          <div className="divide-y divide-ios-gray-100">
            {payments.map((payment, index) => (
              <div 
                key={payment.id}
                className="flex items-center gap-4 p-4 hover:bg-ios-gray-50 transition-all duration-200 ease-ios animate-fade-in"
                style={{ animationDelay: `${200 + index * 30}ms` }}
              >
                <div className={cn(
                  "h-11 w-11 rounded-2xl flex items-center justify-center",
                  payment.payment_method === 'card' ? 'bg-ios-purple/15' :
                  payment.payment_method === 'transfer' ? 'bg-ios-blue/15' : 'bg-ios-green/15'
                )}>
                  {getPaymentMethodIcon(payment.payment_method)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ios-gray-900">
                    {payment.patients 
                      ? `${payment.patients.first_name} ${payment.patients.last_name}`
                      : 'Sin paciente'
                    }
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm text-ios-gray-500">
                      {format(new Date(payment.created_at), "dd/MM/yyyy HH:mm")}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-ios-gray-100 text-ios-gray-600 font-medium">
                      {getPaymentMethodLabel(payment.payment_method)}
                    </span>
                  </div>
                </div>

                <p className="text-lg font-bold text-ios-green">
                  ${payment.amount.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="h-20 w-20 rounded-full bg-ios-gray-100 flex items-center justify-center mx-auto mb-4">
              <DollarSign className="h-10 w-10 text-ios-gray-400" />
            </div>
            <p className="text-ios-gray-900 font-semibold">Sin pagos</p>
            <p className="text-ios-gray-500 text-sm mt-1">Registra tu primer pago</p>
            <button 
              onClick={() => setIsDialogOpen(true)}
              className="mt-4 text-ios-green font-semibold text-sm hover:opacity-70 transition-opacity"
            >
              Registrar pago
            </button>
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl border-0 shadow-ios-xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="text-xl font-bold text-ios-gray-900">Registrar Pago</DialogTitle>
            <DialogDescription className="text-ios-gray-500">
              Ingresa los datos del pago
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit}>
            <div className="px-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Paciente (opcional)</Label>
                <Select
                  value={formData.patient_id}
                  onValueChange={(value) => setFormData({ ...formData, patient_id: value })}
                >
                  <SelectTrigger className="ios-input">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {patients.map((patient) => (
                      <SelectItem key={patient.id} value={patient.id}>
                        {patient.first_name} {patient.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Monto *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ios-gray-400" />
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0.00"
                    required
                    className="ios-input pl-12"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Método de Pago</Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                >
                  <SelectTrigger className="ios-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="cash">Efectivo</SelectItem>
                    <SelectItem value="card">Tarjeta</SelectItem>
                    <SelectItem value="transfer">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Notas</Label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  placeholder="Concepto del pago..."
                  className="ios-input resize-none"
                />
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
                className="flex-1 h-12 rounded-xl bg-ios-green text-white font-semibold hover:bg-ios-green/90 transition-colors touch-feedback"
              >
                Registrar
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Finance;