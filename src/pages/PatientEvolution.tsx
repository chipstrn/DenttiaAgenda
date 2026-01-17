"use client";

import React, { useEffect, useState, useCallback } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useParams } from 'react-router-dom';
import { ChevronRight, Save, Plus, Trash2, FileText, User, Calendar, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import Odontogram, { CONDITION_LABELS } from '@/components/dental/Odontogram';

interface EvolutionNote {
    id: string;
    patient_id: string;
    user_id: string | null;
    note: string;
    note_date: string;
    created_at: string;
    profiles?: {
        first_name: string;
        last_name: string;
    };
}

interface ToothData {
    tooth_number: number;
    condition: string;
    surfaces: {
        mesial?: string;
        distal?: string;
        oclusal?: string;
        vestibular?: string;
        lingual?: string;
    };
    notes?: string;
    treatment_needed?: string;
}

const PatientEvolution = () => {
    const { patientId } = useParams();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [patientName, setPatientName] = useState('');
    const [notes, setNotes] = useState<EvolutionNote[]>([]);
    const [newNote, setNewNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);

    // Odontogram state
    const [teeth, setTeeth] = useState<Record<number, ToothData>>({});
    const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
    const [toothCondition, setToothCondition] = useState('healthy');
    const [toothNotes, setToothNotes] = useState('');
    const [savingTooth, setSavingTooth] = useState(false);

    const fetchData = useCallback(async () => {
        if (!patientId) return;

        setLoading(true);
        try {
            // Fetch patient details
            const { data: patient, error: patientError } = await supabase
                .from('patients')
                .select('first_name, last_name')
                .eq('id', patientId)
                .single();

            if (patientError) throw patientError;
            setPatientName(`${patient.first_name} ${patient.last_name}`);

            // Fetch notes
            const { data: notesData, error: notesError } = await supabase
                .from('evolution_notes')
                .select(`
                    *,
                    profiles:user_id (first_name, last_name)
                `)
                .eq('patient_id', patientId)
                .order('note_date', { ascending: false });

            if (notesError) throw notesError;
            setNotes(notesData || []);

            // Fetch odontogram data
            const { data: odontogramData, error: odontogramError } = await supabase
                .from('odontograms')
                .select('*')
                .eq('patient_id', patientId);

            if (odontogramError) throw odontogramError;

            // Convert to teeth record format
            const teethRecord: Record<number, ToothData> = {};
            odontogramData?.forEach(tooth => {
                teethRecord[tooth.tooth_number] = {
                    tooth_number: tooth.tooth_number,
                    condition: tooth.condition || 'healthy',
                    surfaces: tooth.surfaces || {},
                    notes: tooth.notes || '',
                    treatment_needed: tooth.treatment_needed || ''
                };
            });
            setTeeth(teethRecord);
        } catch (error) {
            console.error('Error fetching evolution notes:', error);
            toast.error('Error al cargar datos');
        } finally {
            setLoading(false);
        }
    }, [patientId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleToothClick = (toothNumber: number) => {
        setSelectedTooth(toothNumber);
        const toothData = teeth[toothNumber];
        setToothCondition(toothData?.condition || 'healthy');
        setToothNotes(toothData?.notes || '');
    };

    const handleSaveTooth = async () => {
        if (!selectedTooth || !user) return;

        setSavingTooth(true);
        try {
            // Check if tooth exists
            const { data: existing } = await supabase
                .from('odontograms')
                .select('id')
                .eq('patient_id', patientId)
                .eq('tooth_number', selectedTooth)
                .single();

            if (existing) {
                // Update
                const { error } = await supabase
                    .from('odontograms')
                    .update({
                        condition: toothCondition,
                        notes: toothNotes,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);

                if (error) throw error;
            } else {
                // Insert
                const { error } = await supabase
                    .from('odontograms')
                    .insert({
                        patient_id: patientId,
                        user_id: user.id,
                        tooth_number: selectedTooth,
                        condition: toothCondition,
                        notes: toothNotes,
                        surfaces: {}
                    });

                if (error) throw error;
            }

            // Update local state
            setTeeth(prev => ({
                ...prev,
                [selectedTooth]: {
                    tooth_number: selectedTooth,
                    condition: toothCondition,
                    surfaces: teeth[selectedTooth]?.surfaces || {},
                    notes: toothNotes
                }
            }));

            toast.success(`Diente ${selectedTooth} actualizado`);
            setSelectedTooth(null);
        } catch (error) {
            console.error('Error saving tooth:', error);
            toast.error('Error al guardar');
        } finally {
            setSavingTooth(false);
        }
    };

    const handleSaveNote = async () => {
        if (!newNote.trim()) {
            toast.error('La nota no puede estar vacía');
            return;
        }

        if (!user) {
            toast.error('Sesión no válida');
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase
                .from('evolution_notes')
                .insert({
                    patient_id: patientId,
                    user_id: user.id,
                    note: newNote,
                    note_date: new Date().toISOString()
                });

            if (error) throw error;

            toast.success('Nota de evolución guardada');
            setNewNote('');
            fetchData();
        } catch (error) {
            console.error('Error saving note:', error);
            toast.error('Error al guardar la nota');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteNote = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta nota?')) return;

        setDeleting(id);
        try {
            const { error } = await supabase
                .from('evolution_notes')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setNotes(prev => prev.filter(n => n.id !== id));
            toast.success('Nota eliminada');
        } catch (error) {
            console.error('Error deleting note:', error);
            toast.error('Error al eliminar nota');
        } finally {
            setDeleting(null);
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
            <div className="mb-8 animate-fade-in">
                <div className="flex items-center gap-2 text-ios-gray-500 text-sm mb-2">
                    <span>Expediente</span>
                    <ChevronRight className="h-4 w-4" />
                    <span className="text-ios-blue font-medium">Evolución</span>
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">Historial Clínico</h1>
                        <p className="text-ios-gray-500 mt-1 font-medium">
                            Paciente: <span className="text-ios-gray-900">{patientName}</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Odontogram Section */}
            <div className="ios-card p-6 mb-6 animate-slide-up">
                <h2 className="text-lg font-bold text-ios-gray-900 mb-4">Odontograma</h2>
                <p className="text-sm text-ios-gray-500 mb-6">Haz clic en un diente para editar su estado</p>

                <Odontogram
                    teeth={teeth}
                    onToothClick={handleToothClick}
                    selectedTooth={selectedTooth}
                />
            </div>

            {/* Tooth Editor Panel */}
            {selectedTooth && (
                <div className="ios-card p-6 mb-6 animate-scale-in border-2 border-ios-blue">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-ios-gray-900">
                            Diente #{selectedTooth}
                        </h3>
                        <button
                            onClick={() => setSelectedTooth(null)}
                            className="p-2 hover:bg-ios-gray-100 rounded-xl transition-colors"
                        >
                            <X className="h-5 w-5 text-ios-gray-500" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <Label className="text-sm font-medium text-ios-gray-600 mb-2 block">Condición</Label>
                            <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                                {Object.entries(CONDITION_LABELS).map(([key, label]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setToothCondition(key)}
                                        className={cn(
                                            "px-3 py-2 rounded-xl text-sm font-medium transition-all touch-feedback",
                                            toothCondition === key
                                                ? "bg-ios-blue text-white"
                                                : "bg-ios-gray-100 text-ios-gray-700 hover:bg-ios-gray-200"
                                        )}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <Label className="text-sm font-medium text-ios-gray-600 mb-2 block">Notas del diente</Label>
                            <textarea
                                value={toothNotes}
                                onChange={(e) => setToothNotes(e.target.value)}
                                className="ios-input min-h-[80px] resize-none"
                                placeholder="Observaciones específicas de este diente..."
                            />
                        </div>

                        <button
                            onClick={handleSaveTooth}
                            disabled={savingTooth}
                            className="w-full h-12 rounded-xl bg-ios-blue text-white font-semibold flex items-center justify-center gap-2 hover:bg-ios-blue/90 transition-colors touch-feedback disabled:opacity-50"
                        >
                            {savingTooth ? (
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
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* New Note Form */}
                <div className="lg:col-span-1">
                    <div className="ios-card p-6 animate-slide-up bg-white" style={{ animationDelay: '100ms' }}>
                        <h2 className="text-lg font-bold text-ios-gray-900 mb-4 flex items-center gap-2">
                            <Plus className="h-5 w-5 text-ios-blue" />
                            Nueva Nota de Evolución
                        </h2>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium text-ios-gray-600">Descripción detallada</Label>
                                <textarea
                                    value={newNote}
                                    onChange={(e) => setNewNote(e.target.value)}
                                    className="ios-input min-h-[150px] resize-none"
                                    placeholder="Escribe los detalles de la evolución del paciente..."
                                />
                            </div>
                            <button
                                onClick={handleSaveNote}
                                disabled={saving}
                                className="w-full h-12 rounded-xl bg-ios-blue text-white font-semibold flex items-center justify-center gap-2 hover:bg-ios-blue/90 transition-colors touch-feedback disabled:opacity-50"
                            >
                                {saving ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <>
                                        <Save className="h-5 w-5" />
                                        Guardar Nota
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* History List */}
                <div className="lg:col-span-2">
                    <div className="space-y-4 animate-slide-up" style={{ animationDelay: '150ms' }}>
                        <h2 className="text-lg font-bold text-ios-gray-900">Historial de Notas</h2>
                        {notes.length > 0 ? (
                            notes.map((note, index) => (
                                <div
                                    key={note.id}
                                    className="ios-card p-6 flex flex-col gap-4 animate-fade-in"
                                    style={{ animationDelay: `${200 + index * 50}ms` }}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-ios-gray-100 flex items-center justify-center">
                                                <User className="h-5 w-5 text-ios-gray-500" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-ios-gray-900">
                                                    Dr. {note.profiles?.first_name} {note.profiles?.last_name}
                                                </p>
                                                <div className="flex items-center gap-1.5 text-xs text-ios-gray-500">
                                                    <Calendar className="h-3.5 w-3.5" />
                                                    {format(new Date(note.note_date), "d 'de' MMMM, yyyy - HH:mm", { locale: es })}
                                                </div>
                                            </div>
                                        </div>
                                        {user?.id === note.user_id && (
                                            <button
                                                onClick={() => handleDeleteNote(note.id)}
                                                disabled={deleting === note.id}
                                                className="text-ios-gray-400 hover:text-ios-red transition-colors p-2"
                                                title="Eliminar nota"
                                            >
                                                {deleting === note.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="h-4 w-4" />
                                                )}
                                            </button>
                                        )}
                                    </div>
                                    <div className="bg-ios-gray-50 rounded-xl p-4 text-ios-gray-800 whitespace-pre-wrap text-sm leading-relaxed">
                                        {note.note}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="ios-card p-12 text-center">
                                <div className="h-16 w-16 rounded-full bg-ios-gray-100 flex items-center justify-center mx-auto mb-4">
                                    <FileText className="h-8 w-8 text-ios-gray-400" />
                                </div>
                                <p className="text-ios-gray-900 font-semibold">Sin notas de evolución</p>
                                <p className="text-ios-gray-500 text-sm mt-1">
                                    Agrega la primera nota para comenzar el historial
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </MainLayout>
    );
};

export default PatientEvolution;
