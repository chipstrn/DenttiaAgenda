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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, FileText, Printer, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Prescription {
  id: string;
  patient_id: string;
  doctor_id: string;
  medications: string;
  instructions: string;
  diagnosis: string;
  created_at: string;
  patients?: {
    first_name: string;
    last_name: string;
  };
  doctors?: {
    full_name: string;
    specialty: string;
  };
}

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
}

interface Doctor {
  id: string;
  full_name: string;
  specialty: string;
}

const Prescriptions = () => {
  const { user } = useAuth();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [patientId, setPatientId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [medications, setMedications] = useState('');
  const [instructions, setInstructions] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [prescriptionsResult, patientsResult, doctorsResult] = await Promise.all([
        supabase
          .from('prescriptions')
          .select('*, patients(first_name, last_name), doctors(full_name, specialty)')
          .order('created_at', { ascending: false }),
        supabase
          .from('patients')
          .select('id, first_name, last_name')
          .order('first_name', { ascending: true }),
        supabase
          .from('doctors')
          .select('id, full_name, specialty')
          .eq('is_active', true)
          .order('full_name', { ascending: true })
      ]);

      if (prescriptionsResult.error) throw prescriptionsResult.error;
      if (patientsResult.error) throw patientsResult.error;
      if (doctorsResult.error) throw doctorsResult.error;

      setPrescriptions(prescriptionsResult.data || []);
      setPatients(patientsResult.data || []);
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

  const resetForm = useCallback(() => {
    setPatientId('');
    setDoctorId('');
    setDiagnosis('');
    setMedications('');
    setInstructions('');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    if (!patientId || !doctorId) {
      toast.error('Selecciona paciente y doctor');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('prescriptions')
        .insert({
          user_id: user.id,
          patient_id: patientId,
          doctor_id: doctorId,
          observations: `${diagnosis}\n\n${medications}\n\n${instructions}`.trim()
        });

      if (error) throw error;
      
      toast.success('Receta creada');
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error creating prescription:', error);
      toast.error('Error al crear receta');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = useCallback((prescription: Prescription) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receta Médica</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
          .header h1 { margin: 0; color: #1a365d; }
          .header p { margin: 5px 0; color: #666; }
          .info { display: flex; justify-content: space-between; margin-bottom: 30px; }
          .info-block { }
          .info-block label { font-weight: bold; color: #333; }
          .info-block p { margin: 5px 0; }
          .section { margin-bottom: 25px; }
          .section h3 { color: #1a365d; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
          .section p { white-space: pre-wrap; line-height: 1.6; }
          .footer { margin-top: 50px; text-align: center; }
          .signature { margin-top: 60px; border-top: 1px solid #333; width: 200px; margin-left: auto; margin-right: auto; padding-top: 10px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Denttia</h1>
          <p>Clínica Dental - Tehuacán, Puebla</p>
          <p>Tel: (238) 123-4567</p>
        </div>
        
        <div class="info">
          <div class="info-block">
            <label>Paciente:</label>
            <p>${prescription.patients?.first_name || ''} ${prescription.patients?.last_name || ''}</p>
          </div>
          <div class="info-block">
            <label>Fecha:</label>
            <p>${format(new Date(prescription.created_at), "d 'de' MMMM 'de' yyyy", { locale: es })}</p>
          </div>
        </div>
        
        <div class="section">
          <h3>Prescripción</h3>
          <p>${prescription.observations || prescription.medications || 'No especificado'}</p>
        </div>
        
        <div class="footer">
          <div class="signature">
            <p>${prescription.doctors?.full_name || 'Doctor'}</p>
            ${prescription.doctors?.specialty ? `<p style="font-size: 12px; color: #666;">${prescription.doctors.specialty}</p>` : ''}
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  }, []);

  const filteredPrescriptions = prescriptions.filter(p => {
    if (!searchTerm) return true;
    const patientName = `${p.patients?.first_name || ''} ${p.patients?.last_name || ''}`.toLowerCase();
    const doctorName = (p.doctors?.full_name || '').toLowerCase();
    return patientName.includes(searchTerm.toLowerCase()) || doctorName.includes(searchTerm.toLowerCase());
  });

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">Recetas</h1>
          <p className="text-ios-gray-500 mt-1 font-medium">{prescriptions.length} recetas emitidas</p>
        </div>
        <button 
          onClick={() => setIsDialogOpen(true)}
          className="flex items-center gap-2 h-11 px-5 rounded-xl bg-ios-pink text-white font-semibold text-sm shadow-ios-sm hover:bg-ios-pink/90 transition-all duration-200 touch-feedback"
        >
          <Plus className="h-5 w-5" />
          Nueva Receta
        </button>
      </div>

      {/* Search */}
      <div className="mb-6 animate-fade-in" style={{ animationDelay: '50ms' }}>
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ios-gray-400" />
          <input
            type="text"
            placeholder="Buscar por paciente o doctor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-12 pl-12 pr-4 rounded-2xl bg-white border-0 text-base placeholder:text-ios-gray-400 focus:ring-2 focus:ring-ios-pink/30 focus:outline-none shadow-ios-sm transition-all duration-200"
          />
        </div>
      </div>

      {/* Prescriptions List */}
      <div className="ios-card overflow-hidden animate-slide-up" style={{ animationDelay: '100ms' }}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-ios-pink" />
          </div>
        ) : filteredPrescriptions.length > 0 ? (
          <div className="divide-y divide-ios-gray-100">
            {filteredPrescriptions.map((prescription, index) => (
              <div 
                key={prescription.id}
                className="flex items-center gap-4 p-4 hover:bg-ios-gray-50 transition-all duration-200 ease-ios animate-fade-in"
                style={{ animationDelay: `${150 + index * 30}ms` }}
              >
                <div className="h-12 w-12 rounded-2xl bg-ios-pink/15 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-ios-pink" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ios-gray-900">
                    {prescription.patients?.first_name} {prescription.patients?.last_name}
                  </p>
                  <p className="text-sm text-ios-gray-500">
                    {prescription.doctors?.full_name || 'Sin doctor asignado'}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm text-ios-gray-500">
                    {format(new Date(prescription.created_at), "dd/MM/yyyy")}
                  </p>
                </div>

                <button 
                  onClick={() => handlePrint(prescription)}
                  className="h-10 w-10 rounded-xl bg-ios-blue/10 flex items-center justify-center hover:bg-ios-blue/20 transition-colors touch-feedback"
                >
                  <Printer className="h-5 w-5 text-ios-blue" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="h-20 w-20 rounded-full bg-ios-gray-100 flex items-center justify-center mx-auto mb-4">
              <FileText className="h-10 w-10 text-ios-gray-400" />
            </div>
            <p className="text-ios-gray-900 font-semibold">Sin recetas</p>
            <p className="text-ios-gray-500 text-sm mt-1">No hay recetas registradas</p>
            <button 
              onClick={() => setIsDialogOpen(true)}
              className="mt-4 text-ios-pink font-semibold text-sm hover:opacity-70 transition-opacity"
            >
              Crear receta
            </button>
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl border-0 shadow-ios-xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="text-xl font-bold text-ios-gray-900">Nueva Receta</DialogTitle>
            <DialogDescription className="text-ios-gray-500">
              Crea una receta médica
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit}>
            <div className="px-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-ios-gray-600">Paciente *</Label>
                  <Select value={patientId} onValueChange={setPatientId}>
                    <SelectTrigger className="ios-input">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl max-h-[200px]">
                      {patients.map((patient) => (
                        <SelectItem key={patient.id} value={patient.id}>
                          {patient.first_name} {patient.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-ios-gray-600">Doctor *</Label>
                  <Select value={doctorId} onValueChange={setDoctorId}>
                    <SelectTrigger className="ios-input">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl max-h-[200px]">
                      {doctors.map((doctor) => (
                        <SelectItem key={doctor.id} value={doctor.id}>
                          {doctor.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Diagnóstico</Label>
                <input
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="Diagnóstico del paciente"
                  className="ios-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Medicamentos *</Label>
                <textarea
                  value={medications}
                  onChange={(e) => setMedications(e.target.value)}
                  rows={4}
                  placeholder="Ej: Amoxicilina 500mg - 1 cada 8 horas por 7 días"
                  required
                  className="ios-input resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Indicaciones</Label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={3}
                  placeholder="Indicaciones adicionales para el paciente"
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
                className="flex-1 h-12 rounded-xl bg-ios-pink text-white font-semibold hover:bg-ios-pink/90 transition-colors touch-feedback disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Creando...
                  </>
                ) : (
                  'Crear Receta'
                )}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Prescriptions;