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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CLINIC_CONFIG, generateWhatsAppLink, generateAppointmentReminder } from '@/config/clinic';
import { 
  Plus, Clock, User, Calendar as CalendarIcon, ChevronLeft, ChevronRight, 
  Loader2, MapPin, Phone, MessageCircle, Search, UserPlus, Coffee, X,
  Check, XCircle, RotateCcw, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays, subDays, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Appointment {
  id: string;
  patient_id: string | null;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  status: string;
  treatment_type: string;
  type: 'medical' | 'personal';
  location_id: string | null;
  patient_data_status: string;
  patients?: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
  };
}

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
}

interface Location {
  id: string;
  name: string;
  is_active: boolean;
}

interface Treatment {
  id: string;
  name: string;
  duration_minutes: number;
  base_price: number;
}

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Agendada', icon: Clock, color: 'text-ios-orange' },
  { value: 'confirmed', label: 'Confirmada', icon: Check, color: 'text-ios-green' },
  { value: 'in-progress', label: 'En Progreso', icon: Loader2, color: 'text-ios-blue' },
  { value: 'completed', label: 'Completada', icon: Check, color: 'text-ios-gray-500' },
  { value: 'cancelled', label: 'Cancelada', icon: XCircle, color: 'text-ios-red' },
  { value: 'rescheduled', label: 'Reagendada', icon: RotateCcw, color: 'text-ios-purple' },
  { value: 'noshow', label: 'No Vino', icon: AlertTriangle, color: 'text-ios-red' },
  { value: 'postponed', label: 'Pospuso', icon: Clock, color: 'text-ios-orange' },
];

