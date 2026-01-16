"use client";

import React, { useEffect, useState, useRef } from 'react';
import MainLayout from '@/components/layout/MainLayout';
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
  Plus, 
  Printer, 
  Trash2, 
  FileText,
  Search,
  Calendar,
  User
} from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInYears } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Doctor {
  id: string;
  full_name: string;
  specialty: string;
  professional_license: string;
  university: string;
  phone: string;
  address: string;
}

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
}

interface PrescriptionItem {
  medication: string;
  dosage: string;
}

interface Prescription {
  id: string;
  patient_id: string;
  doctor_id: string;
  prescription_date: string;
  observations: string;
  patients?: Patient;
  doctors?: Doctor;
  prescription_items?: PrescriptionItem[];
}

const Prescriptions = () => {
  const printRef = useRef<HTMLDivElement>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    patient_id: '',
    doctor_id: '',
    observations: '',
    items: [{ medication: '', dosage: '' }] as PrescriptionItem[]
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch prescriptions
      const { data: prescriptionsData } = await supabase
        .from('prescriptions')
        .select(`
          *,
          patients(id, first_name, last_name, date_of_birth),
          doctors(id, full_name, specialty, professional_license, university, phone, address)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Fetch items for each prescription
      if (prescriptionsData) {
        for (const prescription of prescriptionsData) {
          const { data: items } = await supabase
            .from('prescription_items')
            .select('*')
            .eq('prescription_id', prescription.id);
          prescription.prescription_items = items || [];
        }
      }

      setPrescriptions(prescriptionsData || []);

      // Fetch doctors
      const { data: doctorsData } = await supabase
        .from('doctors')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);
      setDoctors(doctorsData || []);

      // Fetch patients
      const { data: patientsData } = await supabase
        .from('patients')
        .select('id, first_name, last_name, date_of_birth')
        .eq('user_id', user.id)
        .order('first_name');
      setPatients(patientsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const addMedicationRow = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { medication: '', dosage: '' }]
    }));
  };

  const updateMedicationRow = (index: number, field: string, value: string) => {
    setFormData(prev => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const removeMedicationRow = (index: number) => {
    if (formData.items.length > 1) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.patient_id || !formData.doctor_id) {
      toast.error('Selecciona paciente y doctor');
      return;
    }

    if (formData.items.every(item => !item.medication)) {
      toast.error('Agrega al menos un medicamento');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Create prescription
      const { data: prescription, error: prescriptionError } = await supabase
        .from('prescriptions')
        .insert({
          user_id: user.id,
          patient_id: formData.patient_id,
          doctor_id: formData.doctor_id,
          observations: formData.observations
        })
        .select()
        .single();

      if (prescriptionError) throw prescriptionError;

      // Create items
      const items = formData.items
        .filter(item => item.medication)
        .map(item => ({
          prescription_id: prescription.id,
          medication: item.medication,
          dosage: item.dosage
        }));

      const { error: itemsError } = await supabase
        .from('prescription_items')
        .insert(items);

      if (itemsError) throw itemsError;

      toast.success('Receta creada');
      setIsDialogOpen(false);
      setFormData({
        patient_id: '',
        doctor_id: '',
        observations: '',
        items: [{ medication: '', dosage: '' }]
      });
      fetchData();
    } catch (error) {
      console.error('Error saving prescription:', error);
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = (prescription: Prescription) => {
    setSelectedPrescription(prescription);
    setShowPreview(true);
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const getPatientAge = (dateOfBirth: string) => {
    if (!dateOfBirth) return null;
    return differenceInYears(new Date(), new Date(dateOfBirth));
  };

  const filteredPrescriptions = prescriptions.filter(p => {
    const patientName = `${p.patients?.first_name} ${p.patients?.last_name}`.toLowerCase();
    return patientName.includes(searchTerm.toLowerCase());
  });

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">Recetas</h1>
          <p className="text-ios-gray-500 mt-1 font-medium">Prescripciones médicas</p>
        </div>
        <button
          onClick={() => setIsDialogOpen(true)}
          className="flex items-center gap-2 h-11 px-5 rounded-xl bg-ios-blue text-white font-semibold text-sm shadow-ios-sm hover:bg-ios-blue/90 transition-all duration-200 touch-feedback"
        >
          <Plus className="h-5 w-5" />
          Nueva Receta
        </button>
      </div>

      {/* Search */}
      <div className="mb-6 animate-fade-in print:hidden" style={{ animationDelay: '50ms' }}>
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ios-gray-400" />
          <input
            type="text"
            placeholder="Buscar por paciente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-12 pl-12 pr-4 rounded-2xl bg-white border-0 text-base placeholder:text-ios-gray-400 focus:ring-2 focus:ring-ios-blue/30 focus:outline-none shadow-ios-sm transition-all duration-200"
          />
        </div>
      </div>

      {/* Prescriptions List */}
      <div className="ios-card overflow-hidden animate-slide-up print:hidden" style={{ animationDelay: '100ms' }}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 border-3 border-ios-blue/30 border-t-ios-blue rounded-full animate-spin"></div>
          </div>
        ) : filteredPrescriptions.length > 0 ? (
          <div className="divide-y divide-ios-gray-100">
            {filteredPrescriptions.map((prescription, index) => (
              <div
                key={prescription.id}
                className="flex items-center gap-4 p-4 hover:bg-ios-gray-50 transition-all duration-200 ease-ios animate-fade-in"
                style={{ animationDelay: `${150 + index * 30}ms` }}
              >
                <div className="h-12 w-12 rounded-2xl bg-ios-purple/15 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-6 w-6 text-ios-purple" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ios-gray-900">
                    {prescription.patients?.first_name} {prescription.patients?.last_name}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-sm text-ios-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(new Date(prescription.prescription_date), "dd/MM/yyyy")}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {prescription.doctors?.full_name}
                    </span>
                  </div>
                </div>

                <div className="text-sm text-ios-gray-500">
                  {prescription.prescription_items?.length || 0} medicamento(s)
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
            <p className="text-ios-gray-500 text-sm mt-1">Crea tu primera receta médica</p>
          </div>
        )}
      </div>

      {/* Print Preview */}
      {showPreview && selectedPrescription && (
        <div className="fixed inset-0 bg-white z-50 p-8 print:p-0 overflow-auto">
          <div className="max-w-[800px] mx-auto" ref={printRef}>
            {/* Header */}
            <div className="border-b-4 border-ios-blue pb-4 mb-6">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className="text-4xl">🦷</div>
                  <div>
                    <h1 className="text-2xl font-bold text-ios-blue">Denttia</h1>
                    <p className="text-xs text-gray-500">Odontología Especializada</p>
                  </div>
                </div>
                <div className="text-right">
                  <h2 className="text-xl font-bold text-gray-800">
                    {selectedPrescription.doctors?.full_name}
                  </h2>
                  <p className="text-sm text-gray-600">{selectedPrescription.doctors?.university}</p>
                  <p className="text-sm text-gray-600">
                    Cédula Profesional: {selectedPrescription.doctors?.professional_license}
                  </p>
                </div>
              </div>
            </div>

            {/* Patient Info */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-500">Paciente:</p>
                <p className="font-medium border-b border-gray-300 pb-1">
                  {selectedPrescription.patients?.first_name} {selectedPrescription.patients?.last_name}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Fecha:</p>
                <p className="font-medium">
                  {format(new Date(selectedPrescription.prescription_date), "d 'de' MMMM 'de' yyyy", { locale: es })}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div>
                <p className="text-sm text-gray-500">Fecha Nacimiento:</p>
                <p className="font-medium border-b border-gray-300 pb-1">
                  {selectedPrescription.patients?.date_of_birth 
                    ? format(new Date(selectedPrescription.patients.date_of_birth), "dd-MMM-yy", { locale: es })
                    : '-'
                  }
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Edad:</p>
                <p className="font-medium border-b border-gray-300 pb-1">
                  {selectedPrescription.patients?.date_of_birth 
                    ? `${getPatientAge(selectedPrescription.patients.date_of_birth)} años`
                    : '-'
                  }
                </p>
              </div>
            </div>

            {/* Prescription */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-ios-blue mb-4">RX:</h3>
              <table className="w-full">
                <thead>
                  <tr className="bg-ios-blue/10">
                    <th className="text-left p-2 text-sm font-semibold">#</th>
                    <th className="text-left p-2 text-sm font-semibold">Medicamento</th>
                    <th className="text-left p-2 text-sm font-semibold">Dosis/Indicaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPrescription.prescription_items?.map((item, index) => (
                    <tr key={index} className="border-b border-gray-200">
                      <td className="p-2 text-sm">{index + 1}</td>
                      <td className="p-2 text-sm">{item.medication}</td>
                      <td className="p-2 text-sm">{item.dosage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Observations */}
            {selectedPrescription.observations && (
              <div className="mb-8">
                <p className="text-sm text-gray-500 mb-1">Observaciones:</p>
                <p className="text-sm border-b border-gray-300 pb-2 min-h-[60px]">
                  {selectedPrescription.observations}
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="border-t-2 border-ios-blue pt-4 mt-auto">
              <div className="text-center text-sm text-gray-600">
                <p className="font-medium">Teléfonos: {selectedPrescription.doctors?.phone || '2381044047'}</p>
                <p>{selectedPrescription.doctors?.address || 'Adolfo López Mateos # 2811 - Local 3, Zona Alta, Tehuacan, Puebla'}</p>
              </div>
            </div>

            {/* Close button (hidden in print) */}
            <button
              onClick={() => setShowPreview(false)}
              className="fixed top-4 right-4 h-10 w-10 rounded-full bg-ios-gray-900 text-white flex items-center justify-center print:hidden"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] rounded-3xl border-0 shadow-ios-xl p-0 overflow-hidden max-h-[90vh]">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="text-xl font-bold text-ios-gray-900">Nueva Receta</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="px-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-ios-gray-600">Paciente *</Label>
                  <Select
                    value={formData.patient_id}
                    onValueChange={(value) => setFormData({ ...formData, patient_id: value })}
                  >
                    <SelectTrigger className="ios-input">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {patients.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.first_name} {p.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-ios-gray-600">Doctor *</Label>
                  <Select
                    value={formData.doctor_id}
                    onValueChange={(value) => setFormData({ ...formData, doctor_id: value })}
                  >
                    <SelectTrigger className="ios-input">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {doctors.map(d => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Medications */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-ios-gray-600">Medicamentos</Label>
                {formData.items.map((item, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <input
                        value={item.medication}
                        onChange={(e) => updateMedicationRow(index, 'medication', e.target.value)}
                        className="ios-input text-sm"
                        placeholder="Medicamento"
                      />
                    </div>
                    <div className="flex-1">
                      <input
                        value={item.dosage}
                        onChange={(e) => updateMedicationRow(index, 'dosage', e.target.value)}
                        className="ios-input text-sm"
                        placeholder="Dosis e indicaciones"
                      />
                    </div>
                    {formData.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMedicationRow(index)}
                        className="h-10 w-10 rounded-xl bg-ios-red/10 flex items-center justify-center hover:bg-ios-red/20 transition-colors touch-feedback flex-shrink-0"
                      >
                        <Trash2 className="h-4 w-4 text-ios-red" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addMedicationRow}
                  className="w-full h-10 rounded-xl border-2 border-dashed border-ios-gray-300 text-ios-gray-500 font-medium flex items-center justify-center gap-2 hover:border-ios-blue hover:text-ios-blue transition-colors touch-feedback text-sm"
                >
                  <Plus className="h-4 w-4" />
                  Agregar Medicamento
                </button>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Observaciones</Label>
                <textarea
                  value={formData.observations}
                  onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                  className="ios-input resize-none"
                  rows={3}
                  placeholder="Indicaciones adicionales..."
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
                className="flex-1 h-12 rounded-xl bg-ios-blue text-white font-semibold hover:bg-ios-blue/90 transition-colors touch-feedback disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Crear Receta'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Prescriptions;