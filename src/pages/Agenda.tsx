"use client";

import React, { useEffect, useState, useCallback } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Clock, User, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays, subDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Appointment {
  id: string;
  patient_id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  status: string;
  treatment_type: string;
  patients?: {
    first_name: string;
    last_name: string;
  };
}

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
}

const Agenda = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Individual form states
  const [patientId, setPatientId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');

  const fetchData = useCallback(async () => {
    try {
      // Fetch ALL appointments and patients (shared data)
      const [appointmentsResult, patientsResult] = await Promise.all([
        supabase
          .from('appointments')
          .select('*, patients(first_name, last_name)')
          .order('start_time', { ascending: true }),
        supabase
          .from('patients')
          .select('id, first_name, last_name')
          .order('first_name', { ascending: true })
      ]);

      if (appointmentsResult.error) throw appointmentsResult.error;
      if (patientsResult.error) throw patientsResult.error;

      setAppointments(appointmentsResult.data || []);
      setPatients(patientsResult.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = useCallback(() => {
    setPatientId('');
    setTitle('');
    setDescription('');
    setAppointmentDate(format(new Date(), 'yyyy-MM-dd'));
    setStartTime('09:00');
    setEndTime('10:00');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    
    if (!patientId) {
      toast.error('Selecciona un paciente');
      return;
    }
    
    if (!title.trim()) {
      toast.error('Ingresa el motivo de la cita');
      return;
    }

    setSaving(true);
    try {
      const startDateTime = new Date(`${appointmentDate}T${startTime}`);
      const endDateTime = new Date(`${appointmentDate}T${endTime}`);

      const { error } = await supabase
        .from('appointments')
        .insert({
          user_id: user.id,
          patient_id: patientId,
          title: title.trim(),
          description: description.trim(),
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          status: 'scheduled'
        });

      if (error) throw error;
      
      toast.success('Cita creada');
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error creating appointment:', error);
      toast.error('Error al crear cita');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = useCallback(async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      
      setAppointments(prev => 
        prev.map(apt => apt.id === id ? { ...apt, status } : apt)
      );
      toast.success('Estado actualizado');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Error al actualizar');
    }
  }, []);

  const todaysAppointments = appointments.filter(apt => 
    isSameDay(new Date(apt.start_time), selectedDate)
  );

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-ios-green/15 text-ios-green';
      case 'in-progress': return 'bg-ios-blue/15 text-ios-blue';
      case 'completed': return 'bg-ios-gray-200 text-ios-gray-600';
      case 'cancelled': return 'bg-ios-red/15 text-ios-red';
      default: return 'bg-ios-orange/15 text-ios-orange';
    }
  };

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">Agenda</h1>
          <p className="text-ios-gray-500 mt-1 font-medium">Gestiona las citas de la clínica</p>
        </div>
        <button 
          onClick={() => setIsDialogOpen(true)}
          className="flex items-center gap-2 h-11 px-5 rounded-xl bg-ios-blue text-white font-semibold text-sm shadow-ios-sm hover:bg-ios-blue/90 transition-all duration-200 touch-feedback"
        >
          <Plus className="h-5 w-5" />
          Nueva Cita
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '50ms' }}>
          <h2 className="text-lg font-bold text-ios-gray-900 mb-4 flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-ios-blue" />
            Calendario
          </h2>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && setSelectedDate(date)}
            className="rounded-2xl"
            locale={es}
          />
        </div>

        {/* Day View */}
        <div className="lg:col-span-2 ios-card overflow-hidden animate-slide-up" style={{ animationDelay: '100ms' }}>
          {/* Date Navigation */}
          <div className="flex items-center justify-between p-5 border-b border-ios-gray-100">
            <button 
              onClick={() => setSelectedDate(subDays(selectedDate, 1))}
              className="h-10 w-10 rounded-xl bg-ios-gray-100 flex items-center justify-center hover:bg-ios-gray-200 transition-colors touch-feedback"
            >
              <ChevronLeft className="h-5 w-5 text-ios-gray-600" />
            </button>
            <div className="text-center">
              <h2 className="text-lg font-bold text-ios-gray-900">
                {format(selectedDate, "EEEE", { locale: es })}
              </h2>
              <p className="text-sm text-ios-gray-500">
                {format(selectedDate, "d 'de' MMMM, yyyy", { locale: es })}
              </p>
            </div>
            <button 
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              className="h-10 w-10 rounded-xl bg-ios-gray-100 flex items-center justify-center hover:bg-ios-gray-200 transition-colors touch-feedback"
            >
              <ChevronRight className="h-5 w-5 text-ios-gray-600" />
            </button>
          </div>

          {/* Appointments */}
          <div className="p-3">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-ios-blue" />
              </div>
            ) : todaysAppointments.length > 0 ? (
              <div className="space-y-2">
                {todaysAppointments.map((apt, index) => (
                  <div
                    key={apt.id}
                    className="flex items-center gap-4 p-4 rounded-2xl hover:bg-ios-gray-50 transition-all duration-200 ease-ios animate-fade-in"
                    style={{ animationDelay: `${150 + index * 50}ms` }}
                  >
                    <div className="text-center min-w-[70px]">
                      <p className="text-lg font-bold text-ios-gray-900">
                        {format(new Date(apt.start_time), 'HH:mm')}
                      </p>
                      <p className="text-xs text-ios-gray-500">
                        {format(new Date(apt.end_time), 'HH:mm')}
                      </p>
                    </div>
                    <div className="h-12 w-1 rounded-full bg-ios-blue"></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ios-gray-900">{apt.title}</p>
                      <p className="text-sm text-ios-gray-500 flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {apt.patients?.first_name} {apt.patients?.last_name}
                      </p>
                    </div>
                    <Select
                      value={apt.status}
                      onValueChange={(value) => updateStatus(apt.id, value)}
                    >
                      <SelectTrigger className={cn(
                        "w-[130px] h-9 rounded-full border-0 text-xs font-semibold",
                        getStatusStyle(apt.status)
                      )}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="scheduled">Agendada</SelectItem>
                        <SelectItem value="confirmed">Confirmada</SelectItem>
                        <SelectItem value="in-progress">En Progreso</SelectItem>
                        <SelectItem value="completed">Completada</SelectItem>
                        <SelectItem value="cancelled">Cancelada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="h-20 w-20 rounded-full bg-ios-gray-100 flex items-center justify-center mx-auto mb-4">
                  <CalendarIcon className="h-10 w-10 text-ios-gray-400" />
                </div>
                <p className="text-ios-gray-900 font-semibold">Sin citas</p>
                <p className="text-ios-gray-500 text-sm mt-1">No hay citas para este día</p>
                <button 
                  onClick={() => setIsDialogOpen(true)}
                  className="mt-4 text-ios-blue font-semibold text-sm hover:opacity-70 transition-opacity"
                >
                  Agendar cita
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-[450px] rounded-3xl border-0 shadow-ios-xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="text-xl font-bold text-ios-gray-900">Nueva Cita</DialogTitle>
            <DialogDescription className="text-ios-gray-500">
              Programa una nueva cita
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit}>
            <div className="px-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Paciente *</Label>
                <Select value={patientId} onValueChange={setPatientId}>
                  <SelectTrigger className="ios-input">
                    <SelectValue placeholder="Seleccionar paciente" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {patients.map((patient) => (
                      <SelectItem key={patient.id} value={patient.id}>
                        {patient.first_name} {patient.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Motivo *</Label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Limpieza dental"
                  required
                  className="ios-input"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-ios-gray-600">Fecha</Label>
                  <input
                    type="date"
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    required
                    className="ios-input text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-ios-gray-600">Inicio</Label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                    className="ios-input text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-ios-gray-600">Fin</Label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                    className="ios-input text-sm"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Notas</Label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="ios-input resize-none"
                />
              </div>
            </div>
            
            <div className="p-6 pt-4 flex gap-3">
              <button 
                type="button" 
                onClick={() => setIsDialogOpen(false)}
                className="flex-1 h-12 rounded-xl bg-ios-gray-100 text-ios-gray-900 font-semibold hover:bg-ios-gray-200 transition-colors touch-feedback"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                disabled={saving}
                className="flex-1 h-12 rounded-xl bg-ios-blue text-white font-semibold hover:bg-ios-blue/90 transition-colors touch-feedback disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Creando...
                  </>
                ) : (
                  'Crear Cita'
                )}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Agenda;