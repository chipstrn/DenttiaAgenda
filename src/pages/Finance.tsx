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
  ArrowUpRight, Search, Loader2, Receipt, Wallet, Coins
} from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface Payment {
  id: string;
  patient_id: string;
  amount: number;
  amount_paid: number;
  payment_method: string;
  description: string;
  status: string;
  created_at: string;
  patients?: {
    id: string;
    first_name: string;
    last_name: string;
    wallet_balance: number;
  };
}

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  wallet_balance: number;
}

const Finance = () => {
  const { user } = useAuth();
  const [pendingPayments, setPendingPayments] = useState<Payment[]>([]);
  const [historyPayments, setHistoryPayments] = useState<Payment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialog states
  const [isNewPaymentOpen, setIsNewPaymentOpen] = useState(false);
  const [isCollectOpen, setIsCollectOpen] = useState(false);
  const [isAddFundsOpen, setIsAddFundsOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  // Form states
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [formData, setFormData] = useState({
    patient_id: '',
    amount: '',
    description: '',
    payment_method: 'cash'
  });

  const fetchData = useCallback(async () => {
    try {
      const [pendingResult, historyResult, patientsResult] = await Promise.all([
        supabase
          .from('payments')
          .select('*, patients(id, first_name, last_name, wallet_balance)')
          .in('status', ['pending', 'partial'])
          .order('created_at', { ascending: true }),
        supabase
          .from('payment_transactions') // Fetch actual transactions for history
          .select('*, payments(patients(first_name, last_name))')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('patients')
          .select('id, first_name, last_name, wallet_balance')
          .order('first_name', { ascending: true })
      ]);

      if (pendingResult.error) throw pendingResult.error;
      if (historyResult.error) throw historyResult.error;
      if (patientsResult.error) throw patientsResult.error;

      setPendingPayments(pendingResult.data || []);
      // Map transactions to a similar structure for display
      setHistoryPayments(historyResult.data.map((t: any) => ({
        ...t,
        patients: t.payments?.patients,
        payment_method: t.method
      })) || []);
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

  // Handler: Add funds to Wallet
  const handleAddFunds = async () => {
    if (!formData.patient_id || !formData.amount) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('wallet_transactions').insert({
        patient_id: formData.patient_id,
        amount: parseFloat(formData.amount), // Positive for deposit
        description: formData.description || 'Recarga de Saldo',
        created_at: new Date().toISOString(),
        created_by: user?.id
      });

      if (error) throw error;
      toast.success('Saldo agregado exitosamente');
      setIsAddFundsOpen(false);
      setFormData({ patient_id: '', amount: '', description: '', payment_method: 'cash' });
      fetchData();
    } catch (error) {
      toast.error('Error al agregar saldo');
    } finally {
      setSaving(false);
    }
  };

  // Handler: Collect Payment (Partial or Full)
  const handleCollectPayment = async () => {
    if (!selectedPayment) return;
    setSaving(true);

    const payAmount = parseFloat(paymentAmount);

    // Validation
    if (isNaN(payAmount) || payAmount <= 0) {
      toast.error('Monto inválido');
      setSaving(false);
      return;
    }

    const remainingBalance = selectedPayment.amount - (selectedPayment.amount_paid || 0);
    if (payAmount > remainingBalance) {
      toast.error(`El monto excede el saldo pendiente ($${remainingBalance})`);
      setSaving(false);
      return;
    }

    try {
      // 1. Create Transaction (This triggers DB updates for payment status & wallet deduction)
      const { error } = await supabase.from('payment_transactions').insert({
        payment_id: selectedPayment.id,
        amount: payAmount,
        method: paymentMethod,
        created_at: new Date().toISOString(),
        // created_by handled by RLS/Auth or default
      });

      if (error) throw error;

      toast.success(`Pago de $${payAmount} registrado`);
      setIsCollectOpen(false);
      setSelectedPayment(null);
      setPaymentAmount('');
      fetchData();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Error al procesar pago');
    } finally {
      setSaving(false);
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'cash': return <Banknote className="h-4 w-4" />;
      case 'card': return <CreditCard className="h-4 w-4" />;
      case 'transfer': return <ArrowUpRight className="h-4 w-4" />;
      case 'wallet': return <Wallet className="h-4 w-4" />;
      default: return <DollarSign className="h-4 w-4" />;
    }
  };

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'cash': return 'Efectivo';
      case 'card': return 'Tarjeta';
      case 'transfer': return 'Transferencia';
      case 'wallet': return 'Saldo a Favor';
      default: return 'Otro';
    }
  };

  // Calculate totals
  const monthlyIncome = historyPayments
    .filter(p => {
      const date = new Date(p.created_at);
      const now = new Date();
      return date >= startOfMonth(now) && date <= endOfMonth(now);
    })
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const totalPending = pendingPayments.reduce((sum, p) => sum + (p.amount - (p.amount_paid || 0)), 0);

  return (
    <MainLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">Finanzas</h1>
          <p className="text-ios-gray-500 mt-1 font-medium">Control de ingresos, cobros y saldos</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsAddFundsOpen(true)}
            className="flex items-center gap-2 h-11 px-5 rounded-xl bg-orange-500 text-white font-semibold text-sm shadow-ios-sm hover:bg-orange-600 transition-all duration-200 touch-feedback"
          >
            <Coins className="h-5 w-5" />
            Recargar Saldo
          </button>

          {/* Note: Direct payment button removed to encourage flow via Agenda/Treatments => Debt => Payment. 
              Only "Add Funds" is manual now. */}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="ios-card p-5 animate-slide-up">
          <div className="flex items-start justify-between mb-4">
            <div className="h-11 w-11 rounded-2xl bg-ios-green flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-ios-gray-900">
            ${monthlyIncome.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-ios-gray-500 font-medium mt-1">Ingresos del Mes</p>
        </div>

        <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '50ms' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="h-11 w-11 rounded-2xl bg-ios-blue flex items-center justify-center">
              <Receipt className="h-5 w-5 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-ios-gray-900">
            ${totalPending.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-ios-gray-500 font-medium mt-1">Por Cobrar</p>
        </div>
      </div>

      {/* Pending Payments List */}
      <h2 className="text-lg font-bold text-ios-gray-900 mb-4 px-1">Cuentas por Cobrar</h2>

      {pendingPayments.length === 0 ? (
        <div className="mb-8 p-8 ios-card text-center text-gray-400">Excelente, no hay pagos pendientes taking.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 mb-8 animate-slide-up">
          {pendingPayments.map((payment) => {
            const paid = payment.amount_paid || 0;
            const total = payment.amount;
            const balance = total - paid;
            const percent = Math.min((paid / total) * 100, 100);

            return (
              <div key={payment.id} className="ios-card p-4 flex flex-col md:flex-row items-center justify-between gap-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="h-12 w-12 rounded-2xl bg-ios-red/10 flex items-center justify-center text-ios-red shrink-0">
                    <DollarSign className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-ios-gray-900 text-lg">
                      {payment.patients?.first_name} {payment.patients?.last_name}
                    </p>
                    <p className="text-ios-gray-500 text-sm">
                      {payment.description}
                    </p>
                    <p className="text-xs text-ios-gray-400 mt-1">
                      {format(new Date(payment.created_at), "d MMM yyyy")}
                    </p>
                  </div>
                </div>

                <div className="w-full md:w-1/3 px-4">
                  <div className="flex justify-between text-xs mb-1 font-medium">
                    <span className="text-green-600">Pagado: ${paid}</span>
                    <span className="text-red-500">Saldo: ${balance}</span>
                  </div>
                  <Progress value={percent} className="h-2 w-full" />
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-bold text-xl text-ios-gray-900">
                      ${balance.toLocaleString('es-MX')}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedPayment(payment);
                      setPaymentAmount(balance.toString()); // Default to full remaining
                      setPaymentMethod('cash');
                      setIsCollectOpen(true);
                    }}
                    className="h-10 px-6 rounded-xl bg-ios-blue text-white font-semibold text-sm hover:bg-ios-blue/90 shadow-ios-blue/20 shadow-ios-sm transition-all whitespace-nowrap"
                  >
                    Cobrar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* History List */}
      <div className="ios-card overflow-hidden animate-slide-up">
        <div className="p-5 border-b border-ios-gray-100">
          <h2 className="text-lg font-bold text-ios-gray-900">Ultimos Movimientos</h2>
        </div>
        <div className="divide-y divide-ios-gray-100 max-h-[400px] overflow-y-auto">
          {historyPayments.map((tx) => (
            <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center",
                  tx.payment_method === 'wallet' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'
                )}>
                  {getMethodIcon(tx.payment_method)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {tx.patients?.first_name} {tx.patients?.last_name}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {getMethodLabel(tx.payment_method)} • {format(new Date(tx.created_at), "d MMM HH:mm")}
                  </p>
                </div>
              </div>
              <p className="font-bold text-gray-900">
                +${tx.amount.toLocaleString('es-MX')}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL: COLLECT PAYMENT */}
      <Dialog open={isCollectOpen} onOpenChange={setIsCollectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Cobro</DialogTitle>
            <DialogDescription>
              Deuda Total: <span className="font-bold text-black">${selectedPayment?.amount}</span> <br />
              Pendiente: <span className="font-bold text-red-500">${selectedPayment ? selectedPayment.amount - (selectedPayment.amount_paid || 0) : 0}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Patient Wallet Info */}
            {selectedPayment?.patients?.wallet_balance ? (
              <div className="bg-orange-50 p-3 rounded-lg flex justify-between items-center border border-orange-100">
                <div className="flex items-center gap-2 text-orange-700">
                  <Wallet className="h-4 w-4" />
                  <span className="text-sm font-medium">Saldo a favor disponible</span>
                </div>
                <span className="font-bold text-orange-800">${selectedPayment.patients.wallet_balance}</span>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Monto a Pagar</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <Input
                  type="number"
                  className="pl-7 font-bold text-lg"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Método de Pago</Label>
              <Select value={paymentMethod} onValueChange={(val) => setPaymentMethod(val)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="card">Tarjeta</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                  <SelectItem value="wallet" disabled={!selectedPayment?.patients?.wallet_balance || selectedPayment.patients.wallet_balance <= 0}>
                    Usar Saldo a Favor
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCollectOpen(false)}>Cancelar</Button>
            <Button onClick={handleCollectPayment} className="bg-ios-green hover:bg-green-600 text-white" disabled={saving}>
              {saving ? <Loader2 className="animate-spin h-4 w-4" /> : 'Confirmar Cobro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: ADD FUNDS */}
      <Dialog open={isAddFundsOpen} onOpenChange={setIsAddFundsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recargar Saldo (Anticipo)</DialogTitle>
            <DialogDescription>Agregar fondos a la billetera de un paciente.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Paciente</Label>
              <Select value={formData.patient_id} onValueChange={(val) => setFormData({ ...formData, patient_id: val })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar Paciente" /></SelectTrigger>
                <SelectContent>
                  {patients.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Monto a Recargar</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <Input
                  type="number"
                  className="pl-7"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={e => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Concepto</Label>
              <Input
                placeholder="Ej. Anticipo Tratamiento"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAddFundsOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddFunds} className="bg-orange-500 hover:bg-orange-600 text-white" disabled={saving}>
              {saving ? <Loader2 className="animate-spin h-4 w-4" /> : 'Realizar Recarga'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </MainLayout>
  );
};

export default Finance;