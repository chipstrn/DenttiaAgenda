"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import MainLayout from '@/components/layout/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { CLINIC_INFO, getWhatsAppLink } from '@/config/clinic'; // Ajusta la ruta si es diferente
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from '@/components/ui/textarea';
import { Phone, Calendar as CalendarIcon, User, MapPin } from 'lucide-react';
import { toast } from 'sonner';

// Configuración regional
const localizer = dateFnsLocalizer({
  format, parse, startOfWeek, getDay, locales: { es }
});

const Agenda = () => {
  const [location, setLocation] = useState('tehuacan');
  const [events, setEvents] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('medical');

  // Estados del Formulario
  const [formData, setFormData] = useState({
    patientName: '',
    patientPhone: '',
    title: '',
    doctorId: '',
    status: 'confirmed',
    notes: ''
  });

  // 1. AJUSTE DE HORARIO VISIBLE (SOLUCIÓN A "NO MOSTRAR HORARIOS")
  // Definimos que el calendario empiece a las 9:00 AM y termine a las 9:00 PM
  const { defaultDate, min, max } = useMemo(() => ({
    defaultDate: new Date(),
    min: new Date(1970, 1, 1, 9, 0, 0), // <--- INICIO: 9:00 AM
    max: new Date(1970, 1, 1, 21, 0, 0), // <--- FIN: 9:00 PM
  }), []);

  // Cargar Doctores
  useEffect(() => {
    const fetchDoctors = async () => {
      const { data } = await supabase.from('doctors').select('id, first_name, last_name, color');
      const resources = data?.map(d => ({
        id: d.id,
        title: `Dr. ${d.first_name}`, // Nombre corto para ahorrar espacio
        color: d.color || '#3b82f6'
      })) || [];
      setDoctors(resources);
    };
    fetchDoctors();
  }, []);

  // Cargar Citas
  const fetchAppointments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, doctors(first_name, last_name), patients(first_name, last_name, phone)')
        .eq('location', location);

      if (error) throw error;

      const formattedEvents = data.map(app => ({
        id: app.id,
        title: app.type === 'personal' ? `⛔ ${app.title}` : `${app.patients?.first_name || 'Paciente'} - ${app.title || 'Consulta'}`,
        start: new Date(app.start_time),
        end: new Date(app.end_time),
        resourceId: app.doctor_id, // <--- CLAVE: Esto asigna la cita a la columna del doctor
        type: app.type,
        status: app.status,
        details: app
      }));
      setEvents(formattedEvents);
    } catch (e) {
      console.error("Error cargando citas:", e);
    }
  }, [location]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Manejadores
  const handleSelectSlot = (slotInfo: any) => {
    setSelectedSlot(slotInfo);
    // Auto-asignar el doctor de la columna donde se hizo clic
    setFormData(prev => ({ 
      ...prev, 
      doctorId: slotInfo.resourceId || doctors[0]?.id,
      title: '', patientName: '', patientPhone: '', notes: '' 
    })); 
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const isPersonal = activeTab === 'personal';
      const payload = {
        title: formData.title,
        start_time: selectedSlot.start.toISOString(),
        end_time: selectedSlot.end.toISOString(),
        doctor_id: formData.doctorId,
        location: location,
        type: isPersonal ? 'personal' : 'medical',
        status: 'confirmed',
        notes: formData.notes
      };

      const { error } = await supabase.from('appointments').insert(payload);
      if (error) throw error;

      toast.success(isPersonal ? 'Bloqueo creado' : 'Cita agendada');
      setModalOpen(false);
      fetchAppointments();
    } catch (e) {
      toast.error('Error al guardar');
    }
  };

  const handleWhatsApp = () => {
    if (!formData.patientPhone) return toast.error('Falta teléfono');
    const msg = `Hola ${formData.patientName}, recordatorio de cita en Denttia: ${format(selectedSlot.start, "dd/MM HH:mm")}.`;
    window.open(getWhatsAppLink(formData.patientPhone, msg), '_blank');
  };

  return (
    <MainLayout>
      <div className="h-[calc(100vh-100px)] flex flex-col pb-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 px-1">
          <h1 className="text-2xl font-bold text-gray-800">Agenda {location === 'tehuacan' ? 'Tehuacán' : 'Huautla'}</h1>
          <div className="flex items-center gap-2 bg-white p-1 rounded-lg border shadow-sm">
            <MapPin className="text-blue-600 w-4 h-4 ml-2" />
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger className="w-[140px] border-none shadow-none font-medium h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tehuacan">Tehuacán</SelectItem>
                <SelectItem value="huautla">Huautla</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 2. SOLUCIÓN A "CALENDARIO ESTRECHO" 
           Envovlemos el calendario en un div con overflow-x-auto y un min-width.
           Esto permite hacer scroll horizontal si hay muchos doctores, en lugar de aplastarlos.
        */}
        <div className="flex-1 bg-white rounded-xl shadow-sm p-2 overflow-hidden border border-gray-200">
          <div className="h-full overflow-x-auto">
            <div className="min-w-[800px] h-full"> {/* <--- MÍNIMO 800px de ancho */}
              <Calendar
                localizer={localizer}
                events={events}
                defaultDate={defaultDate}
                startAccessor="start"
                endAccessor="end"
                resources={doctors} // Columnas por doctor
                resourceIdAccessor="id"
                resourceTitleAccessor="title"
                defaultView={Views.DAY} // Vista por Día (Columnas)
                views={['day', 'work_week']} // Quitamos Mes/Agenda que confunden
                step={30}
                timeslots={2}
                min={min} // <--- APLICAMOS EL HORARIO LIMITADO (9am)
                max={max} // <--- APLICAMOS EL HORARIO LIMITADO (9pm)
                selectable
                onSelectSlot={handleSelectSlot}
                dayLayoutAlgorithm="no-overlap" // <--- 3. EVITA QUE SE ENCIMEN FEO
                eventPropGetter={(event) => ({
                  style: {
                    backgroundColor: event.type === 'personal' ? '#6b7280' : 
                                     doctors.find(d => d.id === event.resourceId)?.color || '#3b82f6',
                    fontSize: '0.85rem',
                    borderLeft: event.type === 'personal' ? '4px solid #374151' : 'none',
                    borderRadius: '4px'
                  }
                })}
              />
            </div>
          </div>
        </div>

        {/* Modal Simplificado */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle>Nueva Entrada</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="medical" onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="medical">🦷 Cita</TabsTrigger>
                <TabsTrigger value="personal">⛔ Bloqueo</TabsTrigger>
              </TabsList>
              <div className="py-4 space-y-4">
                {/* Selector de Doctor siempre visible */}
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Doctor Asignado</Label>
                  <Select 
                    value={formData.doctorId} 
                    onValueChange={(v) => setFormData({...formData, doctorId: v})}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {doctors.map(d => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {activeTab === 'medical' ? (
                  <>
                    <Input placeholder="Tratamiento (Ej. Resina)" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                    <div className="p-3 bg-blue-50 rounded-md border border-blue-100 space-y-2">
                      <Input placeholder="Nombre Paciente" className="bg-white h-9" value={formData.patientName} onChange={e => setFormData({...formData, patientName: e.target.value})} />
                      <div className="flex gap-2">
                        <Input placeholder="WhatsApp" className="bg-white h-9" value={formData.patientPhone} onChange={e => setFormData({...formData, patientPhone: e.target.value})} />
                        <Button size="icon" variant="outline" className="h-9 w-9" onClick={handleWhatsApp}><Phone className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <Input placeholder="Motivo (Ej. Comida)" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                )}
                <Textarea placeholder="Notas..." className="h-20 resize-none" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} className="bg-ios-blue text-white">Guardar</Button>
              </DialogFooter>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
};

export default Agenda;