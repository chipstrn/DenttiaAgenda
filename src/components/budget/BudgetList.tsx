import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Budget } from '@/types/budget';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Printer, FileSignature } from 'lucide-react';
import { toast } from 'sonner';
import BudgetPrintPreview from './BudgetPrintPreview';
import { generateInformedConsentPDF } from '@/utils/pdfGenerator';

interface BudgetListProps {
    patientId: string;
    refreshTrigger: number;
}

const BudgetList: React.FC<BudgetListProps> = ({ patientId, refreshTrigger }) => {
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
    const [showPrint, setShowPrint] = useState(false);

    useEffect(() => {
        const fetchBudgets = async () => {
            try {
                setLoading(true);
                // We need items and treatment names for the print view
                const { data, error } = await supabase
                    .from('budgets')
                    .select(`
            *,
            doctor:doctors(first_name, last_name, color_code),
            patient:patients(first_name, last_name),
            items:budget_items(
              tooth_number,
              price,
              quantity,
              treatment:treatments(name)
            )
          `)
                    .eq('patient_id', patientId)
                    .order('created_at', { ascending: false });

                if (error) throw error;

                setBudgets(data as any || []);
            } catch (error) {
                console.error('Error fetching budgets:', error);
                toast.error('Error al cargar presupuestos');
            } finally {
                setLoading(false);
            }
        };

        if (patientId) {
            fetchBudgets();
        }
    }, [patientId, refreshTrigger]);

    const handlePrintClick = (budget: Budget) => {
        setSelectedBudget(budget);
        setShowPrint(true);
    };

    const handleConsentClick = (budget: Budget) => {
        if (!budget) return;

        // Construct procedure name from items
        const procedures = (budget.items || [])
            .map((item: any) => item.treatment?.name || item.description)
            .join(', ');

        const doctorName = (budget.doctor as any)?.first_name
            ? `${(budget.doctor as any).first_name} ${(budget.doctor as any).last_name}`
            : 'Denttia Clinic';

        const patientName = (budget as any).patient
            ? `${(budget as any).patient.first_name} ${(budget as any).patient.last_name}`
            : 'Paciente';

        generateInformedConsentPDF({
            patientName,
            doctorName,
            procedureName: procedures || 'Tratamiento Odontológico General',
            risks: '' // Use default generic risks
        });

        toast.success('Consentimiento Informado generado');
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'accepted': return 'bg-green-100 text-green-800 hover:bg-green-100 border-green-200';
            case 'rejected': return 'bg-red-100 text-red-800 hover:bg-red-100 border-red-200';
            case 'completed': return 'bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200';
            default: return 'bg-gray-100 text-gray-800 hover:bg-gray-100 border-gray-200';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'accepted': return 'Aceptado';
            case 'rejected': return 'Rechazado';
            case 'completed': return 'Completado';
            case 'draft': return 'Borrador';
            default: return status;
        }
    };

    if (loading) {
        return <div className="text-center py-8 text-muted-foreground"><span className="animate-pulse">Cargando presupuestos...</span></div>;
    }

    if (budgets.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground bg-slate-50/50 rounded-xl border border-dashed">
                <p>No hay presupuestos registrados para este paciente.</p>
                <p className="text-sm">Crea uno nuevo desde el panel izquierdo.</p>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-4">
                {budgets.map((budget) => (
                    <Card key={budget.id} className="overflow-hidden border-0 shadow-sm ring-1 ring-slate-100 bg-white hover:ring-slate-300 transition-all">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 gap-4">
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-xl text-slate-900">
                                        ${budget.final_total.toLocaleString()}
                                    </span>
                                    <Badge variant="secondary" className={getStatusColor(budget.status)}>
                                        {getStatusLabel(budget.status)}
                                    </Badge>
                                </div>
                                <div className="text-sm text-slate-500 font-medium flex items-center gap-2">
                                    <span>{format(new Date(budget.created_at), "d MMMM yyyy", { locale: es })}</span>
                                    {budget.doctor && (
                                        <>
                                            <span className="text-slate-300">•</span>
                                            <span className="flex items-center gap-1.5">
                                                <div
                                                    className="w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: (budget.doctor as any).color_code || '#ccc' }}
                                                />
                                                Dr. {budget.doctor.first_name}
                                            </span>
                                        </>
                                    )}
                                </div>
                                {budget.notes && (
                                    <div className="text-xs text-slate-400 max-w-md line-clamp-1 mt-1">
                                        "{budget.notes}"
                                    </div>
                                )}
                                <div className="text-xs text-slate-400 mt-1">
                                    {budget.items?.length || 0} tratamientos
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleConsentClick(budget)} className="h-9 hover:bg-slate-50 text-slate-600">
                                    <FileSignature className="mr-2 h-3.5 w-3.5" /> Consentimiento
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => handlePrintClick(budget)} className="h-9 hover:bg-slate-50">
                                    <Printer className="mr-2 h-3.5 w-3.5" /> Imprimir
                                </Button>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {selectedBudget && (
                <BudgetPrintPreview
                    budget={selectedBudget}
                    open={showPrint}
                    onOpenChange={setShowPrint}
                />
            )}
        </>
    );
};

export default BudgetList;
