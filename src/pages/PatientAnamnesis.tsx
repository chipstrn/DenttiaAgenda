"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertTriangle,
  Heart,
  Pill,
  Shield,
  ChevronRight,
  Check,
  AlertCircle,
  Stethoscope,
  Clock,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useNavigate, useParams } from 'react-router-dom';

const ALLERGY_OPTIONS = [
  'Penicilina',
  'Látex',
  'AINES',
  'Anestesia Local',
  'Sulfas',
  'Yodo',
  'Otros'
];

const ANTICOAGULANT_OPTIONS = [
  'Aspirina',
  'Warfarina',
  'Clopidogrel',
  'Rivaroxabán',
  'Otros'
];

const DANGEROUS_MEDICATIONS = [
  'bifosfonatos',
  'alendronato',
  'risedronato',
  'ibandronato',
  'zoledronato',
  'denosumab'
];

// ToggleSection component - moved outside to avoid re-creation on each render
const ToggleSection = ({
  icon: Icon,
  title,
  subtitle,
  color,
  checked,
  onCheckedChange,
  children
}: {
  icon: any;
  title: string;
  subtitle: string;
  color: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children?: React.ReactNode;
}) => (
  <div className="ios-card overflow-hidden">
    <div className="flex items-center justify-between p-5">
      <div className="flex items-center gap-4">
        <div className={cn("h-11 w-11 rounded-2xl flex items-center justify-center", color)}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-ios-gray-900">{title}</h3>
          <p className="text-sm text-ios-gray-500">{subtitle}</p>
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="scale-125"
      />
    </div>
    {checked && children && (
      <div className="px-5 pb-5 pt-0 border-t border-ios-gray-100 animate-fade-in">
        <div className="pt-4">
          {children}
        </div>
      </div>
    )}
  </div>
);

