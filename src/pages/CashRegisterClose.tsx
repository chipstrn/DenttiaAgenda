"use client";

import React, { useEffect, useState, useCallback } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Banknote, CreditCard, ArrowUpRight, Send, 
  Loader2, CheckCircle, Clock, Plus, Trash2, Shield, RefreshCw, XCircle, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { format, isToday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// Interfaces (Igual que antes)
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
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingRegister, setExistingRegister] = useState<any>(null);
  const [showNewShiftForm, setShowNewShiftForm] = useState(false);
  
  // Estados del Formulario
  const [openingBalance, setOpeningBalance] = useState('');
  const [servicesCash, setServicesCash] = useState('');
  const [servicesCard, setServicesCard] = useState('');
  const [servicesTransfer, setServicesTransfer] = useState('');
  const [productsCash, setProductsCash] = useState('');
  const [productsCard, setProductsCard] = useState('');
  const [productsTransfer, setProductsTransfer] = useState('');
  const [otherIncome, setOtherIncome] = useState('');
  const [otherIncomeNotes, setOtherIncomeNotes] = useState('');
  
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [withdrawals, setWithdrawals] = useState<CashWithdrawal[]>([]);

  const today = format(new Date(), 'yyyy-MM-dd');

  // Redirección de Admin
  useEffect(() => {
    if (isAdmin) {
      navigate('/finance-audit', { replace: true });
    }
  }, [isAdmin, navigate]);

  // 1. MEJORA CRÍTICA: Lógica de búsqueda de corte
  const checkExistingRegister = useCallback(async () => {
    if (!user?.id || isAdmin) return;

    try {
      // Buscamos el último corte que NO esté eliminado (voided)
      const { data, error } = await supabase
        .from('cash_registers')
        .select('*')
        .eq('cashier_id', user.id)
        .neq('status', 'voided') // <--- CLAVE: Ignorar los eliminados
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error checking register:', error);
        setLoading(false);
        return;
      }

      if (data) {
        const registerDate = parseISO(data.register_date);
        
        // Solo bloqueamos si es de HOY. Si es de ayer, dejamos abrir uno nuevo.
        if (isToday(registerDate)) {
          setExistingRegister(data);
        } else {
          setExistingRegister(null);
        }
      } else {
        setExistingRegister(null);
      }
    } catch (error) {
      console.error('Error in checkExistingRegister:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, isAdmin]);

  // 2. MEJORA CRÍTICA: Suscripción en Tiempo Real (Magic Update)
  useEffect(() => {
    checkExistingRegister();

    // Si hay un corte pendiente, escuchamos cambios en vivo
    const channel = supabase
      .channel('cash_register_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cash_registers',
          filter: `cashier_id=eq.${user?.id}`,
        },
        (payload) => {
          // Si el admin aprueba/rechaza/borra, actualizamos la pantalla al instante
          console.log('Cambio detectado:', payload);
          checkExistingRegister();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [checkExistingRegister, user?.id]);

  const resetForm = useCallback(() => {
    setOpeningBalance('');
    setServicesCash('');
    setServicesCard('');
    setServicesTransfer('');
    setProductsCash('');
    setProductsCard('');
    setProductsTransfer('');
    setOtherIncome('');
    setOtherIncomeNotes('');
    setExpenses([]);
    setWithdrawals([]);
  }, []);

  const handleStartNewShift = useCallback(() => {
    resetForm();
    setExistingRegister(null);
    setShowNewShiftForm(true);
  }, [resetForm]);

  const handleCancelNewShift = useCallback(() => {
    setShowNewShiftForm(false);
    checkExistingRegister();
  }, [checkExistingRegister]);

  // Funciones auxiliares de gastos (Sin cambios)
  const addExpense = useCallback(() => setExpenses(prev => [...prev, { description: '', amount: '', category: 'general' }]), []);
  const removeExpense = useCallback((index: number) => setExpenses(prev => prev.filter((_, i) => i !== index)), []);
  const updateExpense = useCallback((index: number, field: keyof DailyExpense, value: string) => {
    setExpenses(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  const addWithdrawal = useCallback(() => setWithdrawals(prev => [...prev, { description: '', amount: '', authorized_by: '' }]), []);
  const removeWithdrawal = useCallback((index: number) => setWithdrawals(prev => prev.filter((_, i) => i !== index)), []);
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
      totalExpenses, totalWithdrawals, totalCash, totalCard, totalTransfer, closingBalance,
      grandTotal: totalCash + totalCard + totalTransfer
    };
  }, [expenses, withdrawals, servicesCash, productsCash, otherIncome, servicesCard, productsCard, servicesTransfer, productsTransfer, openingBalance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setSubmitting(true);

    try {
      const totals = calculateTotals();

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

      // Insertar Gastos
      if (expenses.length > 0) {
        const validExpenses = expenses.filter(e => e.description && e.amount).map(e => ({
          user_id: user.id, cash_register_id: registerData.id, description: e.description, amount: parseFloat(e.amount), category: e.category
        }));
        if (validExpenses.length) await supabase.from('daily_expenses').insert(validExpenses);
      }

      // Insertar Retiros
      if (withdrawals.length > 0) {
        const validWithdrawals = withdrawals.filter(w => w.description && w.amount).map(w => ({
          user_id: user.id, cash_register_id: registerData.id, description: w.description, amount: parseFloat(w.amount), authorized_by: w.authorized_by
        }));
        if (validWithdrawals.length) await supabase.from('cash_withdrawals').insert(validWithdrawals);
      }

      toast.success('Corte enviado a revisión');
      // No seteamos existingRegister manualmente aquí, dejamos que la suscripción o el check lo haga
      checkExistingRegister();
      setShowNewShiftForm(false);
    } catch (error: any) {
      console.error('Error submitting:', error);
      toast.error(error.message || 'Error al enviar corte');
    } finally {
      setSubmitting(false);
    }
  };

  const totals = calculateTotals();

  // Loading State
  if (loading) return <MainLayout><div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-ios-blue" /></div></MainLayout>;

  // VISTA: YA EXISTE UN CORTE HOY (Aprobado, Pendiente o Rechazado)
  if (existingRegister && !showNewShiftForm) {
    return (
      <MainLayout>
        <div className="max-w-2xl mx-auto">
          <div className="text-center py-12 animate-scale-in">
            {/* Icono de Estado Dinámico */}
            <div className={cn(
              "h-24 w-24 rounded-full flex items-center justify-center mx-auto mb-6",
              existingRegister.status === 'approved' ? 'bg-ios-green/15' :
              existingRegister.status === 'rejected' ? 'bg-ios-red/15' : 'bg-ios-orange/15'
            )}>
              {existingRegister.status === 'approved' ? <CheckCircle className="h-12 w-12 text-ios-green" /> :
               existingRegister.status === 'rejected' ? <XCircle className="h-12 w-12 text-ios-red" /> :
               <Clock className="h-12 w-12 text-ios-orange" />}
            </div>
            
            <h1 className="text-2xl font-bold text-ios-gray-900 mb-2">
              {existingRegister.status === 'approved' ? 'Corte Aprobado' :
               existingRegister.status === 'rejected' ? 'Corte Rechazado' : 'Corte Enviado a Revisión'}
            </h1>
            
            <p className="text-ios-gray-500 mb-6 max-w-md mx-auto">
              {existingRegister.status === 'pending' 
                ? 'Tu corte está en espera. Si el administrador lo aprueba, verás el cambio aquí automáticamente.'
                : existingRegister.status === 'approved'
                ? '¡Todo en orden! Puedes iniciar un nuevo turno si es necesario.'
                : 'Hay discrepancias en tu corte. Revisa las notas y contacta al administrador.'}
            </p>

            {/* Tarjeta de Resumen */}
            <div className="ios-card p-6 text-left mb-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-ios-gray-900 mb-4 flex justify-between">
                Resumen del Corte
                <span className="text-xs font-normal text-gray-400">ID: {existingRegister.id.slice(0,8)}</span>
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-ios-gray-500">Fecha / Hora</span>
                  <span className="font-medium">{format(parseISO(existingRegister.created_at), "d MMM, HH:mm", { locale: es })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ios-gray-500">Saldo Inicial</span>
                  <span className="font-medium text-gray-700">${existingRegister.opening_balance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-100 pt-2">
                  <span className="text-ios-gray-900 font-medium">Total Declarado</span>
                  <span className="font-bold text-ios-blue text-lg">${existingRegister.closing_balance.toFixed(2)}</span>
                </div>
                
                {existingRegister.admin_notes && (
                  <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-100">
                    <p className="text-xs font-bold text-red-600 mb-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Notas del Administrador:
                    </p>
                    <p className="text-gray-800 italic">"{existingRegister.admin_notes}"</p>
                  </div>
                )}
              </div>
            </div>

            {/* BOTÓN CRÍTICO: INICIAR NUEVO TURNO */}
            <div className="space-y-3">
              <button
                onClick={handleStartNewShift}
                className="w-full h-14 rounded-2xl bg-ios-blue text-white font-bold text-lg shadow-ios-lg hover:bg-ios-blue/90 transition-all duration-200 touch-feedback flex items-center justify-center gap-3"
              >
                <RefreshCw className="h-5 w-5" />
                Iniciar Nuevo Turno
              </button>
              
              {existingRegister.status === 'pending' && (
                <p className="text-xs text-center text-gray-400">
                  ¿Te equivocaste? Pide al admin que lo elimine para empezar de nuevo.
                </p>
              )}
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  // VISTA: FORMULARIO DE NUEVO CORTE
  return (
    <MainLayout>
      <div className="mb-6 animate-fade-in flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">
            {showNewShiftForm ? 'Nuevo Turno' : 'Corte de Caja'}
          </h1>
          <p className="text-ios-gray-500 mt-1 font-medium">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
          </p>
        </div>
        {showNewShiftForm && (
          <button 
            onClick={handleCancelNewShift}
            className="text-sm text-ios-blue font-medium hover:bg-blue-50 px-3 py-1 rounded-full transition-colors"
          >
            Cancelar
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6 pb-20">
        
        {/* SECCIÓN 1: SALDO INICIAL */}
        <div className="ios-card p-5 animate-slide-up border-l-4 border-l-ios-blue">
          <h2 className="font-bold text-ios-gray-900 mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-ios-blue" /> Saldo Inicial
          </h2>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-ios-gray-600">¿Con cuánto dinero abres caja?</Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
              <input
                type="number" step="0.01" required placeholder="0.00"
                value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)}
                className="ios-input pl-8 text-lg font-medium"
              />
            </div>
          </div>
        </div>

        {/* SECCIÓN 2: INGRESOS SERVICIOS */}
        <div className="ios-card p-5 animate-slide-up delay-75">
          <h2 className="font-bold text-ios-gray-900 mb-4">Ingresos por Servicios</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <InputMoney label="Efectivo" icon={<Banknote className="text-green-500" />} value={servicesCash} onChange={setServicesCash} />
            <InputMoney label="Tarjeta" icon={<CreditCard className="text-purple-500" />} value={servicesCard} onChange={setServicesCard} />
            <InputMoney label="Transferencia" icon={<ArrowUpRight className="text-blue-500" />} value={servicesTransfer} onChange={setServicesTransfer} />
          </div>
        </div>

        {/* SECCIÓN 3: INGRESOS PRODUCTOS */}
        <div className="ios-card p-5 animate-slide-up delay-100">
          <h2 className="font-bold text-ios-gray-900 mb-4">Ingresos por Productos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <InputMoney label="Efectivo" icon={<Banknote className="text-green-600" />} value={productsCash} onChange={setProductsCash} />
            <InputMoney label="Tarjeta" icon={<CreditCard className="text-purple-600" />} value={productsCard} onChange={setProductsCard} />
            <InputMoney label="Transferencia" icon={<ArrowUpRight className="text-blue-600" />} value={productsTransfer} onChange={setProductsTransfer} />
          </div>
        </div>

        {/* SECCIÓN 4: OTROS INGRESOS */}
        {(otherIncome || otherIncomeNotes || showNewShiftForm) && (
           <div className="ios-card p-5 animate-slide-up delay-150">
             <h2 className="font-bold text-ios-gray-900 mb-4">Otros Ingresos</h2>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <InputMoney label="Monto" value={otherIncome} onChange={setOtherIncome} />
               <div className="space-y-2">
                 <Label className="text-xs uppercase text-gray-400 font-bold tracking-wider">Concepto</Label>
                 <input value={otherIncomeNotes} onChange={(e) => setOtherIncomeNotes(e.target.value)} placeholder="Ej. Propina" className="ios-input" />
               </div>
             </div>
           </div>
        )}

        {/* GASTOS Y RETIROS (Simplificados visualmente) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <DynamicList title="Gastos del Día" items={expenses} onAdd={addExpense} onRemove={removeExpense} onUpdate={updateExpense} type="expense" />
          <DynamicList title="Retiros de Efectivo" items={withdrawals} onAdd={addWithdrawal} onRemove={removeWithdrawal} onUpdate={updateWithdrawal} type="withdrawal" />
        </div>

        {/* RESUMEN FINAL FLOTANTE O FIJO */}
        <div className="ios-card p-6 bg-slate-900 text-white shadow-xl animate-slide-up delay-200">
          <h2 className="font-bold mb-4 text-lg border-b border-gray-700 pb-2">Resumen Preliminar</h2>
          <div className="space-y-2 text-sm">
            <Row label="Total Efectivo" value={totals.totalCash} color="text-green-400" />
            <Row label="Total Digital (Tarjeta/Transf)" value={totals.totalCard + totals.totalTransfer} />
            <Row label="(-) Gastos y Retiros" value={totals.totalExpenses + totals.totalWithdrawals} color="text-red-400" />
            <div className="pt-3 mt-2 border-t border-gray-700 flex justify-between items-end">
              <span className="font-bold text-gray-300">Saldo Final en Caja</span>
              <span className="text-3xl font-bold text-white tracking-tight">${totals.closingBalance.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full h-16 rounded-2xl bg-ios-blue text-white font-bold text-xl shadow-ios-lg hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-3"
        >
          {submitting ? <Loader2 className="animate-spin" /> : <Send />}
          {submitting ? 'Enviando...' : 'Finalizar Turno'}
        </button>
      </form>
    </MainLayout>
  );
};

// Componentes UI Auxiliares para limpiar el código principal
const InputMoney = ({ label, icon, value, onChange }: any) => (
  <div className="space-y-2">
    <Label className="text-xs uppercase text-gray-400 font-bold tracking-wider flex items-center gap-1">
      {icon} {label}
    </Label>
    <div className="relative group">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 font-medium group-focus-within:text-ios-blue">$</span>
      <input
        type="number" step="0.01" placeholder="0.00"
        value={value} onChange={(e) => onChange(e.target.value)}
        className="ios-input pl-7 transition-all focus:ring-2 focus:ring-ios-blue/20"
      />
    </div>
  </div>
);

const Row = ({ label, value, color = "text-white" }: any) => (
  <div className="flex justify-between items-center">
    <span className="text-gray-400">{label}</span>
    <span className={`font-medium ${color}`}>${value.toFixed(2)}</span>
  </div>
);

const DynamicList = ({ title, items, onAdd, onRemove, onUpdate, type }: any) => (
  <div className="ios-card p-5 animate-slide-up">
    <div className="flex items-center justify-between mb-4">
      <h2 className="font-bold text-ios-gray-900">{title}</h2>
      <button type="button" onClick={onAdd} className="p-1 rounded-full hover:bg-gray-100 text-ios-blue">
        <Plus className="h-5 w-5" />
      </button>
    </div>
    <div className="space-y-3">
      {items.map((item: any, i: number) => (
        <div key={i} className="flex gap-2 items-start">
          <input 
            placeholder={type === 'expense' ? "Descripción" : "Motivo"} 
            value={item.description} 
            onChange={(e) => onUpdate(i, 'description', e.target.value)}
            className="ios-input flex-1 min-w-0" 
          />
          <input 
            type="number" placeholder="0" 
            value={item.amount} 
            onChange={(e) => onUpdate(i, 'amount', e.target.value)}
            className="ios-input w-20 text-center px-1" 
          />
          <button type="button" onClick={() => onRemove(i)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      {items.length === 0 && <p className="text-xs text-center text-gray-400 py-2">Ninguno registrado</p>}
    </div>
  </div>
);

export default CashRegisterClose;