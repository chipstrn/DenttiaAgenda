"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import Odontogram, { CONDITION_LABELS } from '@/components/dental/Odontogram';
import { Label } from '@/components/ui/label';
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
import { supabase } from '@/integrations/supabase/client';
import { 
  ChevronRight, 
  Save, 
  FileText, 
  Plus,
  Trash2,
  DollarSign,
  Printer,
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useNavigate, useParams } from 'react-router-dom';

interface ToothData {
  id?: string;
  tooth_number: number;
  condition: string;
  surfaces: Record<string, string>;
  notes?: string;
  treatment_needed?: string;
  treatment_id?: string;
}

interface Treatment {
  id: string;
  name: string;
  base_price: number;
  category: string;
}

interface BudgetItem {
  id?: string;
  treatment_id: string;
  tooth_number?: number;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

const CONDITIONS = [
  'healthy', 'caries', 'filling', 'crown', 'root_canal', 
  'extraction', 'missing', 'implant', 'bridge'
];

const PatientExam = () => {
  const navigate = useNavigate();
  const { patientId } = useParams();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [teeth, setTeeth] = useState<Record<number, ToothData>>({});
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [showBudgetDialog, setShowBudgetDialog] = useState(false);
  const [discount, setDiscount] = useState(0);

  // Form for selected tooth
  const [toothForm, setToothForm] = useState({
    condition: 'healthy',
    notes: '',
    treatment_id: ''
  });

  useEffect(() => {
    if (patientId) {
      fetchData();
    }
  }, [patientId]);

  useEffect(() => {
    if (selectedTooth && teeth[selectedTooth]) {
      const tooth = teeth[selectedTooth];
      setToothForm({
        condition: tooth.condition || 'healthy',
        notes: tooth.notes || '',
        treatment_id: tooth.treatment_id || ''
      });
    } else {
      setToothForm({
        condition: 'healthy',
        notes: '',
        treatment_id: ''
      });
    }
  }, [selectedTooth, teeth]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch patient
      const { data: patientData } = await supabase
        .from('patients')
        .select('first_name, last_name')
        .eq('id', patientId)
        .single();

      if (patientData) {
        setPatientName(`${patientData.first_name} ${patientData.last_name}`);
      }

      // Fetch odontogram
      const { data: odontogramData } = await supabase
        .from('odontograms')
        .select('*')
        .eq('patient_id', patientId);

      const teethMap: Record<number, ToothData> = {};
      odontogramData?.forEach(tooth => {
        teethMap[tooth.tooth_number] = tooth;
      });
      setTeeth(teethMap);

      // Fetch treatments
      const { data: treatmentsData } = await supabase
        .from('treatments')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('name');

      setTreatments(treatmentsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleToothClick = (toothNumber: number) => {
    setSelectedTooth(toothNumber);
  };

  const handleSaveTooth = async () => {
    if (!selectedTooth || !patientId) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const toothData = {
        user_id: user.id,
        patient_id: patientId,
        tooth_number: selectedTooth,
        condition: toothForm.condition,
        notes: toothForm.notes,
        treatment_id: toothForm.treatment_id || null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('odontograms')
        .upsert(toothData, { onConflict: 'patient_id,tooth_number' });

      if (error) throw error;

      // Update local state
      setTeeth(prev => ({
        ...prev,
        [selectedTooth]: { ...prev[selectedTooth], ...toothData }
      }));

      toast.success(`Diente ${selectedTooth} guardado`);
    } catch (error) {
      console.error('Error saving tooth:', error);
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const generateBudgetFromOdontogram = () => {
    const items: BudgetItem[] = [];
    
    Object.values(teeth).forEach(tooth => {
      if (tooth.treatment_id && tooth.condition !== 'healthy') {
        const treatment = treatments.find(t => t.id === tooth.treatment_id);
        if (treatment) {
          items.push({
            treatment_id: treatment.id,
            tooth_number: tooth.tooth_number,
            description: `${treatment.name} - Diente ${tooth.tooth_number}`,
            quantity: 1,
            unit_price: treatment.base_price,
            total: treatment.base_price
          });
        }
      }
    });

    setBudgetItems(items);
    setShowBudgetDialog(true);
  };

  const addBudgetItem = () => {
    setBudgetItems(prev => [...prev, {
      treatment_id: '',
      description: '',
      quantity: 1,
      unit_price: 0,
      total: 0
    }]);
  };

  const updateBudgetItem = (index: number, field: string, value: any) => {
    setBudgetItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      
      // Recalculate total
      if (field === 'quantity' || field === 'unit_price') {
        updated[index].total = updated[index].quantity * updated[index].unit_price;
      }
      
      // If treatment selected, auto-fill
      if (field === 'treatment_id') {
        const treatment = treatments.find(t => t.id === value);
        if (treatment) {
          updated[index].description = treatment.name;
          updated[index].unit_price = treatment.base_price;
          updated[index].total = updated[index].quantity * treatment.base_price;
        }
      }
      
      return updated;
    });
  };

  const removeBudgetItem = (index: number) => {
    setBudgetItems(prev => prev.filter((_, i) => i !== index));
  };

  const subtotal = budgetItems.reduce((sum, item) => sum + item.total, 0);
  const discountAmount = subtotal * (discount / 100);
  const total = subtotal - discountAmount;

  const saveBudget = async () => {
    if (budgetItems.length === 0) {
      toast.error('Agrega al menos un tratamiento');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Create budget
      const { data: budget, error: budgetError } = await supabase
        .from('budgets')
        .insert({
          user_id: user.id,
          patient_id: patientId,
          subtotal,
          discount_percent: discount,
          discount_amount: discountAmount,
          total,
          status: 'pending'
        })
        .select()
        .single();

      if (budgetError) throw budgetError;

      // Create budget items
      const items = budgetItems.map(item => ({
        budget_id: budget.id,
        treatment_id: item.treatment_id || null,
        tooth_number: item.tooth_number,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total
      }));

      const { error: itemsError } = await supabase
        .from('budget_items')
        .insert(items);

      if (itemsError) throw itemsError;

      toast.success('Presupuesto guardado');
      setShowBudgetDialog(false);
      setBudgetItems([]);
    } catch (error) {
      console.error('Error saving budget:', error);
      toast.error('Error al guardar presupuesto');
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
        <div className="flex items-center gap-2 text-ios-gray-500 text-sm mb-2">
          <span>Expediente</span>
          <ChevronRight className="h-4 w-4" />
          <span className="text-ios-purple font-medium">Examen Oral</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">Odontograma</h1>
            <p className="text-ios-gray-500 mt-1 font-medium">
              Paciente: <span className="text-ios-gray-900">{patientName}</span>
            </p>
          </div>
          <button
            onClick={generateBudgetFromOdontogram}
            className="flex items-center gap-2 h-11 px-5 rounded-xl bg-ios-green text-white font-semibold text-sm shadow-ios-sm hover:bg-ios-green/90 transition-all duration-200 touch-feedback"
          >
            <DollarSign className="h-5 w-5" />
            Generar Presupuesto
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Odontogram */}
        <div className="lg:col-span-2 ios-card p-6 animate-slide-up">
          <Odontogram
            teeth={teeth}
            onToothClick={handleToothClick}
            selectedTooth={selectedTooth}
          />
        </div>

        {/* Tooth Details Panel */}
        <div className="ios-card p-6 animate-slide-up" style={{ animationDelay: '50ms' }}>
          {selectedTooth ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-ios-gray-900">
                  Diente {selectedTooth}
                </h3>
                <button
                  onClick={() => setSelectedTooth(null)}
                  className="text-ios-gray-400 hover:text-ios-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-ios-gray-600">Condición</Label>
                  <Select
                    value={toothForm.condition}
                    onValueChange={(value) => setToothForm(prev => ({ ...prev, condition: value }))}
                  >
                    <SelectTrigger className="ios-input">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {CONDITIONS.map(cond => (
                        <SelectItem key={cond} value={cond}>
                          {CONDITION_LABELS[cond]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-ios-gray-600">Tratamiento Requerido</Label>
                  <Select
                    value={toothForm.treatment_id}
                    onValueChange={(value) => setToothForm(prev => ({ ...prev, treatment_id: value }))}
                  >
                    <SelectTrigger className="ios-input">
                      <SelectValue placeholder="Seleccionar tratamiento" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {treatments.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} - ${t.base_price}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-ios-gray-600">Notas</Label>
                  <textarea
                    value={toothForm.notes}
                    onChange={(e) => setToothForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="ios-input resize-none"
                    rows={3}
                    placeholder="Observaciones del diente..."
                  />
                </div>

                <button
                  onClick={handleSaveTooth}
                  disabled={saving}
                  className="w-full h-12 rounded-xl bg-ios-blue text-white font-semibold flex items-center justify-center gap-2 hover:bg-ios-blue/90 transition-colors touch-feedback disabled:opacity-50"
                >
                  {saving ? (
                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save className="h-5 w-5" />
                      Guardar Diente
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="h-16 w-16 rounded-full bg-ios-gray-100 flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-ios-gray-400" />
              </div>
              <p className="text-ios-gray-900 font-semibold">Selecciona un diente</p>
              <p className="text-ios-gray-500 text-sm mt-1">
                Haz clic en cualquier diente para ver o editar su información
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Budget Dialog */}
      <Dialog open={showBudgetDialog} onOpenChange={setShowBudgetDialog}>
        <DialogContent className="max-w-3xl rounded-3xl border-0 shadow-ios-xl p-0 overflow-hidden max-h-[90vh]">
          <DialogHeader className="p-6 pb-4 border-b border-ios-gray-100">
            <DialogTitle className="text-xl font-bold text-ios-gray-900 flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-ios-green" />
              Presupuesto - {patientName}
            </DialogTitle>
          </DialogHeader>

          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {/* Items */}
            <div className="space-y-3 mb-6">
              {budgetItems.map((item, index) => (
                <div key={index} className="flex gap-3 items-start p-4 bg-ios-gray-50 rounded-2xl animate-fade-in">
                  <div className="flex-1 grid grid-cols-4 gap-3">
                    <div className="col-span-2">
                      <Select
                        value={item.treatment_id}
                        onValueChange={(value) => updateBudgetItem(index, 'treatment_id', value)}
                      >
                        <SelectTrigger className="ios-input text-sm">
                          <SelectValue placeholder="Tratamiento" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {treatments.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateBudgetItem(index, 'quantity', parseInt(e.target.value) || 1)}
                      className="ios-input text-sm text-center"
                      min="1"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-ios-green font-bold">
                        ${item.total.toFixed(2)}
                      </span>
                      <button
                        onClick={() => removeBudgetItem(index)}
                        className="h-8 w-8 rounded-lg bg-ios-red/10 flex items-center justify-center hover:bg-ios-red/20 transition-colors touch-feedback"
                      >
                        <Trash2 className="h-4 w-4 text-ios-red" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={addBudgetItem}
                className="w-full h-12 rounded-xl border-2 border-dashed border-ios-gray-300 text-ios-gray-500 font-medium flex items-center justify-center gap-2 hover:border-ios-blue hover:text-ios-blue transition-colors touch-feedback"
              >
                <Plus className="h-5 w-5" />
                Agregar Tratamiento
              </button>
            </div>

            {/* Totals */}
            <div className="space-y-3 p-4 bg-ios-gray-50 rounded-2xl">
              <div className="flex justify-between text-sm">
                <span className="text-ios-gray-600">Subtotal</span>
                <span className="font-medium">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ios-gray-600 text-sm">Descuento (%)</span>
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  className="w-20 ios-input text-sm text-center"
                  min="0"
                  max="100"
                />
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-ios-red">
                  <span>Descuento</span>
                  <span>-${discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between pt-3 border-t border-ios-gray-200">
                <span className="font-bold text-ios-gray-900">Total</span>
                <span className="text-xl font-bold text-ios-green">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="p-6 pt-4 border-t border-ios-gray-100 flex gap-3">
            <button
              onClick={() => setShowBudgetDialog(false)}
              className="flex-1 h-12 rounded-xl bg-ios-gray-100 text-ios-gray-900 font-semibold hover:bg-ios-gray-200 transition-colors touch-feedback"
            >
              Cancelar
            </button>
            <button
              onClick={saveBudget}
              disabled={saving || budgetItems.length === 0}
              className="flex-1 h-12 rounded-xl bg-ios-green text-white font-semibold flex items-center justify-center gap-2 hover:bg-ios-green/90 transition-colors touch-feedback disabled:opacity-50"
            >
              {saving ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="h-5 w-5" />
                  Guardar Presupuesto
                </>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default PatientExam;