const PatientAnamnesis = () => {
  const navigate = useNavigate();
  const { patientId } = useParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [medicationAlert, setMedicationAlert] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    // Alertas Médicas
    has_allergies: false,
    allergies: [] as string[],
    allergy_notes: '',

    has_bleeding_issues: false,
    takes_anticoagulants: false,
    anticoagulant_details: '',

    has_chronic_diseases: false,
    chronic_disease_details: '',
    is_chronic_controlled: false,

    has_infectious_diseases: false,
    infectious_disease_notes: '',

    current_medications: '',

    // Antecedentes Odontológicos
    last_dental_visit: '',
    has_current_pain: false,
    pain_level: 5,
    brushing_frequency: 2
  });

  useEffect(() => {
    fetchData();
  }, [patientId]);

  useEffect(() => {
    // Check for dangerous medications
    const meds = formData.current_medications.toLowerCase();
    const foundDangerous = DANGEROUS_MEDICATIONS.find(med => meds.includes(med));
    if (foundDangerous) {
      setMedicationAlert(`⚠️ ALERTA: Paciente toma ${foundDangerous.toUpperCase()}. Riesgo de Osteonecrosis Mandibular.`);
    } else {
      setMedicationAlert(null);
    }
  }, [formData.current_medications]);

  const fetchData = async () => {
    if (!patientId) {
      navigate('/patients');
      return;
    }

    setLoading(true);
    try {
      // Fetch patient info
      const { data: patientData } = await supabase
        .from('patients')
        .select('first_name, last_name')
        .eq('id', patientId)
        .single();

      if (patientData) {
        setPatientName(`${patientData.first_name} ${patientData.last_name}`);
      }

      // Fetch existing record
      const { data: recordData } = await supabase
        .from('patient_records')
        .select('*')
        .eq('patient_id', patientId)
        .single();

      if (recordData) {
        setFormData({
          has_allergies: recordData.has_allergies || false,
          allergies: recordData.allergies || [],
          allergy_notes: recordData.allergy_notes || '',
          has_bleeding_issues: recordData.has_bleeding_issues || false,
          takes_anticoagulants: recordData.takes_anticoagulants || false,
          anticoagulant_details: recordData.anticoagulant_details || '',
          has_chronic_diseases: recordData.has_chronic_diseases || false,
          chronic_disease_details: recordData.chronic_disease_details || '',
          is_chronic_controlled: recordData.is_chronic_controlled || false,
          has_infectious_diseases: recordData.has_infectious_diseases || false,
          infectious_disease_notes: recordData.infectious_disease_notes || '',
          current_medications: recordData.current_medications || '',
          last_dental_visit: recordData.last_dental_visit || '',
          has_current_pain: recordData.has_current_pain || false,
          pain_level: recordData.pain_level || 5,
          brushing_frequency: recordData.brushing_frequency || 2
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const toggleAllergy = (allergy: string) => {
    setFormData(prev => ({
      ...prev,
      allergies: prev.allergies.includes(allergy)
        ? prev.allergies.filter(a => a !== allergy)
        : [...prev.allergies, allergy]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('patient_records')
        .update({
          ...formData,
          medication_alerts: medicationAlert ? [medicationAlert] : [],
          doctor_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('patient_id', patientId);

      if (error) throw error;

      toast.success('Expediente completado');
      navigate('/patients');
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 border-3 border-ios-blue/30 border-t-ios-blue rounded-full animate-spin"></div>
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
          <span className="text-ios-green font-medium">Doctor</span>
        </div>
        <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">
          Anamnesis Dental
        </h1>
        <p className="text-ios-gray-500 mt-1 font-medium">
          Paciente: <span className="text-ios-gray-900">{patientName}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-4">
        {/* Medication Alert Banner */}
        {medicationAlert && (
          <div className="p-4 rounded-2xl bg-ios-red/10 border-2 border-ios-red/30 animate-scale-in">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-ios-red flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-ios-red">¡ALERTA MÉDICA!</p>
                <p className="text-sm text-ios-red/90 mt-1">{medicationAlert}</p>
              </div>
            </div>
          </div>
        )}

        {/* Section Header */}
        <div className="pt-4 animate-fade-in">
          <h2 className="text-lg font-bold text-ios-gray-900 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-ios-red" />
            Alertas Médicas
          </h2>
          <p className="text-sm text-ios-gray-500">Los "Red Flags" dentales importantes</p>
        </div>

        {/* Allergies */}
        <div className="animate-slide-up" style={{ animationDelay: '0ms' }}>
          <ToggleSection
            icon={AlertTriangle}
            title="Alergias"
            subtitle="¿El paciente tiene alergias conocidas?"
            color="bg-ios-orange"
            checked={formData.has_allergies}
            onCheckedChange={(checked: boolean) => setFormData({ ...formData, has_allergies: checked })}
          >
            <div className="space-y-4">
              <Label className="text-sm font-medium text-ios-gray-600">Selecciona las alergias:</Label>
              <div className="flex flex-wrap gap-2">
                {ALLERGY_OPTIONS.map((allergy) => (
                  <button
                    key={allergy}
                    type="button"
                    onClick={() => toggleAllergy(allergy)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 touch-feedback",
                      formData.allergies.includes(allergy)
                        ? "bg-ios-orange text-white"
                        : "bg-ios-gray-100 text-ios-gray-700 hover:bg-ios-gray-200"
                    )}
                  >
                    {formData.allergies.includes(allergy) && (
                      <Check className="h-3 w-3 inline mr-1" />
                    )}
                    {allergy}
                  </button>
                ))}
              </div>
              <input
                value={formData.allergy_notes}
                onChange={(e) => setFormData({ ...formData, allergy_notes: e.target.value })}
                className="ios-input"
                placeholder="Notas adicionales sobre alergias..."
              />
            </div>
          </ToggleSection>
        </div>

        {/* Bleeding Issues */}
        <div className="animate-slide-up" style={{ animationDelay: '50ms' }}>
          <ToggleSection
            icon={Heart}
            title="Problemas de Coagulación / Sangrado"
            subtitle="¿Tiene problemas de sangrado?"
            color="bg-ios-red"
            checked={formData.has_bleeding_issues}
            onCheckedChange={(checked: boolean) => setFormData({ ...formData, has_bleeding_issues: checked })}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-ios-gray-50 rounded-xl">
                <span className="font-medium text-ios-gray-900">¿Toma anticoagulantes?</span>
                <Switch
                  checked={formData.takes_anticoagulants}
                  onCheckedChange={(checked) => setFormData({ ...formData, takes_anticoagulants: checked })}
                />
              </div>
              {formData.takes_anticoagulants && (
                <div className="space-y-2 animate-fade-in">
                  <Label className="text-sm font-medium text-ios-gray-600">¿Cuáles?</Label>
                  <div className="flex flex-wrap gap-2">
                    {ANTICOAGULANT_OPTIONS.map((med) => (
                      <button
                        key={med}
                        type="button"
                        onClick={() => setFormData({ ...formData, anticoagulant_details: med })}
                        className={cn(
                          "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 touch-feedback",
                          formData.anticoagulant_details === med
                            ? "bg-ios-red text-white"
                            : "bg-ios-gray-100 text-ios-gray-700 hover:bg-ios-gray-200"
                        )}
                      >
                        {med}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ToggleSection>
        </div>

        {/* Chronic Diseases */}
        <div className="animate-slide-up" style={{ animationDelay: '100ms' }}>
          <ToggleSection
            icon={Shield}
            title="Enfermedades Crónicas"
            subtitle="Diabetes, Hipertensión, etc."
            color="bg-ios-purple"
            checked={formData.has_chronic_diseases}
            onCheckedChange={(checked: boolean) => setFormData({ ...formData, has_chronic_diseases: checked })}
          >
            <div className="space-y-4">
              <input
                value={formData.chronic_disease_details}
                onChange={(e) => setFormData({ ...formData, chronic_disease_details: e.target.value })}
                className="ios-input"
                placeholder="Especificar enfermedades..."
              />
              <div className="flex items-center justify-between p-4 bg-ios-gray-50 rounded-xl">
                <span className="font-medium text-ios-gray-900">¿Está controlado?</span>
                <Switch
                  checked={formData.is_chronic_controlled}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_chronic_controlled: checked })}
                />
              </div>
            </div>
          </ToggleSection>
        </div>

        {/* Infectious Diseases */}
        <div className="animate-slide-up" style={{ animationDelay: '150ms' }}>
          <ToggleSection
            icon={Shield}
            title="Enfermedades Infecciosas"
            subtitle="VIH, Hepatitis, etc. (Confidencial)"
            color="bg-ios-gray-600"
            checked={formData.has_infectious_diseases}
            onCheckedChange={(checked: boolean) => setFormData({ ...formData, has_infectious_diseases: checked })}
          >
            <input
              value={formData.infectious_disease_notes}
              onChange={(e) => setFormData({ ...formData, infectious_disease_notes: e.target.value })}
              className="ios-input"
              placeholder="Notas confidenciales..."
            />
          </ToggleSection>
        </div>

        {/* Current Medications */}
        <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center gap-4 mb-4">
            <div className="h-11 w-11 rounded-2xl bg-ios-teal flex items-center justify-center">
              <Pill className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-ios-gray-900">Medicamentos Actuales</h3>
              <p className="text-sm text-ios-gray-500">Lista de medicamentos que toma</p>
            </div>
          </div>
          <textarea
            value={formData.current_medications}
            onChange={(e) => setFormData({ ...formData, current_medications: e.target.value })}
            className="ios-input resize-none"
            rows={3}
            placeholder="Ej: Metformina 500mg, Losartán 50mg..."
          />
        </div>

        {/* Dental History Section */}
        <div className="pt-6 animate-fade-in" style={{ animationDelay: '250ms' }}>
          <h2 className="text-lg font-bold text-ios-gray-900 flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-ios-blue" />
            Antecedentes Odontológicos
          </h2>
          <p className="text-sm text-ios-gray-500">Historial y motivo de consulta</p>
        </div>

        {/* Last Dental Visit */}
        <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '300ms' }}>
          <div className="flex items-center gap-4 mb-4">
            <div className="h-11 w-11 rounded-2xl bg-ios-blue flex items-center justify-center">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-ios-gray-900">¿Última visita al dentista?</h3>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'less_6_months', label: 'Menos de 6 meses' },
              { value: '1_year', label: 'Hace 1 año' },
              { value: 'more_1_year', label: 'Más de 1 año' }
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFormData({ ...formData, last_dental_visit: option.value })}
                className={cn(
                  "p-4 rounded-2xl text-center transition-all duration-200 touch-feedback",
                  formData.last_dental_visit === option.value
                    ? "bg-ios-blue text-white"
                    : "bg-ios-gray-100 text-ios-gray-700 hover:bg-ios-gray-200"
                )}
              >
                <span className="text-sm font-medium">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Current Pain */}
        <div className="animate-slide-up" style={{ animationDelay: '350ms' }}>
          <ToggleSection
            icon={AlertTriangle}
            title="¿Dolor Actual?"
            subtitle="¿El paciente presenta dolor?"
            color="bg-ios-red"
            checked={formData.has_current_pain}
            onCheckedChange={(checked: boolean) => setFormData({ ...formData, has_current_pain: checked })}
          >
            <div className="space-y-4">
              <Label className="text-sm font-medium text-ios-gray-600">
                Del 1 al 10, ¿cuánto duele?
              </Label>
              <div className="px-2">
                <Slider
                  value={[formData.pain_level]}
                  onValueChange={(value) => setFormData({ ...formData, pain_level: value[0] })}
                  max={10}
                  min={1}
                  step={1}
                  className="w-full"
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ios-gray-500">Leve (1)</span>
                <span className={cn(
                  "font-bold text-2xl",
                  formData.pain_level <= 3 ? "text-ios-green" :
                    formData.pain_level <= 6 ? "text-ios-orange" : "text-ios-red"
                )}>
                  {formData.pain_level}
                </span>
                <span className="text-ios-gray-500">Severo (10)</span>
              </div>
            </div>
          </ToggleSection>
        </div>

        {/* Brushing Frequency */}
        <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '400ms' }}>
          <div className="flex items-center gap-4 mb-4">
            <div className="h-11 w-11 rounded-2xl bg-ios-green flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-ios-gray-900">¿Cuántas veces se cepilla al día?</h3>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setFormData({ ...formData, brushing_frequency: num })}
                className={cn(
                  "p-4 rounded-2xl text-center transition-all duration-200 touch-feedback",
                  formData.brushing_frequency === num
                    ? "bg-ios-green text-white"
                    : "bg-ios-gray-100 text-ios-gray-700 hover:bg-ios-gray-200"
                )}
              >
                <span className="text-2xl font-bold">{num}{num === 3 ? '+' : ''}</span>
                <span className="block text-xs mt-1">
                  {num === 1 ? 'vez' : 'veces'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-4 pt-6 pb-8 animate-slide-up" style={{ animationDelay: '450ms' }}>
          <button
            type="button"
            onClick={() => navigate(`/patient/${patientId}/intake`)}
            className="flex-1 h-14 rounded-2xl bg-ios-gray-100 text-ios-gray-900 font-semibold text-lg hover:bg-ios-gray-200 transition-colors touch-feedback"
          >
            Volver a Recepción
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 h-14 rounded-2xl bg-ios-green text-white font-semibold text-lg hover:bg-ios-green/90 transition-colors touch-feedback disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Guardando...
              </>
            ) : (
              <>
                <Check className="h-5 w-5" />
                Completar Expediente
              </>
            )}
          </button>
        </div>
      </form>
    </MainLayout>
  );
};

export default PatientAnamnesis;