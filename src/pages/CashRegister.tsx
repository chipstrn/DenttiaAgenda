"use client";

import React, { useEffect, useState, useCallback } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { 
  DollarSign, 
  CreditCard, 
  ArrowUpRight,
  Banknote,
  ShoppingBag,
  Receipt,
  ArrowDownRight,
  Plus,
  Trash2,
  Save,
  CheckCircle,
  AlertTriangle,
  Calculator,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ExpenseItem {
  id?: string;
  description: string;
  amount: number;
  category: string;
}

interface WithdrawalItem {
  id?: string;
  description: string;
  amount: number;
  authorized_by: string;
}

const CashRegister = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingRegister, setExistingRegister] = useState<any>(null);
  const [systemData, setSystemData] = useState({
    services_cash: 0,
    services_card: 0,
    services_transfer: 0,
    total: 0
  });

  // Form states
  const [openingBalance, setOpeningBalance] = useState('');
  const [closingBalance, setClosingBalance] = useState('');
  
  // Services
  const [servicesCash, setServicesCash] = useState('');
  const [servicesCard, setServicesCard] = useState('');
  const [servicesTransfer, setServicesTransfer] = useState('');
  
  // Products
  const [productsCash, setProductsCash] = useState('');
  const [productsCard, setProductsCard] = useState('');
  const [productsTransfer, setProductsTransfer] = useState('');
  
  // Other
  const [otherIncome, setOtherIncome] = useState('');
  const [otherIncomeNotes, setOtherIncomeNotes] = useState('');
  
  // Expenses
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [newExpense, setNewExpense] = useState({ description: '', amount: '', category: 'other' });
  
  // Withdrawals
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [showWithdrawalDialog, setShowWithdrawalDialog] = useState(false);
  const [newWithdrawal, setNewWithdrawal] = useState({ description: '', amount: '', authorized_by: '' });

  const today = new Date();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if there's already a register for today
      const todayStr = format(today, 'yyyy-MM-dd');
      const { data: registerData } = await supabase
        .from('cash_registers')
        .select('*')
        .eq('user_id', user.id)
        .eq('register_date', todayStr)
        .single();

      if (registerData) {
        setExistingRegister(registerData);
        // Load existing data
        setOpeningBalance(registerData.opening_balance?.toString() || '');
        setClosingBalance(registerData.closing_balance?.toString() || '');
        setServicesCash(registerData.services_cash?.toString() || '');
        setServicesCard(registerData.services_card?.toString() || '');
        setServicesTransfer(registerData.services_transfer?.toString() || '');
        setProductsCash(registerData.products_cash?.toString() || '');
        setProductsCard(registerData.products_card?.toString() || '');
        setProductsTransfer(registerData.products_transfer?.toString() || '');
        setOtherIncome(registerData.other_income?.toString() || '');
        setOtherIncomeNotes(registerData.other_income_notes || '');

        // Load expenses
        const { data: expensesData } = await supabase
          .from('daily_expenses')
          .select('*')
          .eq('cash_register_id', registerData.id);
        setExpenses(expensesData || []);

        // Load withdrawals
        const { data: withdrawalsData } = await supabase
          .from('cash_withdrawals')
          .select('*')
          .eq('cash_register_id', registerData.id);
        setWithdrawals(withdrawalsData || []);
      }

      // Get system data from payments table
      const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

      const { data: paymentsData } = await supabase
        .from('payments')
        .select('amount, payment_method')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay);

      let sysCash = 0, sysCard = 0, sysTransfer = 0;
      paymentsData?.forEach(p => {
        if (p.payment_method === 'cash') sysCash += p.amount;
        else if (p.payment_method === 'card') sysCard += p.amount;
        else if (p.payment_method === 'transfer') sysTransfer += p.amount;
      });

      setSystemData({
        services_cash: sysCash,
        services_card: sysCard,
        services_transfer: sysTransfer,
        total: sysCash + sysCard + sysTransfer
      });

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addExpense = () => {
    if (!newExpense.description || !newExpense.amount) {
      toast.error('Completa todos los campos');
      return;
    }
    setExpenses(prev => [...prev, {
      description: newExpense.description,
      amount: parseFloat(newExpense.amount),
      category: newExpense.category
    }]);
    setNewExpense({ description: '', amount: '', category: 'other' });
    setShowExpenseDialog(false);
  };

  const removeExpense = (index: number) => {
    setExpenses(prev => prev.filter((_, i) => i !== index));
  };

  const addWithdrawal = () => {
    if (!newWithdrawal.description || !newWithdrawal.amount) {
      toast.error('Completa todos los campos');
      return;
    }
    setWithdrawals(prev => [...prev, {
      description: newWithdrawal.description,
      amount: parseFloat(newWithdrawal.amount),
      authorized_by: newWithdrawal.authorized_by
    }]);
    setNewWithdrawal({ description: '', amount: '', authorized_by: '' });
    setShowWithdrawalDialog(false);
  };

  const removeWithdrawal = (index: number) => {
    setWithdrawals(prev => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const totalServicesReported = (parseFloat(servicesCash) || 0) + (parseFloat(servicesCard) || 0) + (parseFloat(servicesTransfer) || 0);
  const totalProductsReported = (parseFloat(productsCash) || 0) + (parseFloat(productsCard) || 0) + (parseFloat(productsTransfer) || 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalWithdrawals = withdrawals.reduce((sum, w) => sum + w.amount, 0);
  const totalOtherIncome = parseFloat(otherIncome) || 0;
  
  const totalCashReported = (parseFloat(servicesCash) || 0) + (parseFloat(productsCash) || 0) + totalOtherIncome;
  const expectedClosing = (parseFloat(openingBalance) || 0) + totalCashReported - totalExpenses - totalWithdrawals;
  
  const totalReported = totalServicesReported + totalProductsReported + totalOtherIncome;
  const difference = totalReported - systemData.total;

  const handleSubmit = async () => {
    if (!openingBalance) {
      toast.error('Ingresa el saldo inicial');
      return;
    }
    if (!closingBalance) {
      toast.error('Ingresa el saldo final');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const registerData = {
        user_id: user.id,
        cashier_id: user.id,
        register_date: format(today, 'yyyy-MM-dd'),
        opening_balance: parseFloat(openingBalance) || 0,
        closing_balance: parseFloat(closingBalance) || 0,
        services_cash: parseFloat(servicesCash) || 0,
        services_card: parseFloat(servicesCard) || 0,
        services_transfer: parseFloat(servicesTransfer) || 0,
        products_cash: parseFloat(productsCash) || 0,
        products_card: parseFloat(productsCard) || 0,
        products_transfer: parseFloat(productsTransfer) || 0,
        expenses: totalExpenses,
        expenses_notes: expenses.map(e => `${e.description}: $${e.amount}`).join(', '),
        other_income: totalOtherIncome,
        other_income_notes: otherIncomeNotes,
        cash_withdrawals: totalWithdrawals,
        withdrawals_notes: withdrawals.map(w => `${w.description}: $${w.amount}`).join(', '),
        system_services_cash: systemData.services_cash,
        system_services_card: systemData.services_card,
        system_services_transfer: systemData.services_transfer,
        system_total: systemData.total,
        difference: difference,
        status: Math.abs(difference) > 50 ? 'discrepancy' : 'pending',
        updated_at: new Date().toISOString()
      };

      let registerId = existingRegister?.id;

      if (existingRegister) {
        const { error } = await supabase
          .from('cash_registers')
          .update(registerData)
          .eq('id', existingRegister.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('cash_registers')
          .insert(registerData)
          .select()
          .single();
        if (error) throw error;
        registerId = data.id;
      }

      // Save expenses
      if (registerId) {
        // Delete existing and re-insert
        await supabase.from('daily_expenses').delete().eq('cash_register_id', registerId);
        if (expenses.length > 0) {
          const expenseRecords = expenses.map(e => ({
            user_id: user.id,
            cash_register_id: registerId,
            description: e.description,
            amount: e.amount,
            category: e.category
          }));
          await supabase.from('daily_expenses').insert(expenseRecords);
        }

        // Delete existing withdrawals and re-insert
        await supabase.from('cash_withdrawals').delete().eq('cash_register_id', registerId);
        if (withdrawals.length > 0) {
          const withdrawalRecords = withdrawals.map(w => ({
            user_id: user.id,
            cash_register_id: registerId,
            description: w.description,
            amount: w.amount,
            authorized_by: w.authorized_by
          }));
          await supabase.from('cash_withdrawals').insert(withdrawalRecords);
        }
      }

      toast.success('Corte de caja guardado');
      fetchData();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">Corte de Caja</h1>
            <p className="text-ios-gray-500 mt-1 font-medium">
              {format(today, "EEEE, d 'de' MMMM yyyy", { locale: es })}
            </p>
          </div>
          {existingRegister && (
            <div className={cn(
              "px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2",
              existingRegister.status === 'approved' ? 'bg-ios-green/15 text-ios-green' :
              existingRegister.status === 'discrepancy' ? 'bg-ios-red/15 text-ios-red' :
              'bg-ios-orange/15 text-ios-orange'
            )}>
              {existingRegister.status === 'approved' ? (
                <><CheckCircle className="h-4 w-4" /> Aprobado</>
              ) : existingRegister.status === 'discrepancy' ? (
                <><AlertTriangle className="h-4 w-4" /> Discrepancia</>
              ) : (
                <><Clock className="h-4 w-4" /> Pendiente de revisión</>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Opening Balance */}
          <div className="ios-card p-6 animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-ios-blue flex items-center justify-center">
                <Banknote className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-ios-gray-900">Saldo Inicial</h2>
                <p className="text-sm text-ios-gray-500">Efectivo al iniciar el día</p>
              </div>
            </div>
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ios-gray-400" />
              <input
                type="number"
                step="0.01"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                className="ios-input pl-12 text-xl font-bold"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Services Sales */}
          <div className="ios-card p-6 animate-slide-up" style={{ animationDelay: '50ms' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-ios-green flex items-center justify-center">
                <Receipt className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-ios-gray-900">Ventas de Servicios</h2>
                <p className="text-sm text-ios-gray-500">Tratamientos y consultas</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600 flex items-center gap-2">
                  <Banknote className="h-4 w-4" /> Efectivo
                </Label>
                <input
                  type="number"
                  step="0.01"
                  value={servicesCash}
                  onChange={(e) => setServicesCash(e.target.value)}
                  className="ios-input"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" /> Tarjeta
                </Label>
                <input
                  type="number"
                  step="0.01"
                  value={servicesCard}
                  onChange={(e) => setServicesCard(e.target.value)}
                  className="ios-input"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600 flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4" /> Transferencia
                </Label>
                <input
                  type="number"
                  step="0.01"
                  value={servicesTransfer}
                  onChange={(e) => setServicesTransfer(e.target.value)}
                  className="ios-input"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-ios-gray-100 flex justify-between items-center">
              <span className="text-sm text-ios-gray-500">Total Servicios</span>
              <span className="text-lg font-bold text-ios-green">${totalServicesReported.toFixed(2)}</span>
            </div>
          </div>

          {/* Products Sales */}
          <div className="ios-card p-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-ios-purple flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-ios-gray-900">Ventas de Productos</h2>
                <p className="text-sm text-ios-gray-500">Artículos y productos</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600 flex items-center gap-2">
                  <Banknote className="h-4 w-4" /> Efectivo
                </Label>
                <input
                  type="number"
                  step="0.01"
                  value={productsCash}
                  onChange={(e) => setProductsCash(e.target.value)}
                  className="ios-input"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" /> Tarjeta
                </Label>
                <input
                  type="number"
                  step="0.01"
                  value={productsCard}
                  onChange={(e) => setProductsCard(e.target.value)}
                  className="ios-input"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600 flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4" /> Transferencia
                </Label>
                <input
                  type="number"
                  step="0.01"
                  value={productsTransfer}
                  onChange={(e) => setProductsTransfer(e.target.value)}
                  className="ios-input"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-ios-gray-100 flex justify-between items-center">
              <span className="text-sm text-ios-gray-500">Total Productos</span>
              <span className="text-lg font-bold text-ios-purple">${totalProductsReported.toFixed(2)}</span>
            </div>
          </div>

          {/* Expenses */}
          <div className="ios-card p-6 animate-slide-up" style={{ animationDelay: '150ms' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-ios-red flex items-center justify-center">
                  <ArrowDownRight className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-ios-gray-900">Gastos del Día</h2>
                  <p className="text-sm text-ios-gray-500">Egresos y compras</p>
                </div>
              </div>
              <button
                onClick={() => setShowExpenseDialog(true)}
                className="h-10 px-4 rounded-xl bg-ios-red/10 text-ios-red font-semibold text-sm flex items-center gap-2 hover:bg-ios-red/20 transition-colors touch-feedback"
              >
                <Plus className="h-4 w-4" />
                Agregar
              </button>
            </div>
            
            {expenses.length > 0 ? (
              <div className="space-y-2">
                {expenses.map((expense, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-ios-gray-50 rounded-xl">
                    <div>
                      <p className="font-medium text-ios-gray-900">{expense.description}</p>
                      <p className="text-xs text-ios-gray-500">{expense.category}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-ios-red">-${expense.amount.toFixed(2)}</span>
                      <button
                        onClick={() => removeExpense(index)}
                        className="h-8 w-8 rounded-lg bg-ios-red/10 flex items-center justify-center hover:bg-ios-red/20 transition-colors"
                      >
                        <Trash2 className="h-4 w-4 text-ios-red" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="pt-3 border-t border-ios-gray-100 flex justify-between items-center">
                  <span className="text-sm text-ios-gray-500">Total Gastos</span>
                  <span className="text-lg font-bold text-ios-red">-${totalExpenses.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <p className="text-center text-ios-gray-400 py-4">Sin gastos registrados</p>
            )}
          </div>

          {/* Withdrawals */}
          <div className="ios-card p-6 animate-slide-up" style={{ animationDelay: '200ms' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-ios-orange flex items-center justify-center">
                  <ArrowDownRight className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-ios-gray-900">Salidas de Efectivo</h2>
                  <p className="text-sm text-ios-gray-500">Retiros autorizados</p>
                </div>
              </div>
              <button
                onClick={() => setShowWithdrawalDialog(true)}
                className="h-10 px-4 rounded-xl bg-ios-orange/10 text-ios-orange font-semibold text-sm flex items-center gap-2 hover:bg-ios-orange/20 transition-colors touch-feedback"
              >
                <Plus className="h-4 w-4" />
                Agregar
              </button>
            </div>
            
            {withdrawals.length > 0 ? (
              <div className="space-y-2">
                {withdrawals.map((withdrawal, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-ios-gray-50 rounded-xl">
                    <div>
                      <p className="font-medium text-ios-gray-900">{withdrawal.description}</p>
                      {withdrawal.authorized_by && (
                        <p className="text-xs text-ios-gray-500">Autorizado por: {withdrawal.authorized_by}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-ios-orange">-${withdrawal.amount.toFixed(2)}</span>
                      <button
                        onClick={() => removeWithdrawal(index)}
                        className="h-8 w-8 rounded-lg bg-ios-orange/10 flex items-center justify-center hover:bg-ios-orange/20 transition-colors"
                      >
                        <Trash2 className="h-4 w-4 text-ios-orange" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="pt-3 border-t border-ios-gray-100 flex justify-between items-center">
                  <span className="text-sm text-ios-gray-500">Total Salidas</span>
                  <span className="text-lg font-bold text-ios-orange">-${totalWithdrawals.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <p className="text-center text-ios-gray-400 py-4">Sin salidas registradas</p>
            )}
          </div>

          {/* Other Income */}
          <div className="ios-card p-6 animate-slide-up" style={{ animationDelay: '250ms' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-ios-teal flex items-center justify-center">
                <Plus className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-ios-gray-900">Otros Ingresos</h2>
                <p className="text-sm text-ios-gray-500">Ingresos adicionales</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ios-gray-400" />
                <input
                  type="number"
                  step="0.01"
                  value={otherIncome}
                  onChange={(e) => setOtherIncome(e.target.value)}
                  className="ios-input pl-12"
                  placeholder="0.00"
                />
              </div>
              <input
                value={otherIncomeNotes}
                onChange={(e) => setOtherIncomeNotes(e.target.value)}
                className="ios-input"
                placeholder="Descripción (opcional)"
              />
            </div>
          </div>

          {/* Closing Balance */}
          <div className="ios-card p-6 animate-slide-up" style={{ animationDelay: '300ms' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-ios-indigo flex items-center justify-center">
                <Calculator className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-ios-gray-900">Saldo Final</h2>
                <p className="text-sm text-ios-gray-500">Efectivo al cerrar el día</p>
              </div>
            </div>
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ios-gray-400" />
              <input
                type="number"
                step="0.01"
                value={closingBalance}
                onChange={(e) => setClosingBalance(e.target.value)}
                className="ios-input pl-12 text-xl font-bold"
                placeholder="0.00"
              />
            </div>
            <div className="mt-4 p-4 bg-ios-gray-50 rounded-xl">
              <div className="flex justify-between items-center">
                <span className="text-sm text-ios-gray-500">Saldo esperado (calculado)</span>
                <span className="font-bold text-ios-indigo">${expectedClosing.toFixed(2)}</span>
              </div>
              {closingBalance && Math.abs(parseFloat(closingBalance) - expectedClosing) > 1 && (
                <div className="mt-2 flex items-center gap-2 text-ios-orange text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  Diferencia de ${Math.abs(parseFloat(closingBalance) - expectedClosing).toFixed(2)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-6">
          {/* System Data */}
          <div className="ios-card p-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
            <h3 className="font-bold text-ios-gray-900 mb-4 flex items-center gap-2">
              <Calculator className="h-5 w-5 text-ios-blue" />
              Datos del Sistema
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-ios-gray-500">Efectivo</span>
                <span className="font-medium">${systemData.services_cash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-ios-gray-500">Tarjeta</span>
                <span className="font-medium">${systemData.services_card.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-ios-gray-500">Transferencia</span>
                <span className="font-medium">${systemData.services_transfer.toFixed(2)}</span>
              </div>
              <div className="pt-3 border-t border-ios-gray-100 flex justify-between">
                <span className="font-semibold text-ios-gray-900">Total Sistema</span>
                <span className="font-bold text-ios-blue">${systemData.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Comparison */}
          <div className="ios-card p-6 animate-slide-up" style={{ animationDelay: '150ms' }}>
            <h3 className="font-bold text-ios-gray-900 mb-4">Comparación</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-ios-gray-500">Total Reportado</span>
                <span className="font-medium">${totalReported.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-ios-gray-500">Total Sistema</span>
                <span className="font-medium">${systemData.total.toFixed(2)}</span>
              </div>
              <div className={cn(
                "pt-3 border-t flex justify-between items-center",
                Math.abs(difference) > 50 ? "border-ios-red" : "border-ios-gray-100"
              )}>
                <span className="font-semibold text-ios-gray-900">Diferencia</span>
                <span className={cn(
                  "font-bold",
                  difference === 0 ? "text-ios-green" :
                  Math.abs(difference) > 50 ? "text-ios-red" : "text-ios-orange"
                )}>
                  {difference >= 0 ? '+' : ''}${difference.toFixed(2)}
                </span>
              </div>
            </div>
            
            {Math.abs(difference) > 50 && (
              <div className="mt-4 p-3 bg-ios-red/10 rounded-xl flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-ios-red flex-shrink-0 mt-0.5" />
                <p className="text-sm text-ios-red">
                  Hay una discrepancia significativa. El administrador revisará este corte.
                </p>
              </div>
            )}
          </div>

          {/* Save Button */}
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full h-14 rounded-2xl bg-ios-blue text-white font-semibold text-lg flex items-center justify-center gap-2 hover:bg-ios-blue/90 transition-colors touch-feedback disabled:opacity-50 animate-slide-up"
            style={{ animationDelay: '200ms' }}
          >
            {saving ? (
              <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save className="h-5 w-5" />
                Guardar Corte de Caja
              </>
            )}
          </button>
        </div>
      </div>

      {/* Expense Dialog */}
      <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl border-0 shadow-ios-xl p-0">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="text-xl font-bold text-ios-gray-900">Agregar Gasto</DialogTitle>
          </DialogHeader>
          <div className="px-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-ios-gray-600">Descripción</Label>
              <input
                value={newExpense.description}
                onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                className="ios-input"
                placeholder="Ej: Compra de material"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-ios-gray-600">Monto</Label>
              <input
                type="number"
                step="0.01"
                value={newExpense.amount}
                onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                className="ios-input"
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="p-6 pt-4 flex gap-3">
            <button
              onClick={() => setShowExpenseDialog(false)}
              className="flex-1 h-12 rounded-xl bg-ios-gray-100 text-ios-gray-900 font-semibold hover:bg-ios-gray-200 transition-colors touch-feedback"
            >
              Cancelar
            </button>
            <button
              onClick={addExpense}
              className="flex-1 h-12 rounded-xl bg-ios-red text-white font-semibold hover:bg-ios-red/90 transition-colors touch-feedback"
            >
              Agregar
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Withdrawal Dialog */}
      <Dialog open={showWithdrawalDialog} onOpenChange={setShowWithdrawalDialog}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl border-0 shadow-ios-xl p-0">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="text-xl font-bold text-ios-gray-900">Agregar Salida</DialogTitle>
          </DialogHeader>
          <div className="px-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-ios-gray-600">Descripción</Label>
              <input
                value={newWithdrawal.description}
                onChange={(e) => setNewWithdrawal({ ...newWithdrawal, description: e.target.value })}
                className="ios-input"
                placeholder="Ej: Retiro para banco"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-ios-gray-600">Monto</Label>
              <input
                type="number"
                step="0.01"
                value={newWithdrawal.amount}
                onChange={(e) => setNewWithdrawal({ ...newWithdrawal, amount: e.target.value })}
                className="ios-input"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-ios-gray-600">Autorizado por</Label>
              <input
                value={newWithdrawal.authorized_by}
                onChange={(e) => setNewWithdrawal({ ...newWithdrawal, authorized_by: e.target.value })}
                className="ios-input"
                placeholder="Nombre de quien autoriza"
              />
            </div>
          </div>
          <div className="p-6 pt-4 flex gap-3">
            <button
              onClick={() => setShowWithdrawalDialog(false)}
              className="flex-1 h-12 rounded-xl bg-ios-gray-100 text-ios-gray-900 font-semibold hover:bg-ios-gray-200 transition-colors touch-feedback"
            >
              Cancelar
            </button>
            <button
              onClick={addWithdrawal}
              className="flex-1 h-12 rounded-xl bg-ios-orange text-white font-semibold hover:bg-ios-orange/90 transition-colors touch-feedback"
            >
              Agregar
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default CashRegister;