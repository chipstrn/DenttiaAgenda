"use client";

import React, { useEffect, useState, useCallback } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { 
  Banknote, CreditCard, ArrowUpRight, Send, 
  Loader2, CheckCircle, Clock, Plus, Trash2 
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface DailyExpense {
  id?: string;
  description: string;
  amount: string;
  category: string;
}

interface CashWithdrawal {
  id?: string;
  description: string;
  amount: string;
  authorized_by: string;
}

const CashRegisterClose = () => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingRegister, setExistingRegister] = useState<any>(null);
  
  // Formulario de corte - Individual states
  const [openingBalance, setOpeningBalance] = useState('');
  const [servicesCash, setServicesCash] = useState('');
  const [servicesCard, setServicesCard] = useState('');
  const [servicesTransfer, setServicesTransfer] = useState('');
  const [productsCash, setProductsCash] = useState('');
  const [productsCard, setProductsCard] = useState('');
  const [productsTransfer, setProductsTransfer] = useState('');
  const [otherIncome, setOtherIncome] = useState('');
  const [otherIncomeNotes, setOtherIncomeNotes] = useState('');
  
  // Gastos y retiros
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [withdrawals, setWithdrawals] = useState<CashWithdrawal[]>([]);

  const today = format(new Date(), 'yyyy-MM-dd');

  const checkExistingRegister = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('cash_registers')
        .select('*')
        .eq('user_id', user.id)
        .eq('register_date', today)
        .maybeSingle();

      if (error) {
        console.error('Error checking register:', error);
        return;
      }

      if (data) {
        setExistingRegister(data);
      }
    } catch (error) {
      console.error('Error in checkExistingRegister:', error);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    checkExistingRegister();
  }, [checkExistingRegister]);

  const addExpense = useCallback(() => {
    setExpenses(prev => [...prev, { description: '', amount: '', category: 'general' }]);
  }, []);

  const removeExpense = useCallback((index: number) => {
    setExpenses(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateExpense = useCallback((index: number, field: keyof DailyExpense, value: string) => {
    setExpenses(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  const addWithdrawal = useCallback(() => {
    setWithdrawals(prev => [...prev, { description: '', amount: '', authorized_by: '' }]);
  }, []);

  const removeWithdrawal = useCallback((index: number) => {
    setWithdrawals(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateWithdrawal = useCallback((index: number, field: keyof CashWithdrawal, value: string) => {
    setWithdrawals(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  const calculateTotals = useCallback(() => {
    const totalExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const totalWithdrawals = withdrawals.reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0);
    
    const totalCash = (parseFloat(servicesCash) || 0) + (parseFloat(productsCash) || 0) + (parseFloat(otherIncome) || 0);
    const totalCard = (parseFloat(servicesCard) || 0) + (parseFloat(productsCard) || 0);
    const totalTransfer = (parseFloat(servicesTransfer) || 0) + (parseFloat(productsTransfer) || 0);
    
    const closingBalance = (parseFloat(openingBalance) || 0) + totalCash - totalExpenses - totalWithdrawals;
    
    return {
      totalExpenses,
      totalWithdrawals,
      totalCash,
      totalCard,
      totalTransfer,
      closingBalance,
      grandTotal: totalCash + totalCard + totalTransfer
    };
  }, [expenses, withdrawals, servicesCash, productsCash, otherIncome, servicesCard, productsCard, servicesTransfer, productsTransfer, openingBalance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const totals = calculateTotals();

      // Crear registro de caja
      const { data: registerData, error: registerError } = await supabase
        .from('cash_registers')
        .insert({
          user_id: user.id,
          cashier_id: user.id,
          register_date: today,
          opening_balance: parseFloat(openingBalance) || 0,
          closing_balance: totals.closingBalance,
          services_cash: parseFloat(servicesCash) || 0,
          services_card: parseFloat(servicesCard) || 0,
          services_transfer: parseFloat(servicesTransfer) || 0,
          products_cash: parseFloat(productsCash) || 0,
          products_card: parseFloat(productsCard) || 0,
          products_transfer: parseFloat(productsTransfer) || 0,
          expenses: totals.totalExpenses,
          other_income: parseFloat(otherIncome) || 0,
          other_income_notes: otherIncomeNotes,
          cash_withdrawals: totals.totalWithdrawals,
          status: 'pending'
        })
        .select()
        .single();

      if (registerError) throw registerError;

      // Guardar gastos
      if (expenses.length > 0) {
        const expensesData = expenses
          .filter(e => e.description && e.amount)
          .map(e => ({
            user_id: user.id,
            cash_register_id: registerData.id,
            description: e.description,
            amount: parseFloat(e.amount),
            category: e.category
          }));

        if (expensesData.length > 0) {
          await supabase.from('daily_expenses').insert(expensesData);
        }
      }

      // Guardar retiros
      if (withdrawals.length > 0) {
        const withdrawalsData = withdrawals
          .filter(w => w.description && w.amount)
          .map(w => ({
            user_id: user.id,
            cash_register_id: registerData.id,
            description: w.description,
            amount: parseFloat(w.amount),
            authorized_by: w.authorized_by
          }));

        if (withdrawalsData.length > 0) {
          await supabase.from('cash_withdrawals').insert(withdrawalsData);
        }
      }

      toast.success('Corte enviado a revisión');
      setExistingRegister(registerData);
    } catch (error: any) {
      console.error('Error submitting cash register:', error);
      toast.error(error.message || 'Error al enviar corte');
    } finally {
      setSubmitting(false);
    }
  };

  const totals = calculateTotals();

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-ios-blue" />
        </div>
      </MainLayout>
    );
  }

  // Si ya existe un corte para hoy - MODO CIEGO para recepción
  // NO muestra diferencias ni resultados de auditoría
  if (existingRegister) {
    return (
      <MainLayout>
        <div className="max-w-2xl mx-auto">
          <div className="text-center py-16 animate-scale-in">
            <div className={cn(
              "h-24 w-24 rounded-full flex items-center justify-center mx-auto mb-6",
              existingRegister.status === 'approved' ? 'bg-ios-green/15' :
              existingRegister.status === 'rejected' ? 'bg-ios-red/15' : 'bg-ios-orange/15'
            )}>
              {existingRegister.status === 'approved' ? (
                <CheckCircle className="h-12 w-12 text-ios-green" />
              ) : existingRegister.status === 'rejected' ? (
                <CheckCircle className="h-12 w-12 text-ios-red" />
              ) : (
                <Clock className="h-12 w-12 text-ios-orange" />
              )}
            </div>
            
            <h1 className="text-2xl font-bold text-ios-gray-900 mb-2">
              {existingRegister.status === 'approved' ? 'Corte Aprobado' :
               existingRegister.status === 'rejected' ? 'Corte Rechazado' : 'Corte Enviado a Revisión'}
            </h1>
            <p className="text-ios-gray-500 mb-8">
              {existingRegister.status === 'pending' 
                ? 'Tu corte de caja está pendiente de revisión por el administrador. Te notificaremos cuando sea revisado.'
                : existingRegister.status === 'approved'
                ? 'El administrador ha aprobado tu corte de caja.'
                : 'El administrador ha rechazado tu corte. Revisa las notas.'}
            </p>

            <div className="ios-card p-6 text-left">
              <h3 className="font-semibold text-ios-gray-900 mb-4">Resumen del Corte</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-ios-gray-500">Fecha</span>
                  <span className="font-medium">{format(new Date(existingRegister.register_date), "d 'de' MMMM, yyyy", { locale: es })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ios-gray-500">Saldo Inicial</span>
                  <span className="font-medium">${existingRegister.opening_balance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ios-gray-500">Total Efectivo Declarado</span>
                  <span className="font-bold text-ios-blue">${existingRegister.closing_balance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ios-gray-500">Total Tarjeta</span>
                  <span className="font-medium">${(existingRegister.services_card + existingRegister.products_card).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ios-gray-500">Total Transferencia</span>
                  <span className="font-medium">${(existingRegister.services_transfer + existingRegister.products_transfer).toFixed(2)}</span>
                </div>
                
                {/* Solo mostrar notas del admin si el corte fue revisado */}
                {existingRegister.status !== 'pending' && existingRegister.admin_notes && (
                  <div className="pt-3 border-t border-ios-gray-100">
                    <p className="text-sm text-ios-gray-500 mb-1">Notas del Administrador:</p>
                    <p className="text-ios-gray-900">{existingRegister.admin_notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Mensaje de espera para cortes pendientes */}
            {existingRegister.status === 'pending' && (
              <div className="mt-6 p-4 rounded-2xl bg-ios-orange/10 border border-ios-orange/20">
                <p className="text-sm text-ios-orange font-medium">
                  ⏳ El administrador revisará tu corte y te notificará el resultado.
                </p>
              </div>
            )}
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">Corte de Caja</h1>
        <p className="text-ios-gray-500 mt-1 font-medium">
          {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        {/* Saldo Inicial */}
        <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '0ms' }}>
          <h2 className="font-bold text-ios-gray-900 mb-4">Saldo Inicial</h2>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-ios-gray-600">Efectivo en caja al iniciar</Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ios-gray-400 font-medium">$</span>
              <input
                type="number"
                step="0.01"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="0.00"
                required
                className="ios-input pl-8"
              />
            </div>
          </div>
        </div>

        {/* Ingresos por Servicios */}
        <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '50ms' }}>
          <h2 className="font-bold text-ios-gray-900 mb-4">Ingresos por Servicios</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-ios-gray-600 flex items-center gap-2">
                <Banknote className="h-4 w-4 text-ios-green" />
                Efectivo
              </Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ios-gray-400 font-medium">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={servicesCash}
                  onChange={(e) => setServicesCash(e.target.value)}
                  placeholder="0.00"
                  className="ios-input pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-ios-gray-600 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-ios-purple" />
                Tarjeta
              </Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ios-gray-400 font-medium">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={servicesCard}
                  onChange={(e) => setServicesCard(e.target.value)}
                  placeholder="0.00"
                  className="ios-input pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-ios-gray-600 flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-ios-blue" />
                Transferencia
              </Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ios-gray-400 font-medium">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={servicesTransfer}
                  onChange={(e) => setServicesTransfer(e.target.value)}
                  placeholder="0.00"
                  className="ios-input pl-8"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Ingresos por Productos */}
        <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <h2 className="font-bold text-ios-gray-900 mb-4">Ingresos por Productos</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-ios-gray-600 flex items-center gap-2">
                <Banknote className="h-4 w-4 text-ios-green" />
                Efectivo
              </Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ios-gray-400 font-medium">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={productsCash}
                  onChange={(e) => setProductsCash(e.target.value)}
                  placeholder="0.00"
                  className="ios-input pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-ios-gray-600 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-ios-purple" />
                Tarjeta
              </Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ios-gray-400 font-medium">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={productsCard}
                  onChange={(e) => setProductsCard(e.target.value)}
                  placeholder="0.00"
                  className="ios-input pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-ios-gray-600 flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-ios-blue" />
                Transferencia
              </Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ios-gray-400 font-medium">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={productsTransfer}
                  onChange={(e) => setProductsTransfer(e.target.value)}
                  placeholder="0.00"
                  className="ios-input pl-8"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Otros Ingresos */}
        <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '150ms' }}>
          <h2 className="font-bold text-ios-gray-900 mb-4">Otros Ingresos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-ios-gray-600">Monto</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ios-gray-400 font-medium">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={otherIncome}
                  onChange={(e) => setOtherIncome(e.target.value)}
                  placeholder="0.00"
                  className="ios-input pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-ios-gray-600">Concepto</Label>
              <input
                value={otherIncomeNotes}
                onChange={(e) => setOtherIncomeNotes(e.target.value)}
                placeholder="Descripción del ingreso"
                className="ios-input"
              />
            </div>
          </div>
        </div>

        {/* Gastos del Día */}
        <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-ios-gray-900">Gastos del Día</h2>
            <button
              type="button"
              onClick={addExpense}
              className="flex items-center gap-1 text-sm text-ios-blue font-medium hover:opacity-70 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              Agregar
            </button>
          </div>
          
          {expenses.length === 0 ? (
            <p className="text-ios-gray-400 text-sm text-center py-4">Sin gastos registrados</p>
          ) : (
            <div className="space-y-3">
              {expenses.map((expense, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-ios-gray-50 rounded-xl">
                  <input
                    value={expense.description}
                    onChange={(e) => updateExpense(index, 'description', e.target.value)}
                    placeholder="Descripción"
                    className="flex-1 ios-input"
                  />
                  <div className="relative w-32">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ios-gray-400 font-medium">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={expense.amount}
                      onChange={(e) => updateExpense(index, 'amount', e.target.value)}
                      placeholder="0.00"
                      className="ios-input pl-7"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeExpense(index)}
                    className="h-10 w-10 rounded-lg bg-ios-red/10 text-ios-red flex items-center justify-center hover:bg-ios-red/20 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Retiros de Efectivo */}
        <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '250ms' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-ios-gray-900">Retiros de Efectivo</h2>
            <button
              type="button"
              onClick={addWithdrawal}
              className="flex items-center gap-1 text-sm text-ios-blue font-medium hover:opacity-70 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              Agregar
            </button>
          </div>
          
          {withdrawals.length === 0 ? (
            <p className="text-ios-gray-400 text-sm text-center py-4">Sin retiros registrados</p>
          ) : (
            <div className="space-y-3">
              {withdrawals.map((withdrawal, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-ios-gray-50 rounded-xl">
                  <input
                    value={withdrawal.description}
                    onChange={(e) => updateWithdrawal(index, 'description', e.target.value)}
                    placeholder="Motivo"
                    className="flex-1 ios-input"
                  />
                  <div className="relative w-32">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ios-gray-400 font-medium">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={withdrawal.amount}
                      onChange={(e) => updateWithdrawal(index, 'amount', e.target.value)}
                      placeholder="0.00"
                      className="ios-input pl-7"
                    />
                  </div>
                  <input
                    value={withdrawal.authorized_by}
                    onChange={(e) => updateWithdrawal(index, 'authorized_by', e.target.value)}
                    placeholder="Autorizado por"
                    className="w-36 ios-input"
                  />
                  <button
                    type="button"
                    onClick={() => removeWithdrawal(index)}
                    className="h-10 w-10 rounded-lg bg-ios-red/10 text-ios-red flex items-center justify-center hover:bg-ios-red/20 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resumen - Solo muestra lo que declaró, NO muestra comparación */}
        <div className="ios-card p-5 bg-ios-gray-900 text-white animate-slide-up" style={{ animationDelay: '300ms' }}>
          <h2 className="font-bold mb-4">Resumen del Corte</h2>
          <div className="space-y-3">
            <div className="flex justify-between text-ios-gray-300">
              <span>Total Efectivo</span>
              <span className="font-medium text-white">${totals.totalCash.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-ios-gray-300">
              <span>Total Tarjeta</span>
              <span className="font-medium text-white">${totals.totalCard.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-ios-gray-300">
              <span>Total Transferencia</span>
              <span className="font-medium text-white">${totals.totalTransfer.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-ios-gray-300">
              <span>(-) Gastos</span>
              <span className="font-medium text-ios-red">${totals.totalExpenses.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-ios-gray-300">
              <span>(-) Retiros</span>
              <span className="font-medium text-ios-red">${totals.totalWithdrawals.toFixed(2)}</span>
            </div>
            <div className="pt-3 border-t border-ios-gray-700 flex justify-between">
              <span className="font-bold">Saldo Final en Caja</span>
              <span className="text-2xl font-bold text-ios-green">${totals.closingBalance.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full h-14 rounded-2xl bg-ios-blue text-white font-bold text-lg shadow-ios-lg hover:bg-ios-blue/90 transition-all duration-200 touch-feedback disabled:opacity-50 flex items-center justify-center gap-3 animate-slide-up"
          style={{ animationDelay: '350ms' }}
        >
          {submitting ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Send className="h-6 w-6" />
              Enviar Corte a Revisión
            </>
          )}
        </button>
      </form>
    </MainLayout>
  );
};

export default CashRegisterClose;