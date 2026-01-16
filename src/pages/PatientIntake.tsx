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
import { supabase } from '@/integrations/supabase/client';
import { 
  Camera, 
  Upload, 
  User, 
  Phone, 
  Mail, 
  Calendar,
  Building2,
  AlertCircle,
  ChevronRight,
  Check,
  Search
} from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInYears } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNavigate, useParams } from 'react-router-dom';

interface PatientSource {
  id: string;
  name: string;
}

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
}

const PatientIntake = () => {
  const navigate = useNavigate();
  const { patientId } = useParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sources, setSources] = useState<PatientSource[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [calculatedAge, setCalculatedAge] = useState<number | null>(null);
  const [showReferrerField, setShowReferrerField] = useState(false);
  
  const [formData, setFormData] = useState({
    // Identificación
    first_name: '',
    last_name: '',
    date_of_birth: '',
    occupation: '',
    
    // Contacto
    phone: '',
    email: '',
    
    // Datos Fiscales
    rfc: '',
    business_name: '',
    fiscal_postal_code: '',
    fiscal_colony: '',
    fiscal_state: '',
    
    // Contacto de Emergencia
    emergency_contact_name: '',
    emergency_contact_phone: '',
    
    // Marketing
    source_id: '',
    referrer_patient_id: '',
    referrer_name: ''
  });

  useEffect(() => {
    fetchInitialData();
  }, [patientId]);

  useEffect(() => {
    if (formData.date_of_birth) {
      const age = differenceInYears(new Date(), new Date(formData.date_of_birth));
      setCalculatedAge(age);
    } else {
      setCalculatedAge(null);
    }
  }, [formData.date_of_birth]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch sources
      const { data: sourcesData } = await supabase
        .from('patient_sources')
        .select('*')
        .eq('is_active', true);
      setSources(sourcesData || []);

      // Fetch patients for referrer dropdown
      const { data: patientsData } = await supabase
        .from('patients')
        .select('id, first_name, last_name')
        .eq('user_id', user.id)
        .order('first_name');
      setPatients(patientsData || []);

      // If editing existing patient
      if (patientId) {
        const { data: patientData } = await supabase
          .from('patients')
          .select('*')
          .eq('id', patientId)
          .single();

        if (patientData) {
          setFormData(prev => ({
            ...prev,
            first_name: patientData.first_name || '',
            last_name: patientData.last_name || '',
            date_of_birth: patientData.date_of_birth || '',
            phone: patientData.phone || '',
            email: patientData.email || ''
          }));
        }

        // Fetch existing record
        const { data: recordData } = await supabase
          .from('patient_records')
          .select('*')
          .eq('patient_id', patientId)
          .single();

        if (recordData) {
          setFormData(prev => ({
            ...prev,
            occupation: recordData.occupation || '',
            rfc: recordData.rfc || '',
            business_name: recordData.business_name || '',
            fiscal_postal_code: recordData.fiscal_postal_code || '',
            fiscal_colony: recordData.fiscal_colony || '',
            fiscal_state: recordData.fiscal_state || '',
            emergency_contact_name: recordData.emergency_contact_name || '',
            emergency_contact_phone: recordData.emergency_contact_phone || '',
            source_id: recordData.source_id || '',
            referrer_patient_id: recordData.referrer_patient_id || '',
            referrer_name: recordData.referrer_name || ''
          }));
          if (recordData.photo_url) {
            setPhotoPreview(recordData.photo_url);
          }
          if (recordData.source_id) {
            const source = sourcesData?.find(s => s.id === recordData.source_id);
            if (source?.name === 'Recomendación') {
              setShowReferrerField(true);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSourceChange = (sourceId: string) => {
    setFormData({ ...formData, source_id: sourceId });
    const source = sources.find(s => s.id === sourceId);
    setShowReferrerField(source?.name === 'Recomendación');
    if (source?.name !== 'Recomendación') {
      setFormData(prev => ({ ...prev, referrer_patient_id: '', referrer_name: '' }));
    }
  };

  const validatePhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length === 10;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.source_id) {
      toast.error('Por favor selecciona cómo se enteró de nosotros');
      return;
    }

    if (formData.phone && !validatePhone(formData.phone)) {
      toast.error('El teléfono debe tener 10 dígitos');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let currentPatientId = patientId;

      // Create or update patient
      if (patientId) {
        const { error } = await supabase
          .from('patients')
          .update({
            first_name: formData.first_name,
            last_name: formData.last_name,
            date_of_birth: formData.date_of_birth || null,
            phone: formData.phone,
            email: formData.email,
            updated_at: new Date().toISOString()
          })
          .eq('id', patientId);

        if (error) throw error;
      } else {
        const { data: newPatient, error } = await supabase
          .from('patients')
          .insert({
            user_id: user.id,
            first_name: formData.first_name,
            last_name: formData.last_name,
            date_of_birth: formData.date_of_birth || null,
            phone: formData.phone,
            email: formData.email
          })
          .select()
          .single();

        if (error) throw error;
        currentPatientId = newPatient.id;
      }

      // Create or update patient record
      const recordData = {
        user_id: user.id,
        patient_id: currentPatientId,
        photo_url: photoPreview,
        occupation: formData.occupation,
        rfc: formData.rfc,
        business_name: formData.business_name,
        fiscal_postal_code: formData.fiscal_postal_code,
        fiscal_colony: formData.fiscal_colony,
        fiscal_state: formData.fiscal_state,
        emergency_contact_name: formData.emergency_contact_name,
        emergency_contact_phone: formData.emergency_contact_phone,
        source_id: formData.source_id,
        referrer_patient_id: formData.referrer_patient_id || null,
        referrer_name: formData.referrer_name,
        reception_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: recordError } = await supabase
        .from('patient_records')
        .upsert(recordData, { onConflict: 'patient_id' });

      if (recordError) throw recordError;

      toast.success('Datos guardados correctamente');
      navigate(`/patient/${currentPatientId}/anamnesis`);
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
          <span className="text-ios-blue font-medium">Recepción</span>
        </div>
        <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">
          {patientId ? 'Editar Paciente' : 'Nuevo Paciente'}
        </h1>
        <p className="text-ios-gray-500 mt-1 font-medium">Datos administrativos y de contacto</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        {/* Photo Upload */}
        <div className="ios-card p-6 animate-slide-up" style={{ animationDelay: '0ms' }}>
          <div className="flex items-center gap-6">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "h-28 w-28 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 touch-feedback",
                photoPreview 
                  ? "bg-cover bg-center" 
                  : "bg-ios-gray-100 hover:bg-ios-gray-200"
              )}
              style={photoPreview ? { backgroundImage: `url(${photoPreview})` } : {}}
            >
              {!photoPreview && (
                <div className="text-center">
                  <Camera className="h-8 w-8 text-ios-gray-400 mx-auto" />
                  <span className="text-xs text-ios-gray-500 mt-1">Foto</span>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
            <div className="flex-1">
              <h3 className="font-bold text-ios-gray-900">Foto del Paciente</h3>
              <p className="text-sm text-ios-gray-500 mt-1">
                Toca el círculo para subir una foto desde archivo o cámara
              </p>
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 flex items-center gap-2 text-ios-blue font-semibold text-sm hover:opacity-70 transition-opacity"
              >
                <Upload className="h-4 w-4" />
                Subir imagen
              </button>
            </div>
          </div>
        </div>

        {/* Identification */}
        <div className="ios-card overflow-hidden animate-slide-up" style={{ animationDelay: '50ms' }}>
          <div className="p-5 border-b border-ios-gray-100 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-ios-blue flex items-center justify-center">
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-ios-gray-900">Datos de Identificación</h2>
              <p className="text-sm text-ios-gray-500">Información básica del paciente</p>
            </div>
          </div>
          
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Nombre *</Label>
                <input
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  required
                  className="ios-input"
                  placeholder="Nombre(s)"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Apellidos *</Label>
                <input
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  required
                  className="ios-input"
                  placeholder="Apellido paterno y materno"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Fecha de Nacimiento</Label>
                <div className="relative">
                  <input
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    className="ios-input"
                  />
                </div>
                {calculatedAge !== null && (
                  <p className="text-sm text-ios-blue font-medium">
                    Edad: {calculatedAge} años
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Ocupación</Label>
                <input
                  value={formData.occupation}
                  onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                  className="ios-input"
                  placeholder="Ej: Ingeniero, Estudiante..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="ios-card overflow-hidden animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="p-5 border-b border-ios-gray-100 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-ios-green flex items-center justify-center">
              <Phone className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-ios-gray-900">Contacto</h2>
              <p className="text-sm text-ios-gray-500">Teléfono y correo electrónico</p>
            </div>
          </div>
          
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Celular *</Label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  required
                  className="ios-input"
                  placeholder="10 dígitos"
                  maxLength={10}
                />
                {formData.phone && !validatePhone(formData.phone) && (
                  <p className="text-xs text-ios-red">Debe tener 10 dígitos</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Email</Label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="ios-input"
                  placeholder="correo@ejemplo.com"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="ios-card overflow-hidden animate-slide-up" style={{ animationDelay: '150ms' }}>
          <div className="p-5 border-b border-ios-gray-100 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-ios-red flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-ios-gray-900">Contacto de Emergencia</h2>
              <p className="text-sm text-ios-gray-500">Persona a contactar en caso de emergencia</p>
            </div>
          </div>
          
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Nombre Completo *</Label>
                <input
                  value={formData.emergency_contact_name}
                  onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                  required
                  className="ios-input"
                  placeholder="Nombre del contacto"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Teléfono *</Label>
                <input
                  type="tel"
                  value={formData.emergency_contact_phone}
                  onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  required
                  className="ios-input"
                  placeholder="10 dígitos"
                  maxLength={10}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Fiscal Data */}
        <div className="ios-card overflow-hidden animate-slide-up" style={{ animationDelay: '200ms' }}>
          <div className="p-5 border-b border-ios-gray-100 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-ios-purple flex items-center justify-center">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-ios-gray-900">Datos de Facturación</h2>
              <p className="text-sm text-ios-gray-500">Opcional - Solo si requiere factura</p>
            </div>
          </div>
          
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">RFC</Label>
                <input
                  value={formData.rfc}
                  onChange={(e) => setFormData({ ...formData, rfc: e.target.value.toUpperCase() })}
                  className="ios-input"
                  placeholder="XAXX010101000"
                  maxLength={13}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Razón Social</Label>
                <input
                  value={formData.business_name}
                  onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                  className="ios-input"
                  placeholder="Nombre o razón social"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Código Postal</Label>
                <input
                  value={formData.fiscal_postal_code}
                  onChange={(e) => setFormData({ ...formData, fiscal_postal_code: e.target.value.replace(/\D/g, '').slice(0, 5) })}
                  className="ios-input"
                  placeholder="00000"
                  maxLength={5}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Colonia</Label>
                <input
                  value={formData.fiscal_colony}
                  onChange={(e) => setFormData({ ...formData, fiscal_colony: e.target.value })}
                  className="ios-input"
                  placeholder="Colonia"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Estado</Label>
                <input
                  value={formData.fiscal_state}
                  onChange={(e) => setFormData({ ...formData, fiscal_state: e.target.value })}
                  className="ios-input"
                  placeholder="Estado"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Marketing Source */}
        <div className="ios-card overflow-hidden animate-slide-up" style={{ animationDelay: '250ms' }}>
          <div className="p-5 border-b border-ios-gray-100 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-ios-orange flex items-center justify-center">
              <Search className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-ios-gray-900">¿Cómo te enteraste de nosotros?</h2>
              <p className="text-sm text-ios-gray-500">Ayúdanos a mejorar nuestro alcance</p>
            </div>
          </div>
          
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {sources.map((source) => (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => handleSourceChange(source.id)}
                  className={cn(
                    "p-4 rounded-2xl border-2 text-left transition-all duration-200 touch-feedback",
                    formData.source_id === source.id
                      ? "border-ios-blue bg-ios-blue/5"
                      : "border-ios-gray-200 hover:border-ios-gray-300"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "font-medium text-sm",
                      formData.source_id === source.id ? "text-ios-blue" : "text-ios-gray-700"
                    )}>
                      {source.name}
                    </span>
                    {formData.source_id === source.id && (
                      <div className="h-5 w-5 rounded-full bg-ios-blue flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {showReferrerField && (
              <div className="space-y-4 pt-4 border-t border-ios-gray-100 animate-fade-in">
                <Label className="text-sm font-medium text-ios-gray-600">¿Quién te recomendó?</Label>
                <Select
                  value={formData.referrer_patient_id}
                  onValueChange={(value) => setFormData({ ...formData, referrer_patient_id: value })}
                >
                  <SelectTrigger className="ios-input">
                    <SelectValue placeholder="Buscar paciente existente..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {patients.map((patient) => (
                      <SelectItem key={patient.id} value={patient.id}>
                        {patient.first_name} {patient.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-center text-sm text-ios-gray-500">o</div>
                <input
                  value={formData.referrer_name}
                  onChange={(e) => setFormData({ ...formData, referrer_name: e.target.value })}
                  className="ios-input"
                  placeholder="Escribir nombre manualmente"
                />
              </div>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-4 pt-4 animate-slide-up" style={{ animationDelay: '300ms' }}>
          <button 
            type="button"
            onClick={() => navigate('/patients')}
            className="flex-1 h-14 rounded-2xl bg-ios-gray-100 text-ios-gray-900 font-semibold text-lg hover:bg-ios-gray-200 transition-colors touch-feedback"
          >
            Cancelar
          </button>
          <button 
            type="submit"
            disabled={saving}
            className="flex-1 h-14 rounded-2xl bg-ios-blue text-white font-semibold text-lg hover:bg-ios-blue/90 transition-colors touch-feedback disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Guardando...
              </>
            ) : (
              <>
                Continuar al Doctor
                <ChevronRight className="h-5 w-5" />
              </>
            )}
          </button>
        </div>
      </form>
    </MainLayout>
  );
};

export default PatientIntake;