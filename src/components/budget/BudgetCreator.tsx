import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Save, Printer, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { BudgetItem, CreateBudgetDTO } from '@/types/budget';

interface Treatment {
    id: string;
    name: string;
    base_price: number;
}

interface Doctor {
    id: string;
    first_name: string;
    last_name: string;
    color_code: string;
}

interface BudgetCreatorProps {
    patientId: string;
    onBudgetCreated: () => void;
}

const BudgetCreator: React.FC<BudgetCreatorProps> = ({ patientId, onBudgetCreated }) => {
    // State
    const [treatments, setTreatments] = useState<Treatment[]>([]);
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [items, setItems] = useState<BudgetItem[]>([]);

    // Selection State
    const [selectedTreatmentId, setSelectedTreatmentId] = useState('');
    const [selectedTooth, setSelectedTooth] = useState('');
    const [selectedPrice, setSelectedPrice] = useState<number>(0);

    // Form State
    const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
    const [sessionsCount, setSessionsCount] = useState(1);
    const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
    const [discountValue, setDiscountValue] = useState(0);
    const [notes, setNotes] = useState('');
    const [paymentTerms, setPaymentTerms] = useState('cash');
    const [isSaving, setIsSaving] = useState(false);

    // Fetch Data
    useEffect(() => {
        const fetchBasicData = async () => {
            const { data: tData } = await supabase.from('treatments').select('id, name, base_price').eq('is_active', true).order('name');
            if (tData) setTreatments(tData);

            const { data: dData } = await supabase.from('doctors').select('id, first_name, last_name, color_code').eq('is_active', true);
            if (dData) setDoctors(dData);
        };
        fetchBasicData();
    }, []);

    // Update price when treatment changes
    useEffect(() => {
        if (selectedTreatmentId) {
            const t = treatments.find(tr => tr.id === selectedTreatmentId);
            if (t) setSelectedPrice(t.base_price);
        }
    }, [selectedTreatmentId, treatments]);

    // Calculations
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const discountAmount = discountType === 'percent'
        ? subtotal * (discountValue / 100)
        : discountValue;

    const finalTotal = subtotal - discountAmount;

    // Handlers
    const handleAddItem = () => {
        if (!selectedTreatmentId) return;

        const treatment = treatments.find(t => t.id === selectedTreatmentId);
        if (!treatment) return;

        const newItem: BudgetItem = {
            treatment_id: selectedTreatmentId,
            treatment_name: treatment.name,
            tooth_number: selectedTooth,
            price: selectedPrice,
            quantity: 1
        };

        setItems([...items, newItem]);

        // Reset selection (keep tooth maybe?)
        setSelectedTreatmentId('');
        setSelectedPrice(0);
    };

    const handleRemoveItem = (index: number) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    const handleSave = async (status: 'draft' | 'accepted' = 'draft') => {
        if (items.length === 0) {
            toast.error('Agrega al menos un tratamiento');
            return;
        }
        if (!selectedDoctorId) {
            toast.error('Selecciona un doctor');
            return;
        }

        try {
            setIsSaving(true);

            const budgetData: CreateBudgetDTO = {
                patient_id: patientId,
                doctor_id: selectedDoctorId,
                total_amount: subtotal,
                discount_amount: discountAmount,
                discount_percentage: discountType === 'percent' ? discountValue : 0,
                final_total: finalTotal,
                sessions_count: sessionsCount,
                notes: notes,
                payment_terms: paymentTerms,
                status: status,
                items: items
            };

            // 1. Create Budget
            const { data: budget, error: budgetError } = await supabase
                .from('budgets')
                .insert({
                    ...budgetData,
                    items: undefined // Remove items from top level insert
                })
                .select()
                .single();

            if (budgetError) throw budgetError;

            // 2. Create Create Items
            const itemsToInsert = items.map(item => ({
                budget_id: budget.id,
                treatment_id: item.treatment_id,
                tooth_number: item.tooth_number,
                price: item.price,
                quantity: item.quantity
            }));

            const { error: itemsError } = await supabase
                .from('budget_items')
                .insert(itemsToInsert);

            if (itemsError) throw itemsError;

            // 3. If Accepted, Consolidate Logic (Future Step: Extract to separate function)
            if (status === 'accepted') {
                await consolidateBudget(budget.id, budgetData);
            }

            toast.success(status === 'accepted' ? 'Presupuesto consolidado correctamente' : 'Presupuesto guardado');
            onBudgetCreated();

            // Reset form
            setItems([]);
            setNotes('');
            setDiscountValue(0);

        } catch (error) {
            console.error('Error saving budget:', error);
            toast.error('Error al guardar presupuesto');
        } finally {
            setIsSaving(false);
        }
    };

    const consolidateBudget = async (budgetId: string, data: CreateBudgetDTO) => {
        // 1. Create Clinical Note
        const doctor = doctors.find(d => d.id === selectedDoctorId);
        const doctorName = doctor ? `${doctor.first_name} ${doctor.last_name}` : 'Unknown';

        // Format treatments for note
        const treatmentsList = data.items.map(i =>
            `- ${i.treatment_name} ${i.tooth_number ? `(OD ${i.tooth_number})` : ''}: $${i.price}`
        ).join('\n');

        const noteContent = `
PRESUPUESTO ACEPTADO
Doctor: ${doctorName}
Plan de pagos: ${data.payment_terms}
Sesiones estimadas: ${data.sessions_count}

TRATAMIENTOS:
${treatmentsList}

Total: $${data.final_total}
Notas: ${data.notes}
    `.trim();

        await supabase.from('clinical_notes').insert({
            patient_id: data.patient_id,
            doctor_id: data.doctor_id,
            doctor_name: doctorName,
            note: noteContent,
            role: 'System'
        });

        // 2. Create Pending Payment (Full Amount for now, will enhance later to split Advance/Balance)
        // Note: User request asked for "anticipo" logic. Ideally we pop a modal here. 
        // For MVP/First Pass: We create one pending payment for the whole amount.
        // The user can pay it partially in reception.

        await supabase.from('payments').insert({
            patient_id: data.patient_id,
            amount: data.final_total,
            status: 'pending',
            appointment_id: null, // No appointment yet
            // We might need a 'budget_id' column in payments or just use notes
        });
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Left: Item Creator */}
                <div className="md:col-span-8 space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Agregar Tratamientos</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-4 items-end">
                                <div className="w-24">
                                    <span className="text-xs font-medium mb-1 block">Pieza</span>
                                    <Input
                                        value={selectedTooth}
                                        onChange={(e) => setSelectedTooth(e.target.value)}
                                        placeholder="#"
                                    />
                                </div>
                                <div className="flex-1">
                                    <span className="text-xs font-medium mb-1 block">Tratamiento</span>
                                    <Select value={selectedTreatmentId} onValueChange={setSelectedTreatmentId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {treatments.map(t => (
                                                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-32">
                                    <span className="text-xs font-medium mb-1 block">Precio</span>
                                    <Input
                                        type="number"
                                        value={selectedPrice}
                                        onChange={(e) => setSelectedPrice(Number(e.target.value))}
                                    />
                                </div>
                                <Button onClick={handleAddItem} disabled={!selectedTreatmentId}>
                                    <Plus className="mr-2 h-4 w-4" /> Agregar
                                </Button>
                            </div>

                            <div className="border rounded-md mt-4">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Pieza</TableHead>
                                            <TableHead>Tratamiento</TableHead>
                                            <TableHead className="text-right">Precio</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                                                    No hay items agregados
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            items.map((item, idx) => (
                                                <TableRow key={idx}>
                                                    <TableCell>{item.tooth_number || '-'}</TableCell>
                                                    <TableCell>{item.treatment_name}</TableCell>
                                                    <TableCell className="text-right">${item.price.toLocaleString()}</TableCell>
                                                    <TableCell>
                                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(idx)}>
                                                            <Trash2 className="h-4 w-4 text-red-500" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right: Summary & Actions */}
                <div className="md:col-span-4 space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Resumen del Plan</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <span className="text-xs font-medium mb-1 block">Doctor Responsable</span>
                                <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar Doctor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {doctors.map(d => (
                                            <SelectItem key={d.id} value={d.id}>
                                                {d.first_name} {d.last_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <span className="text-xs font-medium mb-1 block">Sesiones Estimadas</span>
                                <Select value={String(sessionsCount)} onValueChange={(v) => setSessionsCount(Number(v))}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 18, 24].map(n => (
                                            <SelectItem key={n} value={String(n)}>{n} sesiones</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <span className="text-xs font-medium mb-1 block">Descuento</span>
                                <div className="flex gap-2">
                                    <Select value={discountType} onValueChange={(v: any) => setDiscountType(v)}>
                                        <SelectTrigger className="w-24">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="percent">%</SelectItem>
                                            <SelectItem value="amount">$</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Input
                                        type="number"
                                        value={discountValue}
                                        onChange={(e) => setDiscountValue(Number(e.target.value))}
                                        className="flex-1"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 border-t space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Subtotal:</span>
                                    <span>${subtotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-green-600">
                                    <span>Descuento:</span>
                                    <span>-${discountAmount.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between font-bold text-xl pt-2 border-t mt-2">
                                    <span>Total:</span>
                                    <span>${finalTotal.toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="pt-4 space-y-2">
                                <Button
                                    className="w-full bg-slate-800 hover:bg-slate-900"
                                    onClick={() => handleSave('draft')}
                                    disabled={isSaving}
                                >
                                    <Save className="mr-2 h-4 w-4" /> Guardar Borrador
                                </Button>

                                <Button
                                    variant="outline"
                                    className="w-full border-green-600 text-green-600 hover:bg-green-50"
                                    onClick={() => handleSave('accepted')}
                                    disabled={isSaving}
                                >
                                    <CheckCircle className="mr-2 h-4 w-4" /> Consolidar y Cobrar
                                </Button>
                            </div>

                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default BudgetCreator;
