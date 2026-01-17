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
  Check, XCircle, RotateCcw, AlertTriangle, LayoutList, LayoutGrid
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
  doctor_id: string | null;
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
  commission_percentage?: number;
  commission_type?: 'percent' | 'fixed';
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
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedLocation, setSelectedLocation] = useState<string>('9b8f816c-34ee-4967-a5a2-69af15e48f7d'); // Default: Tehuacán
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [appointmentType, setAppointmentType] = useState<'medical' | 'personal'>('medical');
  const [patientSearch, setPatientSearch] = useState('');
  const [showQuickRegister, setShowQuickRegister] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
  const [showCalendar, setShowCalendar] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);

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
  const [formLocationId, setFormLocationId] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [appointmentsResult, patientsResult, locationsResult, treatmentsResult, doctorsResult] = await Promise.all([
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
          .select('id, name, duration_minutes, base_price, commission_percentage, commission_type')
          .eq('is_active', true)
          .order('name', { ascending: true }),
        supabase
          .from('doctors')
          .select('id, full_name, color')
          .eq('is_active', true)
          .order('full_name', { ascending: true })
      ]);

      if (appointmentsResult.error) throw appointmentsResult.error;
      if (patientsResult.error) throw patientsResult.error;
      if (locationsResult.error) throw locationsResult.error;
      if (treatmentsResult.error) throw treatmentsResult.error;
      if (doctorsResult.error) throw doctorsResult.error;

      setAppointments(appointmentsResult.data || []);
      setPatients(patientsResult.data || []);
      setLocations(locationsResult.data || []);
      setTreatments(treatmentsResult.data || []);
      setDoctors(doctorsResult.data || []);
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
    setSelectedDoctorId('');
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
    setFormLocationId('');
    setAppointmentType('medical');
    setEditingAppointmentId(null);
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
        treatment_type: appointmentType === 'medical' ? selectedTreatmentId : null,
        type: appointmentType,
        location_id: formLocationId || (selectedLocation !== 'all' ? selectedLocation : null),
        patient_data_status: 'complete',
        doctor_id: selectedDoctorId || null
      };

      if (editingAppointmentId) {
        // Update existing appointment
        const { error } = await supabase
          .from('appointments')
          .update(appointmentData)
          .eq('id', editingAppointmentId);

        if (error) throw error;
        toast.success(appointmentType === 'medical' ? 'Cita actualizada' : 'Evento actualizado');
      } else {
        // Create new appointment
        const { error } = await supabase
          .from('appointments')
          .insert(appointmentData);

        if (error) throw error;
        toast.success(appointmentType === 'medical' ? 'Cita creada' : 'Evento creado');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving appointment:', error);
      toast.error('Error al guardar');
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

      // Finance Trigger: If completed, create payment record
      if (newStatus === 'completed') {
        const appointment = appointments.find(a => a.id === id);
        if (appointment && appointment.type === 'medical') {
          // Find price
          let amount = 0;
          if (appointment.treatment_type) {
            const treatment = treatments.find(t => t.id === appointment.treatment_type);
            if (treatment) amount = treatment.base_price;
          } else {
            // Fallback: try to match by title
            const treatment = treatments.find(t => t.name === appointment.title);
            if (treatment) amount = treatment.base_price;
          }

          // Check if payment already exists
          const { data: existing } = await supabase
            .from('payments')
            .select('id')
            .eq('appointment_id', id)
            .single();
          if (!existing) {
            await supabase
              .from('payments')
              .insert({
                appointment_id: id,
                amount: amount,
                status: 'pending', // Pending collection
                patient_id: appointment.patient_id,
                created_at: new Date().toISOString()
              });
            toast.success('Clínica: Cargo enviado a finanzas');
          }


          // Commission Trigger
          if (appointment.doctor_id) {
            let commissionPercentage = 0;
            let commissionAmount = 0;
            let commissionSource = '';

            // 1. Check Treatment Commission
            if (appointment.treatment_type) {
              const treatment = treatments.find(t => t.id === appointment.treatment_type);
              if (treatment?.commission_percentage && treatment.commission_percentage > 0) {
                const type = treatment.commission_type || 'percent';

                if (type === 'percent') {
                  commissionPercentage = treatment.commission_percentage;
                  commissionSource = 'treatment';
                } else {
                  commissionAmount = treatment.commission_percentage;
                  commissionSource = 'treatment_fixed';
                }
              }
            }

            // 2. Check Doctor Global Commission (Fallback)
            if (commissionSource === '') {
              const { data: settings } = await supabase
                .from('commission_settings')
                .select('percentage')
                .eq('doctor_id', appointment.doctor_id)
                .single();

              if (settings?.percentage) {
                commissionPercentage = settings.percentage;
                commissionSource = 'doctor_global';
              }
            }

            if (commissionPercentage > 0 || commissionAmount > 0) {
              if (commissionSource !== 'treatment_fixed') {
                commissionAmount = (amount * commissionPercentage) / 100;
              }

              // Check duplicate commission
              const { data: existingComm } = await supabase
                .from('doctor_commissions')
                .select('id')
                .eq('appointment_id', id)
                .single();

              if (!existingComm) {
                await supabase.from('doctor_commissions').insert({
                  doctor_id: appointment.doctor_id,
                  appointment_id: id,
                  amount: commissionAmount,
                  status: 'pending',
                  created_at: new Date().toISOString()
                });

                const msg = commissionSource === 'treatment_fixed'
                  ? `Comisión fija generada ($${commissionAmount})`
                  : `Comisión generada (${commissionPercentage}%)`;

                toast.success(msg);
              }
            }
          }
        }
      }

      setAppointments(prev =>
        prev.map(apt => apt.id === id ? { ...apt, status: newStatus } : apt)
      );
      toast.success('Estado actualizado');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Error al actualizar');
    }
  }, [appointments, treatments]);

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">Agenda</h1>
          <p className="text-ios-gray-500 mt-1 font-medium">Gestiona las citas de la clínica</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {/* Location Selector */}
          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger className="w-full sm:w-[180px] h-11 rounded-xl bg-white border-0 shadow-ios-sm">
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
            onClick={() => {
              // Pre-fill location if viewing a specific location
              if (selectedLocation !== 'all') {
                setFormLocationId(selectedLocation);
              }
              setIsDialogOpen(true);
            }}
            className="flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-ios-blue text-white font-semibold text-sm shadow-ios-sm hover:bg-ios-blue/90 transition-all duration-200 touch-feedback"
          >
            <Plus className="h-5 w-5" />
            Nuevo
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Horizontal Week Navigation */}
        <div className="ios-card p-4 animate-slide-up" style={{ animationDelay: '50ms' }}>
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setSelectedDate(subDays(selectedDate, 7))}
              className="h-10 w-10 rounded-xl bg-ios-gray-100 flex items-center justify-center hover:bg-ios-gray-200 transition-colors touch-feedback"
            >
              <ChevronLeft className="h-5 w-5 text-ios-gray-600" />
            </button>
            <div className="text-center">
              <p className="text-sm font-medium text-ios-gray-500">
                {format(selectedDate, 'MMMM yyyy', { locale: es })}
              </p>
            </div>
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, 7))}
              className="h-10 w-10 rounded-xl bg-ios-gray-100 flex items-center justify-center hover:bg-ios-gray-200 transition-colors touch-feedback"
            >
              <ChevronRight className="h-5 w-5 text-ios-gray-600" />
            </button>
          </div>

          {/* Week Days Strip */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {Array.from({ length: 7 }, (_, i) => {
              const date = addDays(subDays(selectedDate, selectedDate.getDay()), i);
              const isSelected = isSameDay(date, selectedDate);
              const isToday = isSameDay(date, new Date());
              const dayAppointments = appointments.filter(
                apt => isSameDay(parseISO(apt.start_time), date)
              ).length;

              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(date)}
                  className={cn(
                    "flex-1 min-w-[70px] py-3 px-2 rounded-2xl transition-all duration-300 ease-out touch-feedback relative",
                    isSelected
                      ? "bg-gradient-to-br from-ios-blue to-blue-600 text-white shadow-lg shadow-ios-blue/30 scale-105"
                      : isToday
                        ? "bg-ios-blue/10 text-ios-blue hover:bg-ios-blue/20"
                        : "bg-ios-gray-50 hover:bg-ios-gray-100 text-ios-gray-700"
                  )}
                >
                  <p className={cn(
                    "text-xs font-medium uppercase tracking-wide",
                    isSelected ? "text-white/80" : "text-ios-gray-500"
                  )}>
                    {format(date, 'EEE', { locale: es })}
                  </p>
                  <p className={cn(
                    "text-2xl font-bold mt-1",
                    isSelected ? "text-white" : ""
                  )}>
                    {format(date, 'd')}
                  </p>
                  {dayAppointments > 0 && (
                    <div className={cn(
                      "absolute -top-1 -right-1 h-5 w-5 rounded-full text-xs font-bold flex items-center justify-center",
                      isSelected
                        ? "bg-white text-ios-blue"
                        : "bg-ios-orange text-white"
                    )}>
                      {dayAppointments}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Doctor Filter Chips */}
        {doctors.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide animate-slide-up" style={{ animationDelay: '100ms' }}>
            <button
              onClick={() => setSelectedDoctorId('all')}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                selectedDoctorId === 'all'
                  ? "bg-ios-gray-900 text-white"
                  : "bg-white border border-ios-gray-200 text-ios-gray-600 hover:bg-ios-gray-50"
              )}
            >
              Todos los doctores
            </button>
            {doctors.map((doctor) => (
              <button
                key={doctor.id}
                onClick={() => setSelectedDoctorId(doctor.id)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2",
                  selectedDoctorId === doctor.id
                    ? "text-white shadow-lg"
                    : "bg-white border border-ios-gray-200 text-ios-gray-600 hover:bg-ios-gray-50"
                )}
                style={selectedDoctorId === doctor.id ? { backgroundColor: doctor.color } : {}}
              >
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: selectedDoctorId !== doctor.id ? doctor.color : 'white' }}
                />
                {doctor.full_name}
              </button>
            ))}
          </div>
        )}

        {/* Main Day View - Full Width */}
        <div className="ios-card overflow-hidden animate-slide-up" style={{ animationDelay: '150ms' }}>
          {/* Date Header with View Toggle */}
          <div className="p-5 border-b border-ios-gray-100 bg-gradient-to-r from-ios-gray-50 to-white">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center justify-between md:justify-start gap-4 w-full md:w-auto">
                <button
                  onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                  className="h-9 w-9 rounded-xl bg-white border border-ios-gray-200 flex items-center justify-center hover:bg-ios-gray-50 transition-colors touch-feedback"
                >
                  <ChevronLeft className="h-4 w-4 text-ios-gray-600" />
                </button>
                <div className="text-center md:text-left">
                  <h2 className="text-xl md:text-2xl font-bold text-ios-gray-900 capitalize leading-none">
                    {format(selectedDate, "EEEE", { locale: es })}
                  </h2>
                  <p className="text-ios-gray-500 font-medium text-sm md:text-base mt-1">
                    {format(selectedDate, "d 'de' MMMM, yyyy", { locale: es })}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                  className="h-9 w-9 rounded-xl bg-white border border-ios-gray-200 flex items-center justify-center hover:bg-ios-gray-50 transition-colors touch-feedback"
                >
                  <ChevronRight className="h-4 w-4 text-ios-gray-600" />
                </button>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto">
                {/* Today Button */}
                <button
                  onClick={() => setSelectedDate(new Date())}
                  className="px-4 h-9 rounded-xl bg-ios-blue/10 text-ios-blue text-sm font-semibold hover:bg-ios-blue/20 transition-colors"
                >
                  Hoy
                </button>

                <div className="flex items-center gap-2">
                  {/* Calendar Toggle */}
                  <button
                    onClick={() => setShowCalendar(!showCalendar)}
                    className={cn(
                      "h-9 w-9 rounded-xl flex items-center justify-center transition-colors touch-feedback",
                      showCalendar
                        ? "bg-ios-blue text-white"
                        : "bg-white border border-ios-gray-200 text-ios-gray-600 hover:bg-ios-gray-50"
                    )}
                    title="Mostrar calendario"
                  >
                    <CalendarIcon className="h-4 w-4" />
                  </button>

                  {/* View Toggle */}
                  <div className="flex items-center bg-ios-gray-100 rounded-xl p-1">
                    <button
                      onClick={() => setViewMode('list')}
                      className={cn(
                        "h-7 px-3 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-all",
                        viewMode === 'list'
                          ? "bg-white text-ios-gray-900 shadow-sm"
                          : "text-ios-gray-500 hover:text-ios-gray-700"
                      )}
                    >
                      <LayoutList className="h-3.5 w-3.5" />
                      Lista
                    </button>
                    <button
                      onClick={() => setViewMode('timeline')}
                      className={cn(
                        "h-7 px-3 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-all",
                        viewMode === 'timeline'
                          ? "bg-white text-ios-gray-900 shadow-sm"
                          : "text-ios-gray-500 hover:text-ios-gray-700"
                      )}
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                      Timeline
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Calendar Dropdown */}
            {showCalendar && (
              <div className="mt-4 pt-4 border-t border-ios-gray-100 flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(date);
                      setShowCalendar(false);
                    }
                  }}
                  className="rounded-2xl"
                  locale={es}
                />
              </div>
            )}
          </div>

          {/* Content Area */}
          <div className="p-4">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-ios-blue" />
              </div>
            ) : viewMode === 'list' ? (
              /* LIST VIEW */
              filteredAppointments.length > 0 ? (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {filteredAppointments.map((apt, index) => {
                    const doctorColor = doctors.find(d => d.id === apt.doctor_id)?.color || '#007AFF';
                    const statusOption = STATUS_OPTIONS.find(s => s.value === apt.status);

                    return (
                      <div
                        key={apt.id}
                        className={cn(
                          "group relative rounded-2xl transition-all duration-300 ease-out animate-fade-in overflow-hidden cursor-pointer",
                          apt.type === 'personal'
                            ? 'bg-gradient-to-r from-ios-gray-100 to-ios-gray-50 border-2 border-dashed border-ios-gray-300'
                            : 'bg-white border border-ios-gray-100 hover:border-ios-gray-200 hover:shadow-lg hover:shadow-ios-gray-100/50 hover:scale-[1.01]'
                        )}
                        style={{ animationDelay: `${150 + index * 50}ms` }}
                        onDoubleClick={() => {
                          setEditingAppointmentId(apt.id);
                          setAppointmentType(apt.type);
                          if (apt.type === 'medical') {
                            setTitle(apt.title);
                            setDescription(apt.description || '');
                            setSelectedPatientId(apt.patient_id || '');
                            setSelectedDoctorId(apt.doctor_id || '');
                            setSelectedTreatmentId(apt.treatment_type || '');
                            setFormLocationId(apt.location_id || '');
                            setStatus(apt.status);
                          } else {
                            setEventTitle(apt.title);
                            setEventDescription(apt.description || '');
                            setSelectedDoctorId(apt.doctor_id || '');
                            setFormLocationId(apt.location_id || '');
                          }
                          setAppointmentDate(format(new Date(apt.start_time), 'yyyy-MM-dd'));
                          setStartTime(format(new Date(apt.start_time), 'HH:mm'));
                          setEndTime(format(new Date(apt.end_time), 'HH:mm'));
                          setIsDialogOpen(true);
                        }}
                      >
                        {/* Left color stripe - now shows for personal events too */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl"
                          style={{ backgroundColor: doctorColor }}
                        />

                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 pl-5">
                          <div className="flex items-center gap-4 w-full sm:w-auto flex-1">
                            <div className="text-center min-w-[65px]">
                              <div className={cn(
                                "inline-flex flex-col items-center px-3 py-2 rounded-xl",
                                apt.type === 'personal'
                                  ? "bg-ios-gray-200"
                                  : "bg-gradient-to-br from-ios-gray-50 to-white border border-ios-gray-100"
                              )}>
                                <p className="text-lg font-bold text-ios-gray-900 leading-none">
                                  {format(new Date(apt.start_time), 'HH:mm')}
                                </p>
                                <div className="h-px w-4 bg-ios-gray-300 my-1" />
                                <p className="text-xs text-ios-gray-500 leading-none">
                                  {format(new Date(apt.end_time), 'HH:mm')}
                                </p>
                              </div>
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-ios-gray-900 truncate">{apt.title}</p>
                                {apt.type === 'personal' && (
                                  <span className="px-2 py-0.5 rounded-full bg-ios-gray-300/50 text-ios-gray-600 text-xs font-medium flex items-center gap-1">
                                    <Coffee className="h-3 w-3" />
                                    Personal
                                  </span>
                                )}
                              </div>
                              {apt.type !== 'personal' && apt.patients && (
                                <p className="text-sm text-ios-gray-500 flex items-center gap-1.5 mt-1">
                                  <User className="h-3.5 w-3.5" />
                                  <span className="font-medium">{apt.patients.first_name} {apt.patients.last_name}</span>
                                </p>
                              )}
                            </div>
                          </div>

                          {apt.type !== 'personal' && (
                            <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t sm:border-t-0 border-ios-gray-100 pt-3 sm:pt-0">
                              <button
                                onClick={() => sendWhatsAppReminder(apt)}
                                className="h-10 w-10 rounded-xl bg-ios-green/10 flex items-center justify-center hover:bg-ios-green hover:text-white transition-all touch-feedback"
                              >
                                <MessageCircle className="h-4 w-4 text-ios-green" />
                              </button>
                              <Select value={apt.status} onValueChange={(value) => updateStatus(apt.id, value)}>
                                <SelectTrigger className={cn("w-full sm:w-[130px] h-10 rounded-xl border-0 text-xs font-semibold shadow-sm", getStatusStyle(apt.status))}>
                                  {statusOption && <statusOption.icon className="h-3.5 w-3.5 mr-1.5" />}
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                  {STATUS_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      <span className={cn("flex items-center gap-2", option.color)}>
                                        <option.icon className="h-3.5 w-3.5" />
                                        {option.label}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-ios-blue/10 to-ios-purple/10 flex items-center justify-center mx-auto mb-4">
                    <CalendarIcon className="h-10 w-10 text-ios-blue" />
                  </div>
                  <p className="text-lg font-bold text-ios-gray-900">Día libre</p>
                  <p className="text-ios-gray-500 text-sm mt-1">
                    No hay citas para {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                  </p>
                  <button
                    onClick={() => {
                      if (selectedLocation !== 'all') {
                        setFormLocationId(selectedLocation);
                      }
                      setIsDialogOpen(true);
                    }}
                    className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-ios-blue text-white font-semibold text-sm shadow-lg shadow-ios-blue/30"
                  >
                    <Plus className="h-4 w-4" />
                    Agendar cita
                  </button>
                </div>
              )
            ) : (
              /* TIMELINE VIEW - Time Blocking */
              <div className="relative">
                {/* Time Grid */}
                <div className="flex bg-white">
                  {/* Time Labels - Fixed */}
                  <div className="w-16 flex-shrink-0 border-r border-ios-gray-100 bg-white z-20">
                    {Array.from({ length: 13 }, (_, i) => i + 8).map(hour => (
                      <div key={hour} className="h-16 flex items-start justify-end pr-3 pt-0.5 relative">
                        <span className="text-xs text-ios-gray-400 font-medium sticky left-0">
                          {hour.toString().padStart(2, '0')}:00
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Timeline Grid - Scrollable on mobile */}
                  <div className="flex-1 overflow-x-auto">
                    <div className="relative min-w-[300px] md:min-w-0 h-full">
                      {/* Hour Lines - Clickable for new appointments */}
                      {Array.from({ length: 13 }, (_, i) => {
                        const hour = i + 8;
                        return (
                          <div
                            key={i}
                            className="h-16 border-b border-ios-gray-100 hover:bg-ios-blue/5 transition-colors cursor-pointer group relative"
                            onDoubleClick={() => {
                              // Set the time for the new appointment
                              const clickedTime = `${hour.toString().padStart(2, '0')}:00`;
                              const endHour = Math.min(hour + 1, 20);
                              const clickedEndTime = `${endHour.toString().padStart(2, '0')}:00`;
                              setStartTime(clickedTime);
                              setEndTime(clickedEndTime);
                              setAppointmentDate(format(selectedDate, 'yyyy-MM-dd'));
                              // Pre-fill location
                              if (selectedLocation !== 'all') {
                                setFormLocationId(selectedLocation);
                              }
                              setIsDialogOpen(true);
                            }}
                          >
                            {/* Visual hint on hover */}
                            <div className="absolute inset-x-2 inset-y-1 rounded-lg border-2 border-dashed border-ios-blue/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="text-xs text-ios-blue font-medium opacity-0 group-hover:opacity-100">
                                + Doble click para agendar
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {/* Appointments as Blocks - with overlap handling */}
                      {(() => {
                        // Calculate overlaps for organic positioning
                        const sortedApts = [...filteredAppointments].sort((a, b) =>
                          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
                        );

                        // Group overlapping appointments
                        const overlapGroups: Appointment[][] = [];
                        sortedApts.forEach(apt => {
                          const aptStart = new Date(apt.start_time).getTime();
                          const aptEnd = new Date(apt.end_time).getTime();

                          // Find if this appointment overlaps with any existing group
                          let foundGroup = false;
                          for (const group of overlapGroups) {
                            const groupStart = Math.min(...group.map(a => new Date(a.start_time).getTime()));
                            const groupEnd = Math.max(...group.map(a => new Date(a.end_time).getTime()));

                            // Check if appointment overlaps with group's time range
                            if (aptStart < groupEnd && aptEnd > groupStart) {
                              group.push(apt);
                              foundGroup = true;
                              break;
                            }
                          }

                          if (!foundGroup) {
                            overlapGroups.push([apt]);
                          }
                        });

                        // Create position map
                        const positionMap = new Map<string, { left: string; width: string }>();
                        overlapGroups.forEach(group => {
                          const count = group.length;
                          group.forEach((apt, idx) => {
                            const width = `${100 / count - 1}%`;
                            const left = `${(idx * 100) / count}%`;
                            positionMap.set(apt.id, { left, width });
                          });
                        });

                        return filteredAppointments.map((apt) => {
                          const startHour = new Date(apt.start_time).getHours();
                          const startMinutes = new Date(apt.start_time).getMinutes();
                          const endHour = new Date(apt.end_time).getHours();
                          const endMinutes = new Date(apt.end_time).getMinutes();

                          const top = ((startHour - 8) * 64) + (startMinutes / 60 * 64);
                          const duration = ((endHour - startHour) * 60 + (endMinutes - startMinutes));
                          const height = Math.max(48, duration / 60 * 64);

                          const doctorColor = doctors.find(d => d.id === apt.doctor_id)?.color || '#007AFF';
                          const position = positionMap.get(apt.id) || { left: '0%', width: '100%' };

                          if (startHour < 8 || startHour > 20) return null;

                          return (
                            <div
                              key={apt.id}
                              className={cn(
                                "absolute rounded-xl p-2 cursor-pointer transition-all hover:scale-[1.02] hover:z-10 shadow-sm",
                                apt.type === 'personal' ? "border-dashed border-2" : ""
                              )}
                              style={{
                                top: `${top}px`,
                                height: `${height}px`,
                                left: `calc(${position.left} + 4px)`,
                                width: `calc(${position.width} - 8px)`,
                                backgroundColor: `${doctorColor}20`,
                                borderLeft: `3px solid ${doctorColor}`,
                                borderColor: apt.type === 'personal' ? doctorColor : undefined
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                // Pre-fill form with appointment data
                                setEditingAppointmentId(apt.id);
                                setAppointmentType(apt.type);
                                if (apt.type === 'medical') {
                                  setTitle(apt.title);
                                  setDescription(apt.description || '');
                                  setSelectedPatientId(apt.patient_id || '');
                                  setSelectedDoctorId(apt.doctor_id || '');
                                  setSelectedTreatmentId(apt.treatment_type || '');
                                  setFormLocationId(apt.location_id || '');
                                  setStatus(apt.status);
                                } else {
                                  setEventTitle(apt.title);
                                  setEventDescription(apt.description || '');
                                  setSelectedDoctorId(apt.doctor_id || '');
                                  setFormLocationId(apt.location_id || '');
                                }
                                setAppointmentDate(format(new Date(apt.start_time), 'yyyy-MM-dd'));
                                setStartTime(format(new Date(apt.start_time), 'HH:mm'));
                                setEndTime(format(new Date(apt.end_time), 'HH:mm'));
                                setIsDialogOpen(true);
                              }}
                            >
                              <div className="flex items-start justify-between h-full">
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-ios-gray-900 truncate">{apt.title}</p>
                                  {apt.patients && height > 50 && (
                                    <p className="text-xs text-ios-gray-600 truncate mt-0.5">
                                      {apt.patients.first_name} {apt.patients.last_name}
                                    </p>
                                  )}
                                  {height > 70 && (
                                    <p className="text-xs text-ios-gray-400 mt-1">
                                      {format(new Date(apt.start_time), 'HH:mm')} - {format(new Date(apt.end_time), 'HH:mm')}
                                    </p>
                                  )}
                                </div>
                                <Select value={apt.status} onValueChange={(value) => updateStatus(apt.id, value)}>
                                  <SelectTrigger className={cn("h-6 w-6 rounded-full border-0 p-0 flex-shrink-0", getStatusStyle(apt.status))}>
                                    {STATUS_OPTIONS.find(s => s.value === apt.status) && (
                                      <div className="h-2 w-2 rounded-full bg-current" />
                                    )}
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
                              </div>
                            </div>
                          );
                        });
                      })()}

                      {/* Current Time Indicator */}
                      {isSameDay(selectedDate, new Date()) && (
                        <div
                          className="absolute left-0 right-0 flex items-center z-20 pointer-events-none"
                          style={{
                            top: `${((new Date().getHours() - 8) * 64) + (new Date().getMinutes() / 60 * 64)}px`
                          }}
                        >
                          <div className="h-3 w-3 rounded-full bg-ios-red -ml-1.5" />
                          <div className="flex-1 h-0.5 bg-ios-red" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Empty State for Timeline */}
                  {filteredAppointments.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm pointer-events-none">
                      <div className="text-center">
                        <p className="text-ios-gray-500">Sin citas programadas</p>
                        <p className="text-xs text-ios-gray-400 mt-1">Doble click en cualquier hora para agendar</p>
                      </div>
                    </div>
                  )}
                </div>
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
            <DialogTitle className="text-xl font-bold text-ios-gray-900">
              {editingAppointmentId ? 'Editar cita' : '¿Qué deseas crear?'}
            </DialogTitle>
            <DialogDescription className="text-ios-gray-500">
              {editingAppointmentId ? 'Modifica los datos de la cita' : 'Selecciona el tipo de evento para la agenda'}
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

                  {/* Doctor */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-ios-gray-600">Doctor *</Label>
                    <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                      <SelectTrigger className="ios-input">
                        <SelectValue placeholder="Seleccionar doctor" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {doctors.map((doctor) => (
                          <SelectItem key={doctor.id} value={doctor.id}>
                            {doctor.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Location for medical appointments */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-ios-gray-600">Sede *</Label>
                    <Select value={formLocationId} onValueChange={setFormLocationId}>
                      <SelectTrigger className="ios-input">
                        <SelectValue placeholder="Selecciona sede..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {locations.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

                  {/* Doctor selector for personal events */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-ios-gray-600">Doctor a bloquear *</Label>
                    <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                      <SelectTrigger className="ios-input">
                        <SelectValue placeholder="Selecciona doctor..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {doctors.map((doc) => (
                          <SelectItem key={doc.id} value={doc.id}>
                            <div className="flex items-center gap-2">
                              <div
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: doc.color }}
                              />
                              {doc.full_name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Location selector for personal events */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-ios-gray-600">Sede *</Label>
                    <Select value={formLocationId} onValueChange={setFormLocationId}>
                      <SelectTrigger className="ios-input">
                        <SelectValue placeholder="Selecciona sede..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {locations.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
    </MainLayout >
  );
};

export default Agenda;