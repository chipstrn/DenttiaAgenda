"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
import { 
  Plus, Clock, User, Calendar as CalendarIcon, ChevronLeft, ChevronRight, 
  Loader2, Stethoscope, ShieldBan, MessageSquareText 
} from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays, subDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Location {
  id: string;
  name: string;
}

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

interface Doctor {
  id: string;
  full_name: string;
  specialty?: string | null;
  location_id?: string | null;
}

interface Appointment {
  id: string;
  patient_id: string | null;
  doctor_id: string | null;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  status: string; // scheduled, confirmed, in-progress, completed, cancelled ...
  treatment_type: string | null;
  type: 'medical' | 'personal';
  patient_data_status?: 'complete' | 'pending';
  location_id: string | null;
  patients?: {
    first_name: string;
    last_name: string;
    phone?: string;
  };
  doctors?: {
    full_name: string;
  };
}

const doctorColors = [
  'bg-ios-blue', 'bg-ios-green', 'bg-ios-orange', 'bg-ios-pink', 'bg-ios-purple', 
  'bg-ios-indigo', 'bg-ios-teal', 'bg-ios-red'
];

const Agenda = () => {
  const { user } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [treatments, setTreatments] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Form states (dual modal)
  const [creationType, setCreationType] = useState<'medical' | 'personal'>('medical');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [patientId, setPatientId] = useState('');
  const [quickPatientName, setQuickPatientName] = useState('');
  const [quickPatientPhone, setQuickPatientPhone] = useState('');
  const [title, setTitle] = useState('');
  const [treatmentId, setTreatmentId] = useState('');
  const [description, setDescription] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [status, setStatus] = useState<'confirmed' | 'cancelled' | 'rescheduled' | 'noshow' | 'postponed'>('confirmed');

  const fetchLocations = useCallback(async () => {
    const { data, error } = await supabase
      .from('locations')
      .select('id, name')
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (error) throw error;
    setLocations(data || []);
    if (!selectedLocationId && data && data.length > 0) {
      setSelectedLocationId(data[0].id);
    }
  }, [selectedLocationId]);

  const fetchDoctors = useCallback(async (locationId: string) => {
    const { data, error } = await supabase
      .from('doctors')
      .select('id, full_name, specialty, location_id')
      .eq('is_active', true)
      .eq('location_id', locationId)
      .order('full_name', { ascending: true });
    if (error) throw error;
    setDoctors(data || []);
  }, []);

  const fetchPatients = useCallback(async () => {
    const { data, error } = await supabase
      .from('patients')
      .select('id, first_name, last_name, phone')
      .order('first_name', { ascending: true });
    if (error) throw error;
    setPatients(data || []);
  }, []);

  const fetchTreatments = useCallback(async () => {
    const { data, error } = await supabase
      .from('treatments')
      .select('id, name')
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (error) throw error;
    setTreatments(data || []);
  }, []);

  const fetchAppointments = useCallback(async (locationId: string) => {
    const { data, error } = await supabase
      .from('appointments')
      .select('*, patients(first_name, last_name, phone), doctors(full_name)')
      .eq('location_id', locationId)
      .order('start_time', { ascending: true });
    if (error) throw error;
    setAppointments((data || []) as Appointment[]);
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      await fetchLocations();
      const locId = selectedLocationId || (locations[0]?.id ?? '');
      if (!locId) return;
      await Promise.all([
        fetchDoctors(locId),
        fetchPatients(),
        fetchTreatments(),
        fetchAppointments(locId),
      ]);
    } catch (err) {
      console.error('Error fetching agenda data:', err);
      toast.error('Error al cargar la agenda');
    } finally {
      setLoading(false);
    }
  }, [fetchLocations, fetchDoctors, fetchPatients, fetchTreatments, fetchAppointments, selectedLocationId, locations]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Refetch when location changes
  useEffect(() => {
    if (selectedLocationId) {
      fetchDoctors(selectedLocationId);
      fetchAppointments(selectedLocationId);
    }
  }, [selectedLocationId, fetchDoctors, fetchAppointments]);

  // Prepare columns per doctor
  const todaysAppointmentsByDoctor = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    doctors.forEach(d => { map[d.id] = []; });
    appointments.forEach(apt => {
      if (isSameDay(new Date(apt.start_time), selectedDate) && apt.doctor_id) {
        if (!map[apt.doctor_id]) map[apt.doctor_id] = [];
        map[apt.doctor_id].push(apt);
      }
    });
    return map;
  }, [appointments, doctors, selectedDate]);

  const doctorColor = useCallback((idx: number) => doctorColors[idx % doctorColors.length], []);

  const resetForm = useCallback(() => {
    setCreationType('medical');
    setSelectedDoctorId('');
    setPatientId('');
    setQuickPatientName('');
    setQuickPatientPhone('');
    setTitle('');
    setTreatmentId('');
    setDescription('');
    setAppointmentDate(format(selectedDate, 'yyyy-MM-dd'));
    setStartTime('09:00');
    setEndTime('10:00');
    setStatus('confirmed');
  }, [selectedDate]);

  const openCreateForDoctor = useCallback((doctorId: string) => {
    setSelectedDoctorId(doctorId);
    setAppointmentDate(format(selectedDate, 'yyyy-MM-dd'));
    setIsDialogOpen(true);
  }, [selectedDate]);

  const createQuickPatientIfNeeded = useCallback(async (): Promise<string | null> => {
    if (patientId) return patientId;
    if (!quickPatientName.trim() || !quickPatientPhone.trim()) return null;
    const nameParts = quickPatientName.trim().split(' ');
    const firstName = nameParts.shift() || '';
    const lastName = nameParts.join(' ');
    const { data, error } = await supabase
      .from('patients')
      .insert({
        first_name: firstName,
        last_name: lastName || '',
        phone: quickPatientPhone.replace(/\D/g, ''),
      })
      .select('id')
      .single();
    if (error) throw error;
    return data?.id || null;
  }, [patientId, quickPatientName, quickPatientPhone]);

  const hasPersonalBlockOverlap = useCallback((doctorId: string, startISO: string, endISO: string) => {
    const s = new Date(startISO).getTime();
    const e = new Date(endISO).getTime();
    return appointments.some(apt => {
      if (apt.type !== 'personal' || apt.doctor_id !== doctorId) return false;
      const as = new Date(apt.start_time).getTime();
      const ae = new Date(apt.end_time).getTime();
      return isSameDay(new Date(apt.start_time), new Date(startISO)) && Math.max(s, as) < Math.min(e, ae);
    });
  }, [appointments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !selectedLocationId) return;

    setSaving(true);
    try {
      const startDateTime = new Date(`${appointmentDate}T${startTime}`);
      const endDateTime = new Date(`${appointmentDate}T${endTime}`);
      if (!selectedDoctorId) {
        toast.error('Selecciona un doctor (columna)'); 
        setSaving(false); 
        return;
      }
      if (endDateTime <= startDateTime) {
        toast.error('La hora de fin debe ser mayor a la de inicio');
        setSaving(false);
        return;
      }

      if (creationType === 'medical') {
        const finalPatientId = await createQuickPatientIfNeeded();
        if (!finalPatientId) {
          toast.error('Selecciona un paciente o usa registro rápido');
          setSaving(false);
          return;
        }

        if (hasPersonalBlockOverlap(selectedDoctorId, startDateTime.toISOString(), endDateTime.toISOString())) {
          toast.error('Este horario está bloqueado por un evento personal');
          setSaving(false);
          return;
        }

        const { error } = await supabase
          .from('appointments')
          .insert({
            user_id: user.id,
            patient_id: finalPatientId,
            doctor_id: selectedDoctorId,
            title: title.trim() || 'Consulta',
            description: description.trim() || null,
            treatment_type: treatmentId ? (treatments.find(t => t.id === treatmentId)?.name || '') : null,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            status, // confirmed | cancelled | rescheduled | noshow | postponed
            type: 'medical',
            patient_data_status: patientId ? 'complete' : 'pending',
            location_id: selectedLocationId,
          });

        if (error) throw error;
        toast.success('Cita creada');
      } else {
        // Personal event (agenda block)
        const { error } = await supabase
          .from('appointments')
          .insert({
            user_id: user.id,
            patient_id: null,
            doctor_id: selectedDoctorId,
            title: title.trim() || 'Bloqueo de agenda',
            description: description.trim() || null,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            status: 'confirmed',
            treatment_type: null,
            type: 'personal',
            patient_data_status: 'complete',
            location_id: selectedLocationId,
          });

        if (error) throw error;
        toast.success('Bloqueo agregado');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchAppointments(selectedLocationId);
    } catch (error) {
      console.error('Error creando elemento:', error);
      toast.error('Error al crear');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = useCallback(async (id: string, statusValue: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: statusValue })
        .eq('id', id);

      if (error) throw error;
      
      setAppointments(prev => prev.map(apt => apt.id === id ? { ...apt, status: statusValue } : apt));
      toast.success('Estado actualizado');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Error al actualizar');
    }
  }, []);

  const todaysAppointments = useMemo(() => 
    appointments.filter(apt => isSameDay(new Date(apt.start_time), selectedDate)
  ), [appointments, selectedDate]);

  const getStatusStyle = (statusVal: string) => {
    switch (statusVal) {
      case 'confirmed': return 'bg-ios-green/15 text-ios-green';
      case 'rescheduled': return 'bg-ios-purple/15 text-ios-purple';
      case 'noshow': return 'bg-ios-red/15 text-ios-red';
      case 'postponed': return 'bg-ios-orange/15 text-ios-orange';
      case 'cancelled': return 'bg-ios-gray-200 text-ios-gray-600';
      default: return 'bg-ios-orange/15 text-ios-orange';
    }
  };

  const buildWhatsAppLink = (apt: Appointment) => {
    const phone = (apt.patients?.phone || '').replace(/\D/g, '');
    if (!phone || phone.length < 10) return null;
    const msg = `Hola ${apt.patients?.first_name || ''}, te recordamos tu cita en Denttia el ${format(new Date(apt.start_time), "d 'de' MMMM 'a las' HH:mm", { locale: es })}. Ubicación: ${locations.find(l => l.id === selectedLocationId)?.name || ''}. Cualquier duda, WhatsApp: https://wa.me/52${phone}`;
    return `https://wa.me/52${phone}?text=${encodeURIComponent(msg)}`;
  };

  // Realtime suscriptions for live updates
  useEffect(() => {
    const channel = supabase
      .channel('agenda-appointments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        if (selectedLocationId) fetchAppointments(selectedLocationId);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedLocationId, fetchAppointments]);

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">Agenda</h1>
          <p className="text-ios-gray-500 mt-1 font-medium">Gestión por sede y doctor</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
            <SelectTrigger className="w-[180px] h-11 rounded-2xl bg-white border-0 shadow-ios-sm">
              <SelectValue placeholder="Sede" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {locations.map(loc => (
                <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button 
            onClick={() => { resetForm(); setIsDialogOpen(true); }}
            className="flex items-center gap-2 h-11 px-5 rounded-2xl bg-ios-blue text-white font-semibold text-sm shadow-ios-sm hover:bg-ios-blue/90 transition-all duration-200 touch-feedback"
          >
            <Plus className="h-5 w-5" />
            Nuevo
          </button>
        </div>
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
          <div className="flex items-center justify-between mt-4">
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
        </div>

        {/* Time blocking by doctor */}
        <div className="lg:col-span-2 ios-card p-5 animate-slide-up" style={{ animationDelay: '100ms' }}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-ios-blue" />
            </div>
          ) : doctors.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {doctors.map((doc, idx) => {
                const color = doctorColor(idx);
                const list = todaysAppointmentsByDoctor[doc.id] || [];
                return (
                  <div key={doc.id} className="rounded-2xl border border-ios-gray-200 overflow-hidden">
                    <div className={cn("p-3 flex items-center justify-between", `${color}`)}>
                      <div className="flex items-center gap-2 text-white">
                        <Stethoscope className="h-4 w-4" />
                        <p className="font-semibold">{doc.full_name}</p>
                      </div>
                      <button
                        onClick={() => openCreateForDoctor(doc.id)}
                        className="h-9 px-3 rounded-xl bg-white/20 text-white text-xs font-semibold hover:bg-white/30 transition-colors"
                      >
                        Agregar bloque
                      </button>
                    </div>
                    <div className="p-3 space-y-2">
                      {list.length > 0 ? list.map((apt) => (
                        <div key={apt.id} className={cn(
                          "p-3 rounded-xl flex items-center justify-between gap-3",
                          apt.type === 'personal' ? 'bg-ios-gray-100 border border-ios-gray-200' : 'bg-ios-blue/5 border border-ios-blue/20'
                        )}>
                          <div className="min-w-[70px] text-center">
                            <p className="text-base font-bold text-ios-gray-900">
                              {format(new Date(apt.start_time), 'HH:mm')}
                            </p>
                            <p className="text-xs text-ios-gray-500">
                              {format(new Date(apt.end_time), 'HH:mm')}
                            </p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-ios-gray-900 truncate">
                              {apt.type === 'personal' ? (apt.title || 'Bloqueo') : apt.title}
                            </p>
                            {apt.type === 'medical' && (
                              <p className="text-sm text-ios-gray-500 truncate flex items-center gap-1">
                                <User className="h-3.5 w-3.5" />
                                {apt.patients?.first_name} {apt.patients?.last_name}
                              </p>
                            )}
                          </div>
                          {apt.type === 'medical' ? (
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
                                <SelectItem value="confirmed">Confirmada</SelectItem>
                                <SelectItem value="rescheduled">Reagendada</SelectItem>
                                <SelectItem value="cancelled">Cancelada</SelectItem>
                                <SelectItem value="noshow">No vino</SelectItem>
                                <SelectItem value="postponed">Pospuso</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="px-3 py-1.5 rounded-full text-xs font-semibold bg-ios-gray-200 text-ios-gray-700">
                              Evento personal
                            </div>
                          )}
                          {apt.type === 'medical' && buildWhatsAppLink(apt) && (
                            <a
                              href={buildWhatsAppLink(apt) as string}
                              target="_blank"
                              rel="noreferrer"
                              className="h-9 w-9 rounded-xl bg-ios-green/10 flex items-center justify-center hover:bg-ios-green/20 transition-colors touch-feedback"
                              title="Recordatorio por WhatsApp"
                            >
                              <MessageSquareText className="h-4 w-4 text-ios-green" />
                            </a>
                          )}
                        </div>
                      )) : (
                        <div className="p-4 rounded-xl bg-ios-gray-50 text-center text-sm text-ios-gray-500">
                          Sin bloques para este día
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="h-20 w-20 rounded-full bg-ios-gray-100 flex items-center justify-center mx-auto mb-4">
                <ShieldBan className="h-10 w-10 text-ios-gray-400" />
              </div>
              <p className="text-ios-gray-900 font-semibold">Sin doctores en esta sede</p>
              <p className="text-ios-gray-500 text-sm mt-1">Selecciona otra sede</p>
            </div>
          )}
        </div>
      </div>

      {/* Dual Creation Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-[560px] rounded-3xl border-0 shadow-ios-xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="text-xl font-bold text-ios-gray-900">Nuevo bloque</DialogTitle>
            <DialogDescription className="text-ios-gray-500">
              Crea una cita médica o un evento personal
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit}>
            <div className="px-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-ios-gray-600">Tipo</Label>
                  <Select value={creationType} onValueChange={(v: any) => setCreationType(v)}>
                    <SelectTrigger className="ios-input">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="medical">Cita médica</SelectItem>
                      <SelectItem value="personal">Evento personal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-ios-gray-600">Doctor *</Label>
                  <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                    <SelectTrigger className="ios-input">
                      <SelectValue placeholder="Seleccionar doctor" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {doctors.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {creationType === 'medical' ? (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-ios-gray-600">Paciente</Label>
                    <Select value={patientId} onValueChange={setPatientId}>
                      <SelectTrigger className="ios-input">
                        <SelectValue placeholder="Buscar paciente" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl max-h-[220px]">
                        {patients.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.first_name} {p.last_name} {p.phone ? `· ${p.phone}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-ios-gray-500">o registro rápido</div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        value={quickPatientName}
                        onChange={(e) => setQuickPatientName(e.target.value)}
                        placeholder="Nombre completo"
                        className="ios-input"
                      />
                      <input
                        value={quickPatientPhone}
                        onChange={(e) => setQuickPatientPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="Celular (10 dígitos)"
                        className="ios-input"
                        maxLength={10}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-ios-gray-600">Tratamiento</Label>
                      <Select value={treatmentId} onValueChange={setTreatmentId}>
                        <SelectTrigger className="ios-input">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl max-h-[220px]">
                          {treatments.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-ios-gray-600">Motivo / Título</Label>
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ej: Limpieza dental"
                        className="ios-input"
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
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-ios-gray-600">Estado</Label>
                    <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                      <SelectTrigger className="ios-input">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="confirmed">Confirmada</SelectItem>
                        <SelectItem value="rescheduled">Reagendada</SelectItem>
                        <SelectItem value="cancelled">Cancelada</SelectItem>
                        <SelectItem value="noshow">No vino</SelectItem>
                        <SelectItem value="postponed">Pospuso</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-ios-gray-600">Motivo del bloque</Label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ej: Comida, Banco, Vacaciones"
                      className="ios-input"
                    />
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
                </>
              )}

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
                  creationType === 'medical' ? 'Crear Cita' : 'Crear Bloque'
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