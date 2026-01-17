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
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  /* 
    This is a comprehensive update to Finance.tsx.
    I am replacing the entire component to ensure clean state management and UI structure for Pending vs History.
  */

  const { user, isAdmin } = useAuth();
  const [pendingPayments, setPendingPayments] = useState<Payment[]>([]);
  const [historyPayments, setHistoryPayments] = useState<Payment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialog states
  const [isNewPaymentOpen, setIsNewPaymentOpen] = useState(false);
  const [isCollectOpen, setIsCollectOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Form states
  const [formData, setFormData] = useState({
    patient_id: '',
    amount: '',
    payment_method: 'cash',
    description: ''
  });

  const fetchData = useCallback(async () => {
    try {
      const [pendingResult, historyResult, patientsResult] = await Promise.all([
        supabase
          .from('payments')
          .select('*, patients(first_name, last_name)')
          .eq('status', 'pending')
          .order('created_at', { ascending: true }),
        supabase
          .from('payments')
          .select('*, patients(first_name, last_name)')
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('patients')
          .select('id, first_name, last_name')
          .order('first_name', { ascending: true })
      ]);

      if (pendingResult.error) throw pendingResult.error;
      if (historyResult.error) throw historyResult.error;
      if (patientsResult.error) throw patientsResult.error;

      setPendingPayments(pendingResult.data || []);
      setHistoryPayments(historyResult.data || []);
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

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.from('payments').insert({
        patient_id: formData.patient_id,
        amount: parseFloat(formData.amount),
        payment_method: formData.payment_method,
        description: formData.description,
        status: 'completed', // Direct payments are completed
        created_at: new Date().toISOString(),
        user_id: user?.id
      });

      if (error) throw error;
      toast.success('Pago registrado');
      setIsNewPaymentOpen(false);
      setFormData({ patient_id: '', amount: '', payment_method: 'cash', description: '' });
      fetchData();
    } catch (error) {
      toast.error('Error al registrar pago');
    } finally {
      setSaving(false);
    }
  };

  const handleCollectPayment = async () => {
    if (!selectedPayment) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('payments')
        .update({
          status: 'completed',
          payment_method: formData.payment_method,
          created_at: new Date().toISOString(), // Update timestamp to collection time
          user_id: user?.id
        })
        .eq('id', selectedPayment.id);

      if (error) throw error;
      toast.success('Cobro registrado exitosamente');
      setIsCollectOpen(false);
      setSelectedPayment(null);
      fetchData();
    } catch (error) {
      toast.error('Error al cobrar');
    } finally {
      setSaving(false);
    }
  };

  // Stats calculation
  const monthlyTotal = historyPayments
    .filter(p => {
      const date = new Date(p.created_at);
      const now = new Date();
      return date >= startOfMonth(now) && date <= endOfMonth(now);
    })
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const pendingTotal = pendingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);


  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'cash': return <Banknote className="h-4 w-4" />;
      case 'card': return <CreditCard className="h-4 w-4" />;
      case 'transfer': return <ArrowUpRight className="h-4 w-4" />;
      default: return <DollarSign className="h-4 w-4" />;
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
          onClick={() => setIsNewPaymentOpen(true)}
          className="flex items-center gap-2 h-11 px-5 rounded-xl bg-ios-green text-white font-semibold text-sm shadow-ios-sm hover:bg-ios-green/90 transition-all duration-200 touch-feedback"
        >
          <Plus className="h-5 w-5" />
          Nuevo Pago
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="ios-card p-5 animate-slide-up">
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
            <div className="h-11 w-11 rounded-2xl bg-ios-orange flex items-center justify-center">
              <Receipt className="h-5 w-5 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-ios-gray-900">
            ${pendingTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-ios-gray-500 font-medium mt-1">Por Cobrar</p>
        </div>
      </div>

      {/* Pending Collections Section */}
      {pendingPayments.length > 0 && (
        <div className="mb-8 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <h2 className="text-lg font-bold text-ios-gray-900 mb-4 px-1">Cuentas por Cobrar</h2>
          <div className="bg-white rounded-3xl border border-ios-red/20 shadow-sm overflow-hidden">
            <div className="divide-y divide-ios-gray-100">
              {pendingPayments.map((payment) => (
                <div key={payment.id} className="p-4 flex items-center justify-between hover:bg-ios-gray-50/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-ios-red/10 flex items-center justify-center text-ios-red">
                      <DollarSign className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-bold text-ios-gray-900 text-lg">
                        {payment.patients?.first_name} {payment.patients?.last_name}
                      </p>
                      <p className="text-ios-gray-500 text-sm">
                        {format(new Date(payment.created_at), "d MMM, HH:mm")} • Pendiente
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <p className="font-bold text-xl text-ios-gray-900">
                      ${payment.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </p>
                    <button
                      onClick={() => {
                        setSelectedPayment(payment);
                        setFormData(prev => ({ ...prev, payment_method: 'cash' }));
                        setIsCollectOpen(true);
                      }}
                      className="h-10 px-6 rounded-xl bg-ios-blue text-white font-semibold text-sm hover:bg-ios-blue/90 shadow-ios-blue/20 shadow-ios-sm transition-all"
                    >
                      Cobrar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* History Section */}
      <div className="ios-card overflow-hidden animate-slide-up" style={{ animationDelay: '200ms' }}>
        <div className="p-5 border-b border-ios-gray-100">
          <h2 className="text-lg font-bold text-ios-gray-900">Historial de Pagos</h2>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-ios-blue" /></div>
        ) : historyPayments.length === 0 ? (
          <div className="p-12 text-center text-ios-gray-400">Sin historial</div>
        ) : (
          <div className="divide-y divide-ios-gray-100">
            {historyPayments.map((payment) => (
              <div key={payment.id} className="p-4 flex items-center justify-between hover:bg-ios-gray-50/50">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center",
                    payment.payment_method === 'cash' ? 'bg-ios-teal/15 text-ios-teal' :
                      payment.payment_method === 'card' ? 'bg-ios-purple/15 text-ios-purple' :
                        'bg-ios-blue/15 text-ios-blue'
                  )}>
                    {getMethodIcon(payment.payment_method)}
                  </div>
                  <div>
                    <p className="font-semibold text-ios-gray-900">
                      {payment.patients?.first_name} {payment.patients?.last_name}
                    </p>
                    <p className="text-sm text-ios-gray-500">
                      {payment.description || 'Cobro de servicio'} • {format(new Date(payment.created_at), "d MMM, HH:mm")}
                    </p>
                  </div>
                </div>
                <p className="font-bold text-ios-green">
                  +${payment.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Payment Dialog */}
      <Dialog open={isNewPaymentOpen} onOpenChange={setIsNewPaymentOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo Pago Manual</DialogTitle></DialogHeader>
          <form onSubmit={handleCreatePayment} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Paciente</Label>
              <Select value={formData.patient_id} onValueChange={(val) => setFormData({ ...formData, patient_id: val })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {patients.map(p => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Monto</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <Input type="number" className="pl-7" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Método</Label>
              <Select value={formData.payment_method} onValueChange={(val) => setFormData({ ...formData, payment_method: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="card">Tarjeta</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Concepto</Label>
              <Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsNewPaymentOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>Registrar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Collect Dialog (For Pending Payments) */}
      <Dialog open={isCollectOpen} onOpenChange={setIsCollectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cobrar Cuenta</DialogTitle>
            <DialogDescription>
              Confirmar cobro de ${selectedPayment?.amount.toLocaleString('es-MX')} a {selectedPayment?.patients?.first_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Método de Pago</Label>
              <Select value={formData.payment_method} onValueChange={(val) => setFormData({ ...formData, payment_method: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="card">Tarjeta</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCollectOpen(false)}>Cancelar</Button>
            <Button onClick={handleCollectPayment} className="bg-ios-green text-white" disabled={saving}>
              {saving ? <Loader2 className="animate-spin h-4 w-4" /> : 'Confirmar Cobro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </MainLayout>
  );
};

export default Finance;