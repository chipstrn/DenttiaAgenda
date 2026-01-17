"use client";

import React, { useEffect, useState, useCallback } from 'react';
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
  Check,
  Check,
  Loader2,
  Calendar,
  User,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { useParams } from 'react-router-dom';

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

interface ClinicalNote {
  id: string;
  patient_id: string;
  user_id: string | null;
  note: string;
  note_date: string;
  created_at: string;
  profiles?: {
    first_name: string;
    last_name: string;
    role: string;
  };
}

const CONDITIONS = [
  'healthy', 'caries', 'filling', 'crown', 'root_canal',
  'extraction', 'missing', 'implant', 'bridge'
];

const PatientExam = () => {
  const { patientId } = useParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [teeth, setTeeth] = useState<Record<number, ToothData>>({});
  const [modifiedTeeth, setModifiedTeeth] = useState<Set<number>>(new Set());
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [showBudgetDialog, setShowBudgetDialog] = useState(false);
  const [discount, setDiscount] = useState(0);

  // Notes State
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [deletingNote, setDeletingNote] = useState<string | null>(null);

  // Form for selected tooth
  const [toothCondition, setToothCondition] = useState('healthy');
  const [toothNotes, setToothNotes] = useState('');
  const [toothTreatmentId, setToothTreatmentId] = useState('');

  useEffect(() => {
    if (patientId) {
      fetchData();
    }
  }, [patientId]);

  // Update form when tooth selection changes
  useEffect(() => {
    if (selectedTooth && teeth[selectedTooth]) {
      const tooth = teeth[selectedTooth];
      setToothCondition(tooth.condition || 'healthy');
      setToothNotes(tooth.notes || '');
      setToothTreatmentId(tooth.treatment_id || '');
    } else {
      setToothCondition('healthy');
      setToothNotes('');
      setToothTreatmentId('');
    }
  }, [selectedTooth, teeth]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Fetch patient and odontogram in parallel
      const [patientResult, odontogramResult, treatmentsResult] = await Promise.all([
        supabase
          .from('patients')
          .select('first_name, last_name')
          .eq('id', patientId)
          .single(),
        supabase
          .from('odontograms')
          .select('*')
          .eq('patient_id', patientId),
        supabase
          .from('treatments')
          .select('id, name, base_price, category')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('clinical_notes')
          .select(`
            *,
            *,
            profiles:user_id (first_name, last_name, role)
          `)
          .eq('patient_id', patientId)
          .order('note_date', { ascending: false })
      ]);

      if (patientResult.data) {
        setPatientName(`${patientResult.data.first_name} ${patientResult.data.last_name}`);
      }

      const teethMap: Record<number, ToothData> = {};
      odontogramResult.data?.forEach(tooth => {
        teethMap[tooth.tooth_number] = tooth;
      });
      setTeeth(teethMap);
      setTreatments(treatmentsResult.data || []);
      setNotes(patientResult && treatmentsResult ? (await supabase.from('clinical_notes').select('*, profiles:user_id(first_name, last_name, role)').eq('patient_id', patientId).order('note_date', { ascending: false })).data || [] : []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleToothClick = useCallback((toothNumber: number) => {
    setSelectedTooth(toothNumber);
  }, []);

  // Update local tooth state without saving
  const updateLocalTooth = useCallback(() => {
    if (!selectedTooth) return;

    setTeeth(prev => ({
      ...prev,
      [selectedTooth]: {
        ...prev[selectedTooth],
        tooth_number: selectedTooth,
        condition: toothCondition,
        notes: toothNotes,
        treatment_id: toothTreatmentId || undefined,
        surfaces: prev[selectedTooth]?.surfaces || {}
      }
    }));

    // Mark as modified
    setModifiedTeeth(prev => new Set(prev).add(selectedTooth));
  }, [selectedTooth, toothCondition, toothNotes, toothTreatmentId]);

  // Save single tooth
  const handleSaveTooth = async () => {
    if (!selectedTooth || !patientId || !userId) return;

    setSaving(true);
    try {
      const toothData = {
        user_id: userId,
        patient_id: patientId,
        tooth_number: selectedTooth,
        condition: toothCondition,
        notes: toothNotes,
        treatment_id: toothTreatmentId || null,
        surfaces: teeth[selectedTooth]?.surfaces || {},
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('odontograms')
        .upsert(toothData, {
          onConflict: 'patient_id,tooth_number',
          ignoreDuplicates: false
        });

      if (error) throw error;

      // Update local state
      setTeeth(prev => ({
        ...prev,
        [selectedTooth]: { ...prev[selectedTooth], ...toothData }
      }));

      // Remove from modified set
      setModifiedTeeth(prev => {
        const newSet = new Set(prev);
        newSet.delete(selectedTooth);
        return newSet;
      });

      toast.success(`Diente ${selectedTooth} guardado`);
    } catch (error) {
      console.error('Error saving tooth:', error);
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  // BULK SAVE - Save all modified teeth in ONE transaction
  const handleSaveAllTeeth = async () => {
    if (!patientId || !userId || modifiedTeeth.size === 0) {
      toast.info('No hay cambios pendientes');
      return;
    }

    setSavingAll(true);
    try {
      // Prepare bulk payload
      const bulkPayload = Array.from(modifiedTeeth).map(toothNumber => {
        const tooth = teeth[toothNumber];
        return {
          user_id: userId,
          patient_id: patientId,
          tooth_number: toothNumber,
          condition: tooth?.condition || 'healthy',
          notes: tooth?.notes || null,
          treatment_id: tooth?.treatment_id || null,
          surfaces: tooth?.surfaces || {},
          updated_at: new Date().toISOString()
        };
      });

      // Single bulk upsert - ONE database call for all teeth
      const { error } = await supabase
        .from('odontograms')
        .upsert(bulkPayload, {
          onConflict: 'patient_id,tooth_number',
          ignoreDuplicates: false
        });

      if (error) throw error;

      // Clear modified set
      setModifiedTeeth(new Set());

      toast.success(`${bulkPayload.length} dientes guardados`);
    } catch (error) {
      console.error('Error bulk saving teeth:', error);
      toast.error('Error al guardar odontograma');
    } finally {
      setSavingAll(false);
    }
  };

  const handleSaveNote = async () => {
    if (!newNote.trim()) {
      toast.error('La nota no puede estar vacía');
      return;
    }

    if (!userId || !patientId) return;

    setSavingNote(true);
    try {
      const { data, error } = await supabase
        .from('clinical_notes')
        .insert({
          patient_id: patientId,
          user_id: userId,
          note: newNote,
          note_date: new Date().toISOString()
        })
        .select(`
          *,
          profiles:user_id (first_name, last_name, role)
        `)
        .single();

      if (error) throw error;

      setNotes(prev => [data, ...prev]);
      setNewNote('');
      toast.success('Nota guardada');
    } catch (error) {
      console.error('Error saving note:', error);
      toast.error('Error al guardar nota');
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta nota?')) return;

    setDeletingNote(id);
    try {
      const { error } = await supabase
        .from('clinical_notes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setNotes(prev => prev.filter(n => n.id !== id));
      toast.success('Nota eliminada');
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Error al eliminar nota');
    } finally {
      setDeletingNote(null);
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

      if (field === 'quantity' || field === 'unit_price') {
        updated[index].total = updated[index].quantity * updated[index].unit_price;
      }

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
      // Create budget
      const { data: budget, error: budgetError } = await supabase
        .from('budgets')
        .insert({
          user_id: userId,
          patient_id: patientId,
          subtotal,
          discount_percent: discount,
          discount_amount: discountAmount,
          total,
          status: 'pending'
        })
        .select('id')
        .single();

      if (budgetError) throw budgetError;

      // Bulk insert budget items - ONE call
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
          <Loader2 className="h-8 w-8 animate-spin text-ios-blue" />
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
          <div className="flex items-center gap-3">
            {modifiedTeeth.size > 0 && (
              <button
                onClick={handleSaveAllTeeth}
                disabled={savingAll}
                className="flex items-center gap-2 h-11 px-5 rounded-xl bg-ios-blue text-white font-semibold text-sm shadow-ios-sm hover:bg-ios-blue/90 transition-all duration-200 touch-feedback disabled:opacity-50"
              >
                {savingAll ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Save className="h-5 w-5" />
                )}
                Guardar Todo ({modifiedTeeth.size})
              </button>
            )}
            <button
              onClick={generateBudgetFromOdontogram}
              className="flex items-center gap-2 h-11 px-5 rounded-xl bg-ios-green text-white font-semibold text-sm shadow-ios-sm hover:bg-ios-green/90 transition-all duration-200 touch-feedback"
            >
              <DollarSign className="h-5 w-5" />
              Generar Presupuesto
            </button>
          </div>
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

          {/* Clinical Notes Section */}
          <div className="mt-6 border-t border-ios-gray-100 pt-6">
            <h3 className="text-lg font-bold text-ios-gray-900 mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-ios-blue" />
              Notas de Evolución y Detalles
            </h3>

            <div className="bg-ios-gray-50 rounded-2xl p-4 mb-6">
              <div className="space-y-3">
                <Label className="text-sm font-medium text-ios-gray-600">Nueva Nota</Label>
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="ios-input min-h-[100px] resize-none bg-white"
                  placeholder="Escribe detalles del tratamiento, evolución o notas para la próxima cita..."
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveNote}
                    disabled={savingNote}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-ios-blue text-white font-semibold shadow-ios-sm hover:bg-ios-blue/90 transition-all duration-200 touch-feedback disabled:opacity-50"
                  >
                    {savingNote ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Guardar Nota
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {notes.length > 0 ? (
                notes.map((note) => (
                  <div key={note.id} className="bg-white border border-ios-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-ios-blue/10 flex items-center justify-center text-ios-blue font-bold text-sm">
                          {note.profiles?.first_name?.[0]}{note.profiles?.last_name?.[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-ios-gray-900 text-sm">
                            {(() => {
                              const role = note.profiles?.role;
                              let prefix = '';
                              if (role === 'doctor') prefix = 'Dr.';
                              else if (role === 'admin') prefix = 'Admin';
                              else if (role === 'recepcion') prefix = 'Recepción';

                              if (prefix === 'Recepción') {
                                return `${prefix} - ${note.profiles?.first_name} ${note.profiles?.last_name}`;
                              }
                              return `${prefix} ${note.profiles?.first_name} ${note.profiles?.last_name}`;
                            })()}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-ios-gray-500 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(note.note_date), "d MMM yyyy", { locale: es })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(note.note_date), "HH:mm", { locale: es })}
                            </span>
                          </div>
                        </div>
                      </div>
                      {userId === note.user_id && (
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          disabled={deletingNote === note.id}
                          className="text-ios-gray-400 hover:text-ios-red transition-colors p-1.5 hover:bg-ios-red/5 rounded-lg"
                        >
                          {deletingNote === note.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                    <div className="text-ios-gray-700 text-sm leading-relaxed whitespace-pre-wrap pl-[52px]">
                      {note.note}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-ios-gray-400">
                  <p className="text-sm">No hay notas registradas</p>
                </div>
              )}
            </div>
          </div>
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
                    value={toothCondition}
                    onValueChange={(value) => {
                      setToothCondition(value);
                      // Mark as modified immediately
                      setModifiedTeeth(prev => new Set(prev).add(selectedTooth));
                      setTeeth(prev => ({
                        ...prev,
                        [selectedTooth]: {
                          ...prev[selectedTooth],
                          tooth_number: selectedTooth,
                          condition: value,
                          surfaces: prev[selectedTooth]?.surfaces || {}
                        }
                      }));
                    }}
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
                    value={toothTreatmentId}
                    onValueChange={(value) => {
                      setToothTreatmentId(value);
                      setModifiedTeeth(prev => new Set(prev).add(selectedTooth));
                      setTeeth(prev => ({
                        ...prev,
                        [selectedTooth]: {
                          ...prev[selectedTooth],
                          tooth_number: selectedTooth,
                          treatment_id: value,
                          surfaces: prev[selectedTooth]?.surfaces || {}
                        }
                      }));
                    }}
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
                    value={toothNotes}
                    onChange={(e) => {
                      setToothNotes(e.target.value);
                      setModifiedTeeth(prev => new Set(prev).add(selectedTooth));
                      setTeeth(prev => ({
                        ...prev,
                        [selectedTooth]: {
                          ...prev[selectedTooth],
                          tooth_number: selectedTooth,
                          notes: e.target.value,
                          surfaces: prev[selectedTooth]?.surfaces || {}
                        }
                      }));
                    }}
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
                    <Loader2 className="h-5 w-5 animate-spin" />
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
                <Loader2 className="h-5 w-5 animate-spin" />
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