"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    DollarSign, CreditCard, Banknote, Clock, CheckCircle,
    Plus, Receipt, TrendingDown, ArrowUpRight, ArrowDownRight,
    Loader2, User, Calendar, X, Save
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface PendingPayment {
    id: string;
    amount: number;
    status: string;
    created_at: string;
    patient_id: string;
    appointment_id: string;
    patients: {
        first_name: string;
        last_name: string;
    };
    appointments: {
        title: string;
        start_time: string;
    };
}

interface Expense {
    id: string;
    description: string;
    amount: number;
    category: string;
    created_at: string;
}

const EXPENSE_CATEGORIES = [
    { value: 'supplies', label: 'Insumos', icon: '🩹' },
    { value: 'utilities', label: 'Servicios', icon: '💡' },
    { value: 'cleaning', label: 'Limpieza', icon: '🧹' },
    { value: 'food', label: 'Alimentos', icon: '🍔' },
    { value: 'transport', label: 'Transporte', icon: '🚗' },
    { value: 'other', label: 'Otro', icon: '📦' },
];

const ReceptionFinance = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'pending' | 'expenses' | 'today'>('pending');

    // Pending payments
    const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
    const [loadingPayments, setLoadingPayments] = useState(true);
    const [processingPayment, setProcessingPayment] = useState<string | null>(null);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('cash');

    // Expenses
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loadingExpenses, setLoadingExpenses] = useState(false);
    const [showExpenseForm, setShowExpenseForm] = useState(false);
    const [expenseDescription, setExpenseDescription] = useState('');
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseCategory, setExpenseCategory] = useState('other');
    const [savingExpense, setSavingExpense] = useState(false);

    // Today's summary
    const [todayCollected, setTodayCollected] = useState(0);
    const [todayExpenses, setTodayExpenses] = useState(0);
    const [todayPayments, setTodayPayments] = useState<any[]>([]);

    const fetchPendingPayments = useCallback(async () => {
        setLoadingPayments(true);
        try {
            const { data, error } = await supabase
                .from('payments')
                .select(`
                    *,
                    patients (first_name, last_name),
                    appointments (title, start_time)
                `)
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPendingPayments(data || []);
        } catch (error) {
            console.error('Error fetching pending payments:', error);
            toast.error('Error al cargar cobros pendientes');
        } finally {
            setLoadingPayments(false);
        }
    }, []);

    const fetchExpenses = useCallback(async () => {
        setLoadingExpenses(true);
        try {
            const today = new Date();
            const start = startOfDay(today).toISOString();
            const end = endOfDay(today).toISOString();

            const { data, error } = await supabase
                .from('daily_expenses')
                .select('*')
                .gte('created_at', start)
                .lte('created_at', end)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setExpenses(data || []);
            setTodayExpenses(data?.reduce((acc, e) => acc + Number(e.amount), 0) || 0);
        } catch (error) {
            console.error('Error fetching expenses:', error);
            toast.error('Error al cargar gastos');
        } finally {
            setLoadingExpenses(false);
        }
    }, []);

    const fetchTodaySummary = useCallback(async () => {
        try {
            const today = new Date();
            const start = startOfDay(today).toISOString();
            const end = endOfDay(today).toISOString();

            // Today's collected payments
            const { data: payments, error: paymentsError } = await supabase
                .from('payments')
                .select(`
                    *,
                    patients (first_name, last_name),
                    appointments (title)
                `)
                .eq('status', 'paid')
                .gte('created_at', start)
                .lte('created_at', end)
                .order('created_at', { ascending: false });

            if (paymentsError) throw paymentsError;

            setTodayPayments(payments || []);
            setTodayCollected(payments?.reduce((acc, p) => acc + Number(p.amount), 0) || 0);

            // Today's expenses
            const { data: expensesData, error: expensesError } = await supabase
                .from('daily_expenses')
                .select('*')
                .gte('created_at', start)
                .lte('created_at', end);

            if (expensesError) throw expensesError;
            setTodayExpenses(expensesData?.reduce((acc, e) => acc + Number(e.amount), 0) || 0);
        } catch (error) {
            console.error('Error fetching today summary:', error);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'pending') {
            fetchPendingPayments();
        } else if (activeTab === 'expenses') {
            fetchExpenses();
        } else {
            fetchTodaySummary();
        }
    }, [activeTab, fetchPendingPayments, fetchExpenses, fetchTodaySummary]);

    const handleCollectPayment = async (payment: PendingPayment) => {
        setProcessingPayment(payment.id);
        try {
            const { error } = await supabase
                .from('payments')
                .update({
                    status: 'paid',
                    payment_method: selectedPaymentMethod,
                    user_id: user?.id
                })
                .eq('id', payment.id);

            if (error) throw error;

            setPendingPayments(prev => prev.filter(p => p.id !== payment.id));
            toast.success(`Cobro de $${Number(payment.amount).toLocaleString()} registrado`);
        } catch (error) {
            console.error('Error collecting payment:', error);
            toast.error('Error al registrar cobro');
        } finally {
            setProcessingPayment(null);
        }
    };

    const handleSaveExpense = async () => {
        if (!expenseDescription.trim() || !expenseAmount) {
            toast.error('Completa todos los campos');
            return;
        }

        setSavingExpense(true);
        try {
            const { error } = await supabase
                .from('daily_expenses')
                .insert({
                    description: expenseDescription,
                    amount: Number(expenseAmount),
                    category: expenseCategory,
                    user_id: user?.id
                });

            if (error) throw error;

            toast.success('Gasto registrado');
            setExpenseDescription('');
            setExpenseAmount('');
            setExpenseCategory('other');
            setShowExpenseForm(false);
            fetchExpenses();
        } catch (error) {
            console.error('Error saving expense:', error);
            toast.error('Error al guardar gasto');
        } finally {
            setSavingExpense(false);
        }
    };

    const pendingTotal = useMemo(() =>
        pendingPayments.reduce((acc, p) => acc + Number(p.amount), 0),
        [pendingPayments]
    );

    return (
        <MainLayout>
            <div className="flex flex-col gap-6 animate-fade-in">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight flex items-center gap-3">
                        <Receipt className="h-8 w-8 text-ios-blue" />
                        Caja y Cobros
                    </h1>
                    <p className="text-ios-gray-500 mt-1 font-medium">
                        Gestiona cobros pendientes, gastos y movimientos del día
                    </p>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="ios-card p-5 bg-gradient-to-br from-ios-orange/10 to-amber-500/5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-lg bg-amber-500/10">
                                <Clock className="h-5 w-5 text-amber-600" />
                            </div>
                            <span className="text-sm font-semibold text-amber-700/80">Pendientes de Cobro</span>
                        </div>
                        <p className="text-2xl font-bold text-amber-900">${pendingTotal.toLocaleString()}</p>
                        <p className="text-xs text-amber-600 mt-1">{pendingPayments.length} cobros</p>
                    </div>

                    <div className="ios-card p-5 bg-gradient-to-br from-ios-green/10 to-emerald-500/5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-lg bg-emerald-500/10">
                                <ArrowUpRight className="h-5 w-5 text-emerald-600" />
                            </div>
                            <span className="text-sm font-semibold text-emerald-700/80">Cobrado Hoy</span>
                        </div>
                        <p className="text-2xl font-bold text-emerald-900">${todayCollected.toLocaleString()}</p>
                    </div>

                    <div className="ios-card p-5 bg-gradient-to-br from-ios-red/10 to-rose-500/5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-lg bg-rose-500/10">
                                <ArrowDownRight className="h-5 w-5 text-rose-600" />
                            </div>
                            <span className="text-sm font-semibold text-rose-700/80">Gastos Hoy</span>
                        </div>
                        <p className="text-2xl font-bold text-rose-900">${todayExpenses.toLocaleString()}</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 p-1 bg-ios-gray-100 rounded-xl w-fit">
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={cn(
                            "px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                            activeTab === 'pending'
                                ? "bg-white text-ios-gray-900 shadow-sm"
                                : "text-ios-gray-500 hover:text-ios-gray-700"
                        )}
                    >
                        <DollarSign className="h-4 w-4 inline mr-2" />
                        Cobros Pendientes
                        {pendingPayments.length > 0 && (
                            <span className="ml-2 px-2 py-0.5 text-xs bg-ios-orange text-white rounded-full">
                                {pendingPayments.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('expenses')}
                        className={cn(
                            "px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                            activeTab === 'expenses'
                                ? "bg-white text-ios-gray-900 shadow-sm"
                                : "text-ios-gray-500 hover:text-ios-gray-700"
                        )}
                    >
                        <TrendingDown className="h-4 w-4 inline mr-2" />
                        Gastos
                    </button>
                    <button
                        onClick={() => setActiveTab('today')}
                        className={cn(
                            "px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                            activeTab === 'today'
                                ? "bg-white text-ios-gray-900 shadow-sm"
                                : "text-ios-gray-500 hover:text-ios-gray-700"
                        )}
                    >
                        <Calendar className="h-4 w-4 inline mr-2" />
                        Resumen del Día
                    </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'pending' && (
                    <div className="space-y-4">
                        {/* Payment Method Selector */}
                        <div className="ios-card p-4">
                            <Label className="text-sm font-medium text-ios-gray-600 mb-2 block">Método de Pago</Label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setSelectedPaymentMethod('cash')}
                                    className={cn(
                                        "flex-1 h-12 rounded-xl flex items-center justify-center gap-2 font-medium transition-all",
                                        selectedPaymentMethod === 'cash'
                                            ? "bg-ios-green text-white"
                                            : "bg-ios-gray-100 text-ios-gray-700 hover:bg-ios-gray-200"
                                    )}
                                >
                                    <Banknote className="h-5 w-5" />
                                    Efectivo
                                </button>
                                <button
                                    onClick={() => setSelectedPaymentMethod('card')}
                                    className={cn(
                                        "flex-1 h-12 rounded-xl flex items-center justify-center gap-2 font-medium transition-all",
                                        selectedPaymentMethod === 'card'
                                            ? "bg-ios-blue text-white"
                                            : "bg-ios-gray-100 text-ios-gray-700 hover:bg-ios-gray-200"
                                    )}
                                >
                                    <CreditCard className="h-5 w-5" />
                                    Tarjeta
                                </button>
                                <button
                                    onClick={() => setSelectedPaymentMethod('transfer')}
                                    className={cn(
                                        "flex-1 h-12 rounded-xl flex items-center justify-center gap-2 font-medium transition-all",
                                        selectedPaymentMethod === 'transfer'
                                            ? "bg-ios-purple text-white"
                                            : "bg-ios-gray-100 text-ios-gray-700 hover:bg-ios-gray-200"
                                    )}
                                >
                                    <ArrowUpRight className="h-5 w-5" />
                                    Transferencia
                                </button>
                            </div>
                        </div>

                        {/* Pending Payments List */}
                        {loadingPayments ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-ios-blue" />
                            </div>
                        ) : pendingPayments.length > 0 ? (
                            <div className="space-y-3">
                                {pendingPayments.map((payment) => (
                                    <div
                                        key={payment.id}
                                        className="ios-card p-5 flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-xl bg-ios-blue/10 flex items-center justify-center">
                                                <User className="h-6 w-6 text-ios-blue" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-ios-gray-900">
                                                    {payment.patients?.first_name} {payment.patients?.last_name}
                                                </p>
                                                <p className="text-sm text-ios-gray-500">
                                                    {payment.appointments?.title || 'Consulta'}
                                                </p>
                                                <p className="text-xs text-ios-gray-400">
                                                    {format(new Date(payment.created_at), "d MMM, HH:mm", { locale: es })}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <p className="text-2xl font-bold text-ios-gray-900">
                                                ${Number(payment.amount).toLocaleString()}
                                            </p>
                                            <button
                                                onClick={() => handleCollectPayment(payment)}
                                                disabled={processingPayment === payment.id}
                                                className="h-12 px-6 rounded-xl bg-ios-green text-white font-semibold flex items-center gap-2 hover:bg-ios-green/90 transition-colors disabled:opacity-50"
                                            >
                                                {processingPayment === payment.id ? (
                                                    <Loader2 className="h-5 w-5 animate-spin" />
                                                ) : (
                                                    <>
                                                        <CheckCircle className="h-5 w-5" />
                                                        Cobrar
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="ios-card p-12 text-center">
                                <div className="h-16 w-16 rounded-full bg-ios-green/10 flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle className="h-8 w-8 text-ios-green" />
                                </div>
                                <p className="text-ios-gray-900 font-semibold">¡Todo cobrado!</p>
                                <p className="text-ios-gray-500 text-sm mt-1">No hay cobros pendientes</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'expenses' && (
                    <div className="space-y-4">
                        {/* Add Expense Button */}
                        <button
                            onClick={() => setShowExpenseForm(true)}
                            className="ios-card p-4 w-full flex items-center justify-center gap-2 text-ios-blue font-semibold hover:bg-ios-gray-50 transition-colors"
                        >
                            <Plus className="h-5 w-5" />
                            Registrar Gasto
                        </button>

                        {/* Expense Form Modal */}
                        {showExpenseForm && (
                            <div className="ios-card p-6 border-2 border-ios-blue animate-scale-in">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-ios-gray-900">Nuevo Gasto</h3>
                                    <button
                                        onClick={() => setShowExpenseForm(false)}
                                        className="p-2 hover:bg-ios-gray-100 rounded-xl"
                                    >
                                        <X className="h-5 w-5 text-ios-gray-500" />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <Label className="text-sm font-medium text-ios-gray-600 mb-2 block">Descripción</Label>
                                        <input
                                            value={expenseDescription}
                                            onChange={(e) => setExpenseDescription(e.target.value)}
                                            className="ios-input"
                                            placeholder="Ej: Compra de insumos..."
                                        />
                                    </div>

                                    <div>
                                        <Label className="text-sm font-medium text-ios-gray-600 mb-2 block">Monto ($)</Label>
                                        <input
                                            type="number"
                                            value={expenseAmount}
                                            onChange={(e) => setExpenseAmount(e.target.value)}
                                            className="ios-input text-xl font-bold"
                                            placeholder="0.00"
                                        />
                                    </div>

                                    <div>
                                        <Label className="text-sm font-medium text-ios-gray-600 mb-2 block">Categoría</Label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {EXPENSE_CATEGORIES.map((cat) => (
                                                <button
                                                    key={cat.value}
                                                    onClick={() => setExpenseCategory(cat.value)}
                                                    className={cn(
                                                        "p-3 rounded-xl text-center transition-all",
                                                        expenseCategory === cat.value
                                                            ? "bg-ios-blue text-white"
                                                            : "bg-ios-gray-100 hover:bg-ios-gray-200"
                                                    )}
                                                >
                                                    <span className="text-lg">{cat.icon}</span>
                                                    <p className="text-xs font-medium mt-1">{cat.label}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleSaveExpense}
                                        disabled={savingExpense}
                                        className="w-full h-12 rounded-xl bg-ios-red text-white font-semibold flex items-center justify-center gap-2 hover:bg-ios-red/90 transition-colors disabled:opacity-50"
                                    >
                                        {savingExpense ? (
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        ) : (
                                            <>
                                                <Save className="h-5 w-5" />
                                                Registrar Gasto
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Expenses List */}
                        {loadingExpenses ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-ios-blue" />
                            </div>
                        ) : expenses.length > 0 ? (
                            <div className="space-y-3">
                                {expenses.map((expense) => {
                                    const category = EXPENSE_CATEGORIES.find(c => c.value === expense.category);
                                    return (
                                        <div
                                            key={expense.id}
                                            className="ios-card p-4 flex items-center justify-between"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-xl bg-ios-gray-100 flex items-center justify-center text-lg">
                                                    {category?.icon || '📦'}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-ios-gray-900">{expense.description}</p>
                                                    <p className="text-xs text-ios-gray-500">
                                                        {category?.label} • {format(new Date(expense.created_at), "HH:mm", { locale: es })}
                                                    </p>
                                                </div>
                                            </div>
                                            <p className="text-lg font-bold text-ios-red">
                                                -${Number(expense.amount).toLocaleString()}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="ios-card p-12 text-center">
                                <div className="h-16 w-16 rounded-full bg-ios-gray-100 flex items-center justify-center mx-auto mb-4">
                                    <TrendingDown className="h-8 w-8 text-ios-gray-400" />
                                </div>
                                <p className="text-ios-gray-900 font-semibold">Sin gastos hoy</p>
                                <p className="text-ios-gray-500 text-sm mt-1">Registra un gasto para verlo aquí</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'today' && (
                    <div className="space-y-4">
                        {/* Today Net */}
                        <div className="ios-card p-6 text-center">
                            <p className="text-sm text-ios-gray-500 mb-2">Balance del Día</p>
                            <p className={cn(
                                "text-4xl font-bold",
                                todayCollected - todayExpenses >= 0 ? "text-ios-green" : "text-ios-red"
                            )}>
                                ${(todayCollected - todayExpenses).toLocaleString()}
                            </p>
                            <div className="flex justify-center gap-6 mt-4 text-sm">
                                <div>
                                    <span className="text-ios-green font-semibold">+${todayCollected.toLocaleString()}</span>
                                    <span className="text-ios-gray-500 ml-1">cobrado</span>
                                </div>
                                <div>
                                    <span className="text-ios-red font-semibold">-${todayExpenses.toLocaleString()}</span>
                                    <span className="text-ios-gray-500 ml-1">gastos</span>
                                </div>
                            </div>
                        </div>

                        {/* Today Payments */}
                        <h3 className="text-lg font-bold text-ios-gray-900">Cobros del Día</h3>
                        {todayPayments.length > 0 ? (
                            <div className="space-y-2">
                                {todayPayments.map((payment) => (
                                    <div
                                        key={payment.id}
                                        className="ios-card p-4 flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "h-10 w-10 rounded-xl flex items-center justify-center",
                                                payment.payment_method === 'cash' ? "bg-ios-green/10" :
                                                    payment.payment_method === 'card' ? "bg-ios-blue/10" : "bg-ios-purple/10"
                                            )}>
                                                {payment.payment_method === 'cash' ? (
                                                    <Banknote className="h-5 w-5 text-ios-green" />
                                                ) : payment.payment_method === 'card' ? (
                                                    <CreditCard className="h-5 w-5 text-ios-blue" />
                                                ) : (
                                                    <ArrowUpRight className="h-5 w-5 text-ios-purple" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-medium text-ios-gray-900">
                                                    {payment.patients?.first_name} {payment.patients?.last_name}
                                                </p>
                                                <p className="text-xs text-ios-gray-500">
                                                    {payment.appointments?.title} • {format(new Date(payment.created_at), "HH:mm", { locale: es })}
                                                </p>
                                            </div>
                                        </div>
                                        <p className="text-lg font-bold text-ios-green">
                                            +${Number(payment.amount).toLocaleString()}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="ios-card p-8 text-center text-ios-gray-500">
                                No hay cobros registrados hoy
                            </div>
                        )}
                    </div>
                )}
            </div>
        </MainLayout>
    );
};

export default ReceptionFinance;