const TIME_SLOTS = Array.from({ length: 26 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8;
  const minutes = (i % 2) * 30;
  return `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}).filter(time => {
  const hour = parseInt(time.split(':')[0]);
  return hour >= 8 && hour < 21;
});

const Agenda = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [appointmentType, setAppointmentType] = useState<'medical' | 'personal'>('medical');
  const [patientSearch, setPatientSearch] = useState('');
  const [showQuickRegister, setShowQuickRegister] = useState(false);
  
  // Form states for medical appointment
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedTreatmentId, setSelectedTreatmentId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [status, setStatus] = useState('scheduled');
  
  // Quick register states
  const [quickFirstName, setQuickFirstName] = useState('');
  const [quickLastName, setQuickLastName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  
  // Personal event states
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [appointmentsResult, patientsResult, locationsResult, treatmentsResult] = await Promise.all([
        supabase
          .from('appointments')
          .select('*, patients(id, first_name, last_name, phone)')
          .order('start_time', { ascending: true }),
        supabase
          .from('patients')
          .select('id, first_name, last_name, phone')
          .order('first_name', { ascending: true }),
        supabase
          .from('locations')
          .select('*')
          .eq('is_active', true)
          .order('name', { ascending: true }),
        supabase
          .from('treatments')
          .select('id, name, duration_minutes, base_price')
          .eq('is_active', true)
          .order('name', { ascending: true })
      ]);

      if (appointmentsResult.error) throw appointmentsResult.error;
      if (patientsResult.error) throw patientsResult.error;
      if (locationsResult.error) throw locationsResult.error;
      if (treatmentsResult.error) throw treatmentsResult.error;

      setAppointments(appointmentsResult.data || []);
      setPatients(patientsResult.data || []);
      setLocations(locationsResult.data || []);
      setTreatments(treatmentsResult.data || []);
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

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('agenda-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const resetForm = useCallback(() => {
    setSelectedPatientId('');
    setSelectedTreatmentId('');
    setTitle('');
    setDescription('');
    setAppointmentDate(format(new Date(), 'yyyy-MM-dd'));
    setStartTime('09:00');
    setEndTime('10:00');
    setStatus('scheduled');
    setPatientSearch('');
    setShowQuickRegister(false);
    setQuickFirstName('');
    setQuickLastName('');
    setQuickPhone('');
    setEventTitle('');
    setEventDescription('');
    setAppointmentType('medical');
  }, []);

  const handleQuickRegister = async () => {
    if (!quickFirstName.trim() || !quickPhone.trim()) {
      toast.error('Nombre y teléfono son requeridos');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('patients')
        .insert({
          user_id: user?.id,
          first_name: quickFirstName.trim(),
          last_name: quickLastName.trim(),
          phone: quickPhone.trim()
        })
        .select()
        .single();

      if (error) throw error;

      setPatients(prev => [...prev, data]);
      setSelectedPatientId(data.id);
      setPatientSearch(`${data.first_name} ${data.last_name}`);
      setShowQuickRegister(false);
      setQuickFirstName('');
      setQuickLastName('');
      setQuickPhone('');
      toast.success('Paciente registrado');
    } catch (error) {
      console.error('Error registering patient:', error);
      toast.error('Error al registrar paciente');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    if (appointmentType === 'medical') {
      if (!selectedPatientId) {
        toast.error('Selecciona un paciente');
        return;
      }
      if (!title.trim()) {
        toast.error('Ingresa el motivo de la cita');
        return;
      }
    } else {
      if (!eventTitle.trim()) {
        toast.error('Ingresa el motivo del evento');
        return;
      }
    }

    setSaving(true);
    try {
      const startDateTime = new Date(`${appointmentDate}T${startTime}`);
      const endDateTime = new Date(`${appointmentDate}T${endTime}`);

      const appointmentData = {
        user_id: user.id,
        patient_id: appointmentType === 'medical' ? selectedPatientId : null,
        title: appointmentType === 'medical' ? title.trim() : eventTitle.trim(),
        description: appointmentType === 'medical' ? description.trim() : eventDescription.trim(),
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        status: appointmentType === 'medical' ? status : 'confirmed',
        type: appointmentType,
        location_id: selectedLocation !== 'all' ? selectedLocation : null,
        patient_data_status: 'complete'
      };

      const { error } = await supabase
        .from('appointments')
        .insert(appointmentData);

      if (error) throw error;
      
      toast.success(appointmentType === 'medical' ? 'Cita creada' : 'Evento creado');
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error creating appointment:', error);
      toast.error('Error al crear');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = useCallback(async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      
      setAppointments(prev => 
        prev.map(apt => apt.id === id ? { ...apt, status: newStatus } : apt)
      );
      toast.success('Estado actualizado');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Error al actualizar');
    }
  }, []);

  const sendWhatsAppReminder = useCallback((appointment: Appointment) => {
    if (!appointment.patients?.phone) {
      toast.error('El paciente no tiene teléfono registrado');
      return;
    }

    const patientName = `${appointment.patients.first_name} ${appointment.patients.last_name}`;
    const date = format(new Date(appointment.start_time), "EEEE d 'de' MMMM", { locale: es });
    const time = format(new Date(appointment.start_time), 'HH:mm');
    
    const message = generateAppointmentReminder(
      patientName,
      date,
      time,
      'Dr. Denttia',
      appointment.title
    );

    const phoneNumber = appointment.patients.phone.replace(/\D/g, '');
    const fullPhone = phoneNumber.startsWith('52') ? phoneNumber : `52${phoneNumber}`;
    const link = generateWhatsAppLink(message, fullPhone);
    
    window.open(link, '_blank');
  }, []);

  // Filter appointments by date and location
  const filteredAppointments = useMemo(() => {
    return appointments.filter(apt => {
      const sameDay = isSameDay(new Date(apt.start_time), selectedDate);
      const matchesLocation = selectedLocation === 'all' || apt.location_id === selectedLocation;
      return sameDay && matchesLocation;
    });
  }, [appointments, selectedDate, selectedLocation]);

  // Filter patients by search
  const filteredPatients = useMemo(() => {
    if (!patientSearch) return patients.slice(0, 10);
    const search = patientSearch.toLowerCase();
    return patients.filter(p => 
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(search) ||
      p.phone?.includes(patientSearch)
    ).slice(0, 10);
  }, [patients, patientSearch]);

  const getStatusStyle = (statusValue: string) => {
    switch (statusValue) {
      case 'confirmed': return 'bg-ios-green/15 text-ios-green';
      case 'in-progress': return 'bg-ios-blue/15 text-ios-blue';
      case 'completed': return 'bg-ios-gray-200 text-ios-gray-600';
      case 'cancelled': 
      case 'noshow': return 'bg-ios-red/15 text-ios-red';
      case 'rescheduled':
      case 'postponed': return 'bg-ios-purple/15 text-ios-purple';
      default: return 'bg-ios-orange/15 text-ios-orange';
    }
  };

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">Agenda</h1>
          <p className="text-ios-gray-500 mt-1 font-medium">Gestiona las citas de la clínica</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Location Selector */}
          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger className="w-[180px] h-11 rounded-xl bg-white border-0 shadow-ios-sm">
              <MapPin className="h-4 w-4 mr-2 text-ios-gray-500" />
              <SelectValue placeholder="Todas las sedes" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Todas las sedes</SelectItem>
              {locations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <button 
            onClick={() => setIsDialogOpen(true)}
            className="flex items-center gap-2 h-11 px-5 rounded-xl bg-ios-blue text-white font-semibold text-sm shadow-ios-sm hover:bg-ios-blue/90 transition-all duration-200 touch-feedback"
          >
            <Plus className="h-5 w-5" />
            Nuevo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
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
          
          {/* Clinic Info */}
          <div className="mt-4 pt-4 border-t border-ios-gray-100">
            <p className="text-xs text-ios-gray-500 font-medium mb-2">Horarios de atención</p>
            <p className="text-xs text-ios-gray-600">{CLINIC_CONFIG.scheduleText.weekdays}</p>
            <p className="text-xs text-ios-gray-600">{CLINIC_CONFIG.scheduleText.saturday}</p>
            <p className="text-xs text-ios-gray-600">{CLINIC_CONFIG.scheduleText.sunday}</p>
          </div>
        </div>

        {/* Day View */}
        <div className="lg:col-span-3 ios-card overflow-hidden animate-slide-up" style={{ animationDelay: '100ms' }}>
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
          <div className="p-3 max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-ios-blue" />
              </div>
            ) : filteredAppointments.length > 0 ? (
              <div className="space-y-2">
                {filteredAppointments.map((apt, index) => (
                  <div
                    key={apt.id}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-2xl transition-all duration-200 ease-ios animate-fade-in",
                      apt.type === 'personal' 
                        ? 'bg-ios-gray-100 border-2 border-dashed border-ios-gray-300' 
                        : 'hover:bg-ios-gray-50'
                    )}
                    style={{ animationDelay: `${150 + index * 50}ms` }}
                  >
                    {/* Time */}
                    <div className="text-center min-w-[70px]">
                      <p className="text-lg font-bold text-ios-gray-900">
                        {format(new Date(apt.start_time), 'HH:mm')}
                      </p>
                      <p className="text-xs text-ios-gray-500">
                        {format(new Date(apt.end_time), 'HH:mm')}
                      </p>
                    </div>
                    
                    {/* Color bar */}
                    <div className={cn(
                      "h-12 w-1 rounded-full",
                      apt.type === 'personal' ? 'bg-ios-gray-400' : 'bg-ios-blue'
                    )}></div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-ios-gray-900">{apt.title}</p>
                        {apt.type === 'personal' && (
                          <span className="px-2 py-0.5 rounded-full bg-ios-gray-200 text-ios-gray-600 text-xs font-medium">
                            <Coffee className="h-3 w-3 inline mr-1" />
                            Personal
                          </span>
                        )}
                        {apt.patient_data_status === 'pending' && (
                          <span className="px-2 py-0.5 rounded-full bg-ios-orange/15 text-ios-orange text-xs font-medium">
                            Datos Pendientes
                          </span>
                        )}
                      </div>
                      {apt.type !== 'personal' && apt.patients && (
                        <p className="text-sm text-ios-gray-500 flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          {apt.patients.first_name} {apt.patients.last_name}
                          {apt.patients.phone && (
                            <span className="ml-2 flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {apt.patients.phone}
                            </span>
                          )}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    {apt.type !== 'personal' && (
                      <>
                        {/* WhatsApp Button */}
                        <button
                          onClick={() => sendWhatsAppReminder(apt)}
                          className="h-9 w-9 rounded-xl bg-ios-green/10 flex items-center justify-center hover:bg-ios-green/20 transition-colors touch-feedback"
                          title="Enviar recordatorio por WhatsApp"
                        >
                          <MessageCircle className="h-4 w-4 text-ios-green" />
                        </button>

                        {/* Status Selector */}
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
                            {STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                <span className={cn("flex items-center gap-2", option.color)}>
                                  <option.icon className="h-3 w-3" />
                                  {option.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    )}
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

      {/* Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-[550px] rounded-3xl border-0 shadow-ios-xl p-0 overflow-hidden max-h-[90vh]">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="text-xl font-bold text-ios-gray-900">¿Qué deseas crear?</DialogTitle>
            <DialogDescription className="text-ios-gray-500">
              Selecciona el tipo de evento para la agenda
            </DialogDescription>
          </DialogHeader>
          
          <Tabs value={appointmentType} onValueChange={(v) => setAppointmentType(v as 'medical' | 'personal')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mx-6 mb-4" style={{ width: 'calc(100% - 48px)' }}>
              <TabsTrigger value="medical" className="rounded-xl">
                <User className="h-4 w-4 mr-2" />
                Cita Médica
              </TabsTrigger>
              <TabsTrigger value="personal" className="rounded-xl">
                <Coffee className="h-4 w-4 mr-2" />
                Evento Personal
              </TabsTrigger>
            </TabsList>

            <form onSubmit={handleSubmit}>
              <div className="px-6 space-y-4 max-h-[50vh] overflow-y-auto">
                <TabsContent value="medical" className="mt-0 space-y-4">
                  {/* Patient Search */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-ios-gray-600">Paciente *</Label>
                    {!showQuickRegister ? (
                      <>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ios-gray-400" />
                          <input
                            type="text"
                            value={patientSearch}
                            onChange={(e) => setPatientSearch(e.target.value)}
                            placeholder="Buscar paciente..."
                            className="ios-input pl-10"
                          />
                        </div>
                        
                        {patientSearch && (
                          <div className="border border-ios-gray-200 rounded-xl max-h-40 overflow-y-auto">
                            {filteredPatients.length > 0 ? (
                              filteredPatients.map((patient) => (
                                <button
                                  key={patient.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedPatientId(patient.id);
                                    setPatientSearch(`${patient.first_name} ${patient.last_name}`);
                                  }}
                                  className={cn(
                                    "w-full p-3 text-left hover:bg-ios-gray-50 transition-colors flex items-center justify-between",
                                    selectedPatientId === patient.id && "bg-ios-blue/10"
                                  )}
                                >
                                  <div>
                                    <p className="font-medium text-ios-gray-900">
                                      {patient.first_name} {patient.last_name}
                                    </p>
                                    {patient.phone && (
                                      <p className="text-xs text-ios-gray-500">{patient.phone}</p>
                                    )}
                                  </div>
                                  {selectedPatientId === patient.id && (
                                    <Check className="h-4 w-4 text-ios-blue" />
                                  )}
                                </button>
                              ))
                            ) : (
                              <div className="p-3 text-center text-ios-gray-500 text-sm">
                                No se encontraron pacientes
                              </div>
                            )}
                          </div>
                        )}
                        
                        <button
                          type="button"
                          onClick={() => setShowQuickRegister(true)}
                          className="flex items-center gap-2 text-ios-blue font-semibold text-sm hover:opacity-70 transition-opacity"
                        >
                          <UserPlus className="h-4 w-4" />
                          Registro rápido de paciente nuevo
                        </button>
                      </>
                    ) : (
                      <div className="p-4 rounded-xl bg-ios-blue/5 border border-ios-blue/20 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-ios-blue text-sm">Registro Rápido</p>
                          <button
                            type="button"
                            onClick={() => setShowQuickRegister(false)}
                            className="h-6 w-6 rounded-full bg-ios-gray-200 flex items-center justify-center"
                          >
                            <X className="h-3 w-3 text-ios-gray-600" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            value={quickFirstName}
                            onChange={(e) => setQuickFirstName(e.target.value)}
                            placeholder="Nombre *"
                            className="ios-input text-sm"
                          />
                          <input
                            value={quickLastName}
                            onChange={(e) => setQuickLastName(e.target.value)}
                            placeholder="Apellidos"
                            className="ios-input text-sm"
                          />
                        </div>
                        <input
                          value={quickPhone}
                          onChange={(e) => setQuickPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          placeholder="Teléfono (10 dígitos) *"
                          className="ios-input text-sm"
                        />
                        <button
                          type="button"
                          onClick={handleQuickRegister}
                          className="w-full h-10 rounded-xl bg-ios-blue text-white font-semibold text-sm"
                        >
                          Registrar y Seleccionar
                        </button>
                        <p className="text-xs text-ios-orange">
                          ⚠️ El expediente quedará marcado como "Datos Pendientes"
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Treatment */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-ios-gray-600">Tratamiento</Label>
                    <Select value={selectedTreatmentId} onValueChange={(value) => {
                      setSelectedTreatmentId(value);
                      const treatment = treatments.find(t => t.id === value);
                      if (treatment) {
                        setTitle(treatment.name);
                      }
                    }}>
                      <SelectTrigger className="ios-input">
                        <SelectValue placeholder="Seleccionar tratamiento" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl max-h-[200px]">
                        {treatments.map((treatment) => (
                          <SelectItem key={treatment.id} value={treatment.id}>
                            {treatment.name} - ${treatment.base_price}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Title */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-ios-gray-600">Motivo de la cita *</Label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ej: Limpieza dental, Revisión..."
                      required
                      className="ios-input"
                    />
                  </div>

                  {/* Status */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-ios-gray-600">Estado</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger className="ios-input">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <span className={cn("flex items-center gap-2", option.color)}>
                              <option.icon className="h-4 w-4" />
                              {option.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                <TabsContent value="personal" className="mt-0 space-y-4">
                  <div className="p-4 rounded-xl bg-ios-gray-50 border border-ios-gray-200">
                    <div className="flex items-center gap-2 text-ios-gray-600 mb-2">
                      <Coffee className="h-5 w-5" />
                      <p className="font-semibold">Bloqueo de Agenda</p>
                    </div>
                    <p className="text-sm text-ios-gray-500">
                      Usa esto para comidas, trámites, vacaciones u otros eventos personales.
                      Este bloque no permitirá agendar citas médicas encima.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-ios-gray-600">Motivo *</Label>
                    <input
                      value={eventTitle}
                      onChange={(e) => setEventTitle(e.target.value)}
                      placeholder="Ej: Comida, Banco, Vacaciones..."
                      required
                      className="ios-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-ios-gray-600">Notas adicionales</Label>
                    <textarea
                      value={eventDescription}
                      onChange={(e) => setEventDescription(e.target.value)}
                      rows={2}
                      className="ios-input resize-none"
                    />
                  </div>
                </TabsContent>

                {/* Common fields: Date and Time */}
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-ios-gray-100">
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
                    <Select value={startTime} onValueChange={setStartTime}>
                      <SelectTrigger className="ios-input text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl max-h-[200px]">
                        {TIME_SLOTS.map((time) => (
                          <SelectItem key={time} value={time}>{time}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-ios-gray-600">Fin</Label>
                    <Select value={endTime} onValueChange={setEndTime}>
                      <SelectTrigger className="ios-input text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl max-h-[200px]">
                        {TIME_SLOTS.map((time) => (
                          <SelectItem key={time} value={time}>{time}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Notes for medical */}
                {appointmentType === 'medical' && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-ios-gray-600">Notas adicionales</Label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      className="ios-input resize-none"
                    />
                  </div>
                )}
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
                    appointmentType === 'medical' ? 'Crear Cita' : 'Crear Evento'
                  )}
                </button>
              </div>
            </form>
          </Tabs>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Agenda;