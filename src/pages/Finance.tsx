"use client";

import React, { useEffect, useState, useCallback } from 'react';
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
import { useAuth } from '@/contexts/AuthContext';
import { 
  Plus, DollarSign, TrendingUp, CreditCard, Banknote, 
  ArrowUpRight, Search, Loader2, Receipt
} from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Payment {
  id: string;
  patient_id: string;
  amount: number;
  payment_method: string;
  description: string;
  status: string;
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
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Individual form states
  const [patientId, setPatientId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [description, setDescription] = useState('');

  const fetchData = useCallback(async () => {
    try {
      // Fetch ALL payments and patients (shared data)
      const [paymentsResult, patientsResult] = await Promise.all([
        supabase
          .from('payments')
          .select('*, patients(first_name, last_name)')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('patients')
          .select('id, first_name, last_name')
          .order('first_name', { ascending: true })
      ]);

      if (paymentsResult.error) throw paymentsResult.error;
      if (patientsResult.error) throw patientsResult.error;

      setPayments(paymentsResult.data || []);
      setPatients(patientsResult.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = useCallback(() => {
    setPatientId('');
    setAmount('');
    setPaymentMethod('cash');
    setDescription('');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    if (!patientId) {
      toast.error('Selecciona un paciente');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Ingresa un monto válido');
      return;
    }

    setSaving(true);
    try {
      const newPayment = {
        user_id: user.id,
        patient_id: patientId,
        amount: parseFloat(amount),
        payment_method: paymentMethod,
        description: description.trim(),
        status: 'completed'
      };

      const { data, error } = await supabase
        .from('payments')
        .insert(newPayment)
        .select('*, patients(first_name, last_name)')
        .single();

      if (error) throw error;
      
      // Optimistic update
      setPayments(prev => [data, ...prev]);
      
      toast.success('Pago registrado');
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error creating payment:', error);
      toast.error('Error al registrar pago');
    } finally {
      setSaving(false);
    }
  };

  // Calculate stats
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const monthlyTotal = payments
    .filter(p => {
      const date = new Date(p.created_at);
      return date >= monthStart && date <= monthEnd && p.status === 'completed';
    })
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const weeklyTotal = payments
    .filter(p => {
      const date = new Date(p.created_at);
      return date >= weekStart && date <= weekEnd && p.status === 'completed';
    })
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const cashTotal = payments
    .filter(p => p.payment_method === 'cash' && p.status === 'completed')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const cardTotal = payments
    .filter(p => p.payment_method === 'card' && p.status === 'completed')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const filteredPayments = payments.filter(p => {
    if (!searchTerm) return true;
    const patientName = `${p.patients?.first_name || ''} ${p.patients?.last_name || ''}`.toLowerCase();
    return patientName.includes(searchTerm.toLowerCase()) || 
           p.description?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'cash': return <Banknote className="h-4 w-4" />;
      case 'card': return <CreditCard className="h-4 w-4" />;
      case 'transfer': return <ArrowUpRight className="h-4 w-4" />;
      default: return <DollarSign className="h-4 w-4" />;
    }
  };

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'cash': return 'Efectivo';
      case 'card': return 'Tarjeta';
      case 'transfer': return 'Transferencia';
      default: return method;
    }
  };

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">Finanzas</h1>
          <p className="text-ios-gray-500 mt-1 font-medium">Control de ingresos y pagos</p>
        </div>
        <button 
          onClick={() => setIsDialogOpen(true)}
          className="flex items-center gap-2 h-11 px-5 rounded-xl bg-ios-green text-white font-semibold text-sm shadow-ios-sm hover:bg-ios-green/90 transition-all duration-200 touch-feedback"
        >
          <Plus className="h-5 w-5" />
          Nuevo Pago
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
        <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '0ms' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="h-11 w-11 rounded-2xl bg-ios-green flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-ios-gray-900">
            ${monthlyTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
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
            ${weeklyTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-ios-gray-500 font-medium mt-1">Esta Semana</p>
        </div>
        
        <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="h-11 w-11 rounded-2xl bg-ios-teal flex items-center justify-center">
              <Banknote className="h-5 w-5 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-ios-gray-900">
            ${cashTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-ios-gray-500 font-medium mt-1">Total Efectivo</p>
        </div>
        
        <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '150ms' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="h-11 w-11 rounded-2xl bg-ios-purple flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-ios-gray-900">
            ${cardTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-ios-gray-500 font-medium mt-1">Total Tarjeta</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6 animate-fade-in" style={{ animationDelay: '200ms' }}>
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ios-gray-400" />
          <input
            type="text"
            placeholder="Buscar pago..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-12 pl-12 pr-4 rounded-2xl bg-white border-0 text-base placeholder:text-ios-gray-400 focus:ring-2 focus:ring-ios-green/30 focus:outline-none shadow-ios-sm transition-all duration-200"
          />
        </div>
      </div>

      {/* Payments List */}
      <div className="ios-card overflow-hidden animate-slide-up" style={{ animationDelay: '250ms' }}>
        <div className="p-5 border-b border-ios-gray-100">
          <h2 className="text-lg font-bold text-ios-gray-900">Historial de Pagos</h2>
          <p className="text-sm text-ios-gray-500 mt-1">Últimos 100 pagos registrados</p>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-ios-green" />
          </div>
        ) : filteredPayments.length > 0 ? (
          <div className="divide-y divide-ios-gray-100">
            {filteredPayments.map((payment, index) => (
              <div 
                key={payment.id}
                className="flex items-center gap-4 p-4 hover:bg-ios-gray-50 transition-all duration-200 ease-ios animate-fade-in"
                style={{ animationDelay: `${300 + index * 30}ms` }}
              >
                <div className={cn(
                  "h-12 w-12 rounded-2xl flex items-center justify-center",
                  payment.payment_method === 'cash' ? 'bg-ios-teal/15 text-ios-teal' :
                  payment.payment_method === 'card' ? 'bg-ios-purple/15 text-ios-purple' :
                  'bg-ios-blue/15 text-ios-blue'
                )}>
                  {getMethodIcon(payment.payment_method)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ios-gray-900">
                    {payment.patients?.first_name} {payment.patients?.last_name}
                  </p>
                  <p className="text-sm text-ios-gray-500 truncate">
                    {payment.description || getMethodLabel(payment.payment_method)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-bold text-ios-green text-lg">
                    ${payment.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-ios-gray-400">
                    {format(new Date(payment.created_at), "dd/MM/yyyy HH:mm")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="h-20 w-20 rounded-full bg-ios-gray-100 flex items-center justify-center mx-auto mb-4">
              <Receipt className="h-10 w-10 text-ios-gray-400" />
            </div>
            <p className="text-ios-gray-900 font-semibold">Sin pagos</p>
            <p className="text-ios-gray-500 text-sm mt-1">No hay pagos registrados</p>
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
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl border-0 shadow-ios-xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="text-xl font-bold text-ios-gray-900">Nuevo Pago</DialogTitle>
            <DialogDescription className="text-ios-gray-500">
              Registra un cobro
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit}>
            <div className="px-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Paciente *</Label>
                <Select value={patientId} onValueChange={setPatientId}>
                  <SelectTrigger className="ios-input">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-[200px]">
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
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ios-gray-400 font-bold text-lg">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    className="ios-input pl-10 text-lg font-semibold"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Método de Pago</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
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
                <Label className="text-sm font-medium text-ios-gray-600">Concepto</Label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej: Limpieza dental"
                  className="ios-input"
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
                disabled={saving}
                className="flex-1 h-12 rounded-xl bg-ios-green text-white font-semibold hover:bg-ios-green/90 transition-colors touch-feedback disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Registrar'
                )}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Finance;