import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Search, DollarSign, Plus, CreditCard, Banknote, Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Patient {
    id: string;
    first_name: string;
    last_name: string;
}

interface Payment {
    id: string;
    amount: number;
    status: string;
    payment_method?: string;
    created_at: string;
    notes?: string;
}

const PatientPayments = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [patients, setPatients] = useState<Patient[]>([]);
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingPayments, setLoadingPayments] = useState(false);

    // Payment dialog state
    const [showPaymentDialog, setShowPaymentDialog] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [paymentNotes, setPaymentNotes] = useState('');
    const [savingPayment, setSavingPayment] = useState(false);
    const [paymentType, setPaymentType] = useState<'payment' | 'advance'>('payment');

    // Search patients
    useEffect(() => {
        const searchPatients = async () => {
            if (searchQuery.length < 2) {
                setPatients([]);
                return;
            }

            setLoading(true);
            const { data, error } = await supabase
                .from('patients')
                .select('id, first_name, last_name')
                .or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`)
                .limit(10);

            if (!error && data) {
                setPatients(data);
            }
            setLoading(false);
        };

        const debounce = setTimeout(searchPatients, 300);
        return () => clearTimeout(debounce);
    }, [searchQuery]);

    // Fetch payments when patient selected
    useEffect(() => {
        const fetchPayments = async () => {
            if (!selectedPatient) {
                setPayments([]);
                return;
            }

            setLoadingPayments(true);
            const { data, error } = await supabase
                .from('payments')
                .select('*')
                .eq('patient_id', selectedPatient.id)
                .order('created_at', { ascending: false });

            if (!error && data) {
                setPayments(data);
            }
            setLoadingPayments(false);
        };

        fetchPayments();
    }, [selectedPatient]);

    const selectPatient = (patient: Patient) => {
        setSelectedPatient(patient);
        setSearchQuery('');
        setPatients([]);
    };

    // Calculate balance
    const totalPending = payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);
    const totalPaid = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
    const balance = totalPending;

    const handleRegisterPayment = async () => {
        if (!selectedPatient || !paymentAmount) {
            toast.error('Ingresa un monto válido');
            return;
        }

        setSavingPayment(true);
        try {
            const amount = parseFloat(paymentAmount);

            if (paymentType === 'payment') {
                // Find oldest pending payment and mark as paid
                const pendingPayment = payments.find(p => p.status === 'pending');
                if (pendingPayment) {
                    const { error } = await supabase
                        .from('payments')
                        .update({
                            status: 'paid',
                            payment_method: paymentMethod,
                            notes: paymentNotes || null,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', pendingPayment.id);

                    if (error) throw error;
                }
            } else {
                // Create advance payment (negative amount or credit)
                const { error } = await supabase
                    .from('payments')
                    .insert({
                        patient_id: selectedPatient.id,
                        amount: amount,
                        status: 'paid',
                        payment_method: paymentMethod,
                        notes: `Anticipo: ${paymentNotes || 'Sin notas'}`
                    });

                if (error) throw error;
            }

            toast.success(paymentType === 'payment' ? 'Pago registrado' : 'Anticipo registrado');
            setShowPaymentDialog(false);
            setPaymentAmount('');
            setPaymentNotes('');

            // Refresh payments
            const { data } = await supabase
                .from('payments')
                .select('*')
                .eq('patient_id', selectedPatient.id)
                .order('created_at', { ascending: false });

            if (data) setPayments(data);

        } catch (error) {
            console.error('Error registering payment:', error);
            toast.error('Error al registrar pago');
        } finally {
            setSavingPayment(false);
        }
    };

    return (
        <MainLayout>
            <div className="mb-8 animate-fade-in">
                <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">Pagos de Pacientes</h1>
                <p className="text-ios-gray-500 mt-1">Gestiona abonos y anticipos</p>
            </div>

            {/* Search */}
            <Card className="mb-6">
                <CardContent className="pt-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ios-gray-400" />
                        <Input
                            placeholder="Buscar paciente por nombre..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />

                        {/* Search Results Dropdown */}
                        {patients.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border z-50">
                                {patients.map(patient => (
                                    <button
                                        key={patient.id}
                                        onClick={() => selectPatient(patient)}
                                        className="w-full text-left px-4 py-3 hover:bg-ios-gray-50 first:rounded-t-xl last:rounded-b-xl transition-colors"
                                    >
                                        {patient.first_name} {patient.last_name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Selected Patient Info */}
            {selectedPatient && (
                <div className="space-y-6 animate-fade-in">
                    {/* Patient Header */}
                    <Card className="border-l-4 border-l-ios-blue">
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span className="text-xl">{selectedPatient.first_name} {selectedPatient.last_name}</span>
                                <span className={`text-2xl font-bold ${balance > 0 ? 'text-ios-red' : 'text-ios-green'}`}>
                                    Saldo: ${balance.toLocaleString()}
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-3">
                                <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
                                    <DialogTrigger asChild>
                                        <Button
                                            onClick={() => setPaymentType('payment')}
                                            className="bg-ios-green hover:bg-ios-green/90"
                                        >
                                            <Banknote className="mr-2 h-4 w-4" />
                                            Registrar Pago
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="rounded-2xl">
                                        <DialogHeader>
                                            <DialogTitle>
                                                {paymentType === 'payment' ? 'Registrar Pago' : 'Registrar Anticipo'}
                                            </DialogTitle>
                                        </DialogHeader>
                                        <div className="space-y-4 pt-4">
                                            <div className="space-y-2">
                                                <Label>Monto</Label>
                                                <div className="relative">
                                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ios-gray-400" />
                                                    <Input
                                                        type="number"
                                                        value={paymentAmount}
                                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                                        className="pl-10"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label>Método de Pago</Label>
                                                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="cash">
                                                            <span className="flex items-center gap-2">
                                                                <Banknote className="h-4 w-4" /> Efectivo
                                                            </span>
                                                        </SelectItem>
                                                        <SelectItem value="card">
                                                            <span className="flex items-center gap-2">
                                                                <CreditCard className="h-4 w-4" /> Tarjeta
                                                            </span>
                                                        </SelectItem>
                                                        <SelectItem value="transfer">
                                                            <span className="flex items-center gap-2">
                                                                <Building2 className="h-4 w-4" /> Transferencia
                                                            </span>
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-2">
                                                <Label>Notas (opcional)</Label>
                                                <Input
                                                    value={paymentNotes}
                                                    onChange={(e) => setPaymentNotes(e.target.value)}
                                                    placeholder="Ej: Pago parcial"
                                                />
                                            </div>

                                            <Button
                                                onClick={handleRegisterPayment}
                                                disabled={savingPayment || !paymentAmount}
                                                className="w-full bg-ios-green hover:bg-ios-green/90"
                                            >
                                                {savingPayment ? (
                                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                ) : null}
                                                Confirmar
                                            </Button>
                                        </div>
                                    </DialogContent>
                                </Dialog>

                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setPaymentType('advance');
                                        setShowPaymentDialog(true);
                                    }}
                                    className="border-ios-blue text-ios-blue hover:bg-ios-blue/5"
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Registrar Anticipo
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Payments History */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Historial de Pagos</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loadingPayments ? (
                                <div className="text-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-ios-gray-400" />
                                </div>
                            ) : payments.length === 0 ? (
                                <div className="text-center py-8 text-ios-gray-400">
                                    No hay pagos registrados
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b text-left">
                                                <th className="pb-3 font-semibold text-ios-gray-600">Fecha</th>
                                                <th className="pb-3 font-semibold text-ios-gray-600 text-right">Monto</th>
                                                <th className="pb-3 font-semibold text-ios-gray-600 text-center">Estado</th>
                                                <th className="pb-3 font-semibold text-ios-gray-600">Método</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {payments.map(payment => (
                                                <tr key={payment.id} className="hover:bg-ios-gray-50">
                                                    <td className="py-4">
                                                        {format(new Date(payment.created_at), "d MMM yyyy", { locale: es })}
                                                    </td>
                                                    <td className="py-4 text-right font-bold">
                                                        ${payment.amount.toLocaleString()}
                                                    </td>
                                                    <td className="py-4 text-center">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${payment.status === 'paid'
                                                                ? 'bg-green-100 text-green-800'
                                                                : 'bg-yellow-100 text-yellow-800'
                                                            }`}>
                                                            {payment.status === 'paid' ? 'Pagado' : 'Pendiente'}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 capitalize">
                                                        {payment.payment_method === 'cash' ? 'Efectivo' :
                                                            payment.payment_method === 'card' ? 'Tarjeta' :
                                                                payment.payment_method === 'transfer' ? 'Transferencia' : '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {!selectedPatient && (
                <div className="text-center py-16 text-ios-gray-400">
                    <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">Busca un paciente para ver sus pagos</p>
                    <p className="text-sm mt-1">Escribe al menos 2 caracteres</p>
                </div>
            )}
        </MainLayout>
    );
};

export default PatientPayments;
