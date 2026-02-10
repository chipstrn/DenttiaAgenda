"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Search,
    FileText,
    Check,
    Loader2,
    Calendar,
    User,
    DollarSign,
    Printer,
    Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

interface Budget {
    id: string;
    patient_id: string;
    doctor_id: string;
    total_amount: number;
    discount_amount: number;
    total: number;
    payment_terms: string;
    status: string;
    created_at: string;
    patients?: {
        first_name: string;
        last_name: string;
    };
    doctors?: {
        full_name: string;
    };
}

interface BudgetItem {
    id: string;
    treatment_id: string;
    tooth_number: number | null;
    unit_price: number;
    quantity: number;
    treatments?: {
        name: string;
    };
}

const BudgetSearch = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [loading, setLoading] = useState(true);
    const [activating, setActivating] = useState<string | null>(null);
    const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
    const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        fetchBudgets();
    }, [statusFilter]);

    const fetchBudgets = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('budgets')
                .select(`
          *,
          patients:patient_id (first_name, last_name),
          doctors:doctor_id (full_name)
        `)
                .order('created_at', { ascending: false });

            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }

            const { data, error } = await query;
            if (error) throw error;
            setBudgets(data || []);
        } catch (error) {
            console.error('Error fetching budgets:', error);
            toast.error('Error al cargar presupuestos');
        } finally {
            setLoading(false);
        }
    };

    const fetchBudgetItems = async (budgetId: string) => {
        try {
            const { data, error } = await supabase
                .from('budget_items')
                .select(`
          *,
          treatments:treatment_id (name)
        `)
                .eq('budget_id', budgetId);

            if (error) throw error;
            setBudgetItems(data || []);
        } catch (error) {
            console.error('Error fetching budget items:', error);
        }
    };

    const handleViewDetails = async (budget: Budget) => {
        setSelectedBudget(budget);
        await fetchBudgetItems(budget.id);
        setShowDetails(true);
    };

    const handleActivateBudget = async (budget: Budget) => {
        setActivating(budget.id);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user');

            // Fetch items for this budget
            const { data: items } = await supabase
                .from('budget_items')
                .select('*, treatments:treatment_id (name)')
                .eq('budget_id', budget.id);

            const treatmentsList = items?.map(i =>
                `- ${i.treatments?.name || 'Tratamiento'} (OD ${i.tooth_number || 'N/A'}): $${i.unit_price}`
            ).join('\n') || '';

            const noteContent = `
PRESUPUESTO ACEPTADO
Doctor: ${budget.doctors?.full_name || 'N/A'}
Plan de pagos: ${budget.payment_terms}

TRATAMIENTOS:
${treatmentsList}

Total: $${budget.total}
      `.trim();

            // Create clinical note
            await supabase.from('clinical_notes').insert({
                patient_id: budget.patient_id,
                user_id: user.id,
                note: noteContent,
                note_date: new Date().toISOString()
            });

            // Create pending payment
            await supabase.from('payments').insert({
                patient_id: budget.patient_id,
                amount: budget.total,
                status: 'pending',
                appointment_id: null
            });

            // Update budget status
            await supabase
                .from('budgets')
                .update({ status: 'accepted' })
                .eq('id', budget.id);

            toast.success('Presupuesto activado. Nota de evolución creada y pago registrado.');
            fetchBudgets();
        } catch (error) {
            console.error('Error activating budget:', error);
            toast.error('Error al activar presupuesto');
        } finally {
            setActivating(null);
        }
    };

    const filteredBudgets = budgets.filter(b => {
        if (!searchTerm) return true;
        const patientName = `${b.patients?.first_name} ${b.patients?.last_name}`.toLowerCase();
        return patientName.includes(searchTerm.toLowerCase());
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'draft':
                return <span className="px-2 py-1 text-xs rounded-full bg-ios-gray-200 text-ios-gray-600">Borrador</span>;
            case 'accepted':
                return <span className="px-2 py-1 text-xs rounded-full bg-ios-green/20 text-ios-green">Aceptado</span>;
            case 'expired':
                return <span className="px-2 py-1 text-xs rounded-full bg-ios-red/20 text-ios-red">Expirado</span>;
            default:
                return <span className="px-2 py-1 text-xs rounded-full bg-ios-gray-200 text-ios-gray-600">{status}</span>;
        }
    };

    const getPaymentTermsLabel = (terms: string) => {
        switch (terms) {
            case 'cash': return 'Contado';
            case '3_months': return '3 Meses';
            case '6_months': return '6 Meses';
            case '12_months': return '12 Meses';
            default: return terms;
        }
    };

    return (
        <MainLayout>
            <div className="p-4 md:p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-ios-gray-900">Presupuestos</h1>
                        <p className="text-ios-gray-500 text-sm">Buscar y gestionar planes de tratamiento</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ios-gray-400" />
                        <Input
                            placeholder="Buscar por nombre de paciente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 ios-input"
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="ios-input w-full md:w-48">
                            <SelectValue placeholder="Filtrar por estado" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="draft">Borradores</SelectItem>
                            <SelectItem value="accepted">Aceptados</SelectItem>
                            <SelectItem value="expired">Expirados</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Budget List */}
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-ios-blue" />
                    </div>
                ) : filteredBudgets.length === 0 ? (
                    <div className="text-center py-12 text-ios-gray-400">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No se encontraron presupuestos</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredBudgets.map(budget => (
                            <div
                                key={budget.id}
                                className="bg-white rounded-2xl border border-ios-gray-200 p-4 hover:shadow-ios-md transition-shadow"
                            >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <User className="h-5 w-5 text-ios-blue" />
                                            <span className="font-semibold text-ios-gray-900">
                                                {budget.patients?.first_name} {budget.patients?.last_name}
                                            </span>
                                            {getStatusBadge(budget.status)}
                                        </div>
                                        <div className="flex flex-wrap gap-4 text-sm text-ios-gray-500">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="h-4 w-4" />
                                                {format(new Date(budget.created_at), 'dd MMM yyyy', { locale: es })}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <User className="h-4 w-4" />
                                                {budget.doctors?.full_name || 'Sin doctor'}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <DollarSign className="h-4 w-4" />
                                                ${budget.total?.toLocaleString() || 0}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleViewDetails(budget)}
                                            className="rounded-xl"
                                        >
                                            <Eye className="h-4 w-4 mr-1" />
                                            Ver
                                        </Button>

                                        {budget.status === 'draft' && (
                                            <Button
                                                size="sm"
                                                onClick={() => handleActivateBudget(budget)}
                                                disabled={activating === budget.id}
                                                className="rounded-xl bg-ios-green hover:bg-ios-green/90"
                                            >
                                                {activating === budget.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                                ) : (
                                                    <Check className="h-4 w-4 mr-1" />
                                                )}
                                                Activar
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Details Dialog */}
                <Dialog open={showDetails} onOpenChange={setShowDetails}>
                    <DialogContent className="max-w-2xl rounded-3xl">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5 text-ios-blue" />
                                Detalle del Presupuesto
                            </DialogTitle>
                        </DialogHeader>

                        {selectedBudget && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-ios-gray-500">Paciente:</span>
                                        <p className="font-semibold">
                                            {selectedBudget.patients?.first_name} {selectedBudget.patients?.last_name}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-ios-gray-500">Doctor:</span>
                                        <p className="font-semibold">{selectedBudget.doctors?.full_name}</p>
                                    </div>
                                    <div>
                                        <span className="text-ios-gray-500">Fecha:</span>
                                        <p className="font-semibold">
                                            {format(new Date(selectedBudget.created_at), 'dd MMM yyyy', { locale: es })}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-ios-gray-500">Plan de Pago:</span>
                                        <p className="font-semibold">{getPaymentTermsLabel(selectedBudget.payment_terms)}</p>
                                    </div>
                                </div>

                                <div className="border-t border-ios-gray-200 pt-4">
                                    <h4 className="font-semibold mb-3">Tratamientos</h4>
                                    <div className="space-y-2">
                                        {budgetItems.map(item => (
                                            <div key={item.id} className="flex justify-between items-center p-3 bg-ios-gray-50 rounded-xl">
                                                <div>
                                                    <span className="font-medium">{item.treatments?.name || 'Tratamiento'}</span>
                                                    {item.tooth_number && (
                                                        <span className="text-ios-gray-500 text-sm ml-2">(OD {item.tooth_number})</span>
                                                    )}
                                                </div>
                                                <span className="font-semibold text-ios-green">${item.unit_price?.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="border-t border-ios-gray-200 pt-4 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-ios-gray-500">Subtotal</span>
                                        <span>${selectedBudget.total_amount?.toLocaleString()}</span>
                                    </div>
                                    {selectedBudget.discount_amount > 0 && (
                                        <div className="flex justify-between text-sm text-ios-red">
                                            <span>Descuento</span>
                                            <span>-${selectedBudget.discount_amount?.toLocaleString()}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-lg font-bold">
                                        <span>Total</span>
                                        <span className="text-ios-green">${selectedBudget.total?.toLocaleString()}</span>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => window.print()}
                                        className="flex-1 rounded-xl"
                                    >
                                        <Printer className="h-4 w-4 mr-2" />
                                        Imprimir
                                    </Button>
                                    {selectedBudget.status === 'draft' && (
                                        <Button
                                            onClick={() => {
                                                handleActivateBudget(selectedBudget);
                                                setShowDetails(false);
                                            }}
                                            disabled={activating === selectedBudget.id}
                                            className="flex-1 rounded-xl bg-ios-green hover:bg-ios-green/90"
                                        >
                                            <Check className="h-4 w-4 mr-2" />
                                            Generar Nota de Evolución
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </MainLayout>
    );
};

export default BudgetSearch;
