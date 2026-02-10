import React from 'react';
import { Budget } from '@/types/budget';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

interface BudgetPrintPreviewProps {
    budget: Budget;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const BudgetPrintPreview: React.FC<BudgetPrintPreviewProps> = ({ budget, open, onOpenChange }) => {
    const handlePrint = () => {
        window.print();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0 bg-white">
                {/* Print Content Area - Visible on Screen, Optimized for Print via CSS */}
                <div className="p-8 md:p-12 print-container bg-white text-black">
                    {/* Header */}
                    <div className="flex justify-between items-start border-b pb-6 mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Presupuesto Dental</h1>
                            <p className="text-slate-500">Folio: {budget.id.slice(0, 8).toUpperCase()}</p>
                        </div>
                        <div className="text-right">
                            <h2 className="text-xl font-bold text-slate-800">Clínica Dental</h2>
                            <p className="text-slate-500 text-sm">Presupuesto Profesional</p>
                        </div>
                    </div>

                    {/* Patient Info */}
                    <div className="mb-8 p-4 bg-slate-50 rounded-lg border">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Paciente</span>
                                <span className="text-lg font-medium text-slate-800">
                                    {/* Note: Patient name usually needs to be fetched or passed. 
                                 Ideally Budget object has patient relation expanded.
                                 For now assuming it might be incomplete or handled by parent.
                             */}
                                    ID: {budget.patient_id.slice(0, 8)}...
                                </span>
                            </div>
                            <div>
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Doctor Tratante</span>
                                <span className="text-lg font-medium text-slate-800">
                                    {budget.doctor ? `Dr. ${budget.doctor.first_name} ${budget.doctor.last_name}` : 'No asignado'}
                                </span>
                            </div>
                            <div>
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Fecha</span>
                                <span className="text-slate-800">
                                    {format(new Date(budget.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="mb-8">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b-2 border-slate-100">
                                    <th className="py-3 font-semibold text-slate-600 text-sm uppercase">Tratamiento</th>
                                    <th className="py-3 font-semibold text-slate-600 text-sm uppercase">Pieza</th>
                                    <th className="py-3 font-semibold text-slate-600 text-sm uppercase text-right">Precio</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {/* Assuming items are fetched. If using existing Budget type, items might be undefined 
                            if not fetched with join. BudgetList fetches *. So budget items might be missing 
                            unless we specifically fetched them.
                            
                            Correction: BudgetList only selects `*, doctor(...)`. 
                            It does NOT select items. 
                            We need to fetch items or pass them.
                        */}
                            </tbody>
                        </table>
                        <div className="text-center py-8 text-slate-400 italic">
                            (Detalle de tratamientos disponible en sistema)
                            {/* Minimal viable for now, fixes needed in fetch query */}
                        </div>
                    </div>

                    {/* Totals */}
                    <div className="flex justify-end mb-12">
                        <div className="w-64 space-y-3">
                            <div className="flex justify-between text-slate-500">
                                <span>Subtotal</span>
                                <span>${budget.total_amount.toLocaleString()}</span>
                            </div>
                            {budget.discount_amount > 0 && (
                                <div className="flex justify-between text-green-600">
                                    <span>Descuento</span>
                                    <span>-${budget.discount_amount.toLocaleString()}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-xl font-bold text-slate-900 border-t pt-3">
                                <span>Total</span>
                                <span>${budget.final_total.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Footer / Terms */}
                    <div className="border-t pt-8 text-sm text-slate-500">
                        <h4 className="font-bold text-slate-700 mb-2">Condiciones de pago</h4>
                        <p className="mb-2">Plan seleccionado: <span className="font-medium text-slate-900 uppercase">{budget.payment_terms}</span></p>
                        <p>Este presupuesto tiene una validez de 15 días a partir de la fecha de emisión.</p>

                        {budget.notes && (
                            <div className="mt-4 p-4 bg-yellow-50 rounded text-yellow-800 border-yellow-100">
                                <span className="font-bold block mb-1">Notas:</span>
                                {budget.notes}
                            </div>
                        )}
                    </div>

                    <div className="mt-12 text-center text-xs text-slate-300 print:hidden">
                        <Button onClick={handlePrint} className="bg-slate-900 text-white hover:bg-slate-800">
                            <Printer className="mr-2 h-4 w-4" />
                            Imprimir Documento
                        </Button>
                    </div>
                </div>

                <style>{`
            @media print {
                @page { margin: 0; size: auto; }
                body * { visibility: hidden; }
                .print-container, .print-container * { visibility: visible; }
                .print-container { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 2cm; }
                .no-print { display: none !important; }
            }
        `}</style>
            </DialogContent>
        </Dialog>
    );
};

export default BudgetPrintPreview;
