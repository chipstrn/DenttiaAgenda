"use client";

import React, { useEffect, useState, useCallback } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronRight, Plus, Save, FileText, Trash2, Loader2, Calendar, User, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useParams, useNavigate } from 'react-router-dom';
import { CONDITION_LABELS } from '@/components/dental/Odontogram';

interface EvolutionNote {
    id: string;
    patient_id: string;
    user_id: string | null;
    note: string;
    note_date: string;
    created_at: string;
    tooth_number?: number;
    tooth_condition?: string;
    profiles?: {
        first_name: string;
        last_name: string;
    };
}

const PatientEvolution = () => {
    const { patientId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [patientName, setPatientName] = useState('');
    const [notes, setNotes] = useState<EvolutionNote[]>([]);
    const [newNote, setNewNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);

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
        setDeleting(id);
        try {
            const { error } = await supabase
                .from('evolution_notes')
                .delete()
                .eq('id', id);

            if (error) throw error;

            toast.success('Nota eliminada');
            setNotes(prev => prev.filter(n => n.id !== id));
        } catch (error) {
            console.error('Error deleting note:', error);
            toast.error('Error al eliminar la nota');
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
                        <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">Historial de Evolución</h1>
                        <p className="text-ios-gray-500 mt-1 font-medium">
                            Paciente: <span className="text-ios-gray-900">{patientName}</span>
                        </p>
                    </div>
                    <button
                        onClick={() => navigate(`/patient/${patientId}/exam`)}
                        className="flex items-center gap-2 px-4 py-2 bg-ios-blue/10 text-ios-blue rounded-xl font-medium hover:bg-ios-blue/20 transition-colors"
                    >
                        <ExternalLink className="h-4 w-4" />
                        Ver Odontograma
                    </button>
                </div>
            </div>

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
                                disabled={saving || !newNote.trim()}
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
                                    className={cn(
                                        "ios-card p-6 flex flex-col gap-4 animate-fade-in",
                                        note.tooth_number && "border-l-4 border-ios-blue"
                                    )}
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
                                        <div className="flex items-center gap-2">
                                            {note.tooth_number && (
                                                <div className="flex items-center gap-1 px-2.5 py-1 bg-ios-blue/10 text-ios-blue rounded-full text-xs font-medium">
                                                    🦷 #{note.tooth_number}
                                                    {note.tooth_condition && (
                                                        <span className="text-ios-gray-500">
                                                            • {CONDITION_LABELS[note.tooth_condition as keyof typeof CONDITION_LABELS] || note.tooth_condition}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
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
                                    </div>
                                    <div className={cn(
                                        "rounded-xl p-4 whitespace-pre-wrap text-sm leading-relaxed",
                                        note.tooth_number
                                            ? "bg-ios-blue/5 text-ios-gray-800"
                                            : "bg-ios-gray-50 text-ios-gray-800"
                                    )}>
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
