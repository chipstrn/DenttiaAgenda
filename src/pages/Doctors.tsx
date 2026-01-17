"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Stethoscope, Edit, Trash2, Phone, Mail, Award, Loader2, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

interface Doctor {
  id: string;
  full_name: string;
  specialty: string | null;
  professional_license: string | null;
  university: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
}

const specialties = [
  'Odontología General',
  'Ortodoncia',
  'Endodoncia',
  'Periodoncia',
  'Cirugía Oral',
  'Odontopediatría',
  'Prostodoncia',
  'Implantología',
  'Estética Dental'
];

const Doctors = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [professionalLicense, setProfessionalLicense] = useState('');
  const [university, setUniversity] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [commissionPercentage, setCommissionPercentage] = useState('');
  const [doctorColor, setDoctorColor] = useState('#007AFF');

  const fetchDoctors = useCallback(async () => {
    try {
      const [doctorsResult, commissionsResult] = await Promise.all([
        supabase
          .from('doctors')
          .select('*')
          .order('full_name', { ascending: true }),
        supabase
          .from('commission_settings')
          .select('doctor_id, percentage')
      ]);

      if (doctorsResult.error) throw doctorsResult.error;

      const commissionsMap = new Map();
      commissionsResult.data?.forEach(c => commissionsMap.set(c.doctor_id, c.percentage));

      const doctorsWithCommissions = (doctorsResult.data || []).map(d => ({
        ...d,
        percentage: commissionsMap.get(d.id) || 0
      }));

      setDoctors(doctorsWithCommissions);
    } catch (error) {
      console.error('Error fetching doctors:', error);
      toast.error('Error al cargar doctores');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const resetForm = useCallback(() => {
    setFullName('');
    setSpecialty('');
    setProfessionalLicense('');
    setUniversity('');
    setPhone('');
    setEmail('');
    setAddress('');
    setCommissionPercentage('');
    setDoctorColor('#007AFF');
    setEditingDoctor(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    if (!fullName.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    setSaving(true);
    try {
      const doctorData = {
        full_name: fullName.trim(),
        specialty: specialty || null,
        professional_license: professionalLicense.trim() || null,
        university: university.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        color: doctorColor,
        is_active: true
      };

      let doctorId;

      if (editingDoctor) {
        doctorId = editingDoctor.id;
        const { error } = await supabase
          .from('doctors')
          .update(doctorData)
          .eq('id', doctorId);

        if (error) throw error;
        toast.success('Doctor actualizado');
      } else {
        const { data, error } = await supabase
          .from('doctors')
          .insert({ ...doctorData, user_id: user.id })
          .select()
          .single();

        if (error) throw error;
        doctorId = data.id;
        toast.success('Doctor agregado');
      }

      // Save commission
      if (commissionPercentage) {
        const { error: commError } = await supabase
          .from('commission_settings')
          .upsert({
            doctor_id: doctorId,
            percentage: parseFloat(commissionPercentage)
          }, { onConflict: 'doctor_id' });

        if (commError) throw commError;
      }

      setIsDialogOpen(false);
      resetForm();
      fetchDoctors();
    } catch (error) {
      console.error('Error saving doctor:', error);
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = useCallback((doctor: any) => {
    setEditingDoctor(doctor);
    setFullName(doctor.full_name || '');
    setSpecialty(doctor.specialty || '');
    setProfessionalLicense(doctor.professional_license || '');
    setUniversity(doctor.university || '');
    setPhone(doctor.phone || '');
    setEmail(doctor.email || '');
    setAddress(doctor.address || '');
    setCommissionPercentage(doctor.percentage?.toString() || '');
    setDoctorColor(doctor.color || '#007AFF');
    setIsDialogOpen(true);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('¿Eliminar este doctor?')) return;

    try {
      const { error } = await supabase
        .from('doctors')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setDoctors(prev => prev.filter(d => d.id !== id));
      toast.success('Doctor eliminado');
    } catch (error) {
      console.error('Error deleting doctor:', error);
      toast.error('Error al eliminar');
    }
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">Doctores</h1>
          <p className="text-ios-gray-500 mt-1 font-medium">{doctors.length} profesionales registrados</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/finance/commissions')}
            className="flex items-center gap-2 h-11 px-5 rounded-xl bg-white text-ios-gray-900 font-semibold text-sm shadow-ios-sm hover:bg-ios-gray-50 transition-all duration-200 touch-feedback"
          >
            <DollarSign className="h-5 w-5 text-ios-green" />
            Reporte Comisiones
          </button>
          <button
            onClick={() => setIsDialogOpen(true)}
            className="flex items-center gap-2 h-11 px-5 rounded-xl bg-ios-indigo text-white font-semibold text-sm shadow-ios-sm hover:bg-ios-indigo/90 transition-all duration-200 touch-feedback"
          >
            <Plus className="h-5 w-5" />
            Nuevo Doctor
          </button>
        </div>
      </div>

      {/* Doctors Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-ios-indigo" />
        </div>
      ) : doctors.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {doctors.map((doctor, index) => (
            <div
              key={doctor.id}
              className="ios-card p-5 animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="h-14 w-14 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: doctor.color || '#007AFF' }}
                >
                  <span className="text-white font-bold text-lg">
                    {getInitials(doctor.full_name)}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(doctor)}
                    className="h-9 w-9 rounded-xl bg-ios-gray-100 flex items-center justify-center hover:bg-ios-gray-200 transition-colors touch-feedback"
                  >
                    <Edit className="h-4 w-4 text-ios-gray-600" />
                  </button>
                  <button
                    onClick={() => handleDelete(doctor.id)}
                    className="h-9 w-9 rounded-xl bg-ios-red/10 flex items-center justify-center hover:bg-ios-red/20 transition-colors touch-feedback"
                  >
                    <Trash2 className="h-4 w-4 text-ios-red" />
                  </button>
                </div>
              </div>

              <h3 className="font-bold text-ios-gray-900 text-lg">
                {doctor.full_name}
              </h3>
              <div className="flex flex-wrap gap-2 mt-2">
                {doctor.specialty && (
                  <span className="inline-block px-2.5 py-1 rounded-lg bg-ios-indigo/10 text-ios-indigo text-xs font-semibold">
                    {doctor.specialty}
                  </span>
                )}
                {doctor.percentage > 0 && (
                  <span className="inline-block px-2.5 py-1 rounded-lg bg-ios-green/10 text-ios-green text-xs font-semibold flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    {doctor.percentage}% Com.
                  </span>
                )}
              </div>

              <div className="mt-4 space-y-2">
                {doctor.professional_license && (
                  <div className="flex items-center gap-2 text-sm text-ios-gray-500">
                    <Award className="h-4 w-4" />
                    Cédula: {doctor.professional_license}
                  </div>
                )}
                {doctor.phone && (
                  <div className="flex items-center gap-2 text-sm text-ios-gray-500">
                    <Phone className="h-4 w-4" />
                    {doctor.phone}
                  </div>
                )}
                {doctor.email && (
                  <div className="flex items-center gap-2 text-sm text-ios-gray-500">
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{doctor.email}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="ios-card text-center py-16 animate-fade-in">
          <div className="h-20 w-20 rounded-full bg-ios-gray-100 flex items-center justify-center mx-auto mb-4">
            <Stethoscope className="h-10 w-10 text-ios-gray-400" />
          </div>
          <p className="text-ios-gray-900 font-semibold">Sin doctores</p>
          <p className="text-ios-gray-500 text-sm mt-1">Agrega profesionales a tu equipo</p>
          <button
            onClick={() => setIsDialogOpen(true)}
            className="mt-4 text-ios-indigo font-semibold text-sm hover:opacity-70 transition-opacity"
          >
            Agregar doctor
          </button>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl border-0 shadow-ios-xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="text-xl font-bold text-ios-gray-900">
              {editingDoctor ? 'Editar Doctor' : 'Nuevo Doctor'}
            </DialogTitle>
            <DialogDescription className="text-ios-gray-500">
              {editingDoctor ? 'Modifica los datos del doctor' : 'Agrega un profesional al equipo'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="px-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Other inputs remain same, add Commission */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Nombre Completo *</Label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Dr. Juan Pérez García"
                  required
                  className="ios-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Especialidad</Label>
                <select
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="ios-input"
                >
                  <option value="">Seleccionar especialidad</option>
                  {specialties.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-ios-gray-600">Comisión (%)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ios-gray-400" />
                    <input
                      type="number"
                      value={commissionPercentage}
                      onChange={(e) => setCommissionPercentage(e.target.value)}
                      placeholder="Ej: 30"
                      className="ios-input pl-10"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-ios-gray-600">Teléfono</Label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(238) 123-4567"
                    className="ios-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Cédula Profesional</Label>
                <input
                  value={professionalLicense}
                  onChange={(e) => setProfessionalLicense(e.target.value)}
                  placeholder="12345678"
                  className="ios-input"
                />
              </div>
              {/* University, Email, Address inputs... */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Universidad</Label>
                <input
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                  placeholder="Universidad de origen"
                  className="ios-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Email</Label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="doctor@clinica.com"
                  className="ios-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Dirección</Label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Dirección del consultorio"
                  className="ios-input"
                />
              </div>

              {/* Color Picker for Calendar */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Color en Agenda</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={doctorColor}
                    onChange={(e) => setDoctorColor(e.target.value)}
                    className="h-10 w-16 rounded-lg border-0 cursor-pointer"
                  />
                  <div className="flex gap-2">
                    {['#007AFF', '#34C759', '#FF9500', '#AF52DE', '#FF2D55', '#5856D6', '#00C7BE', '#FF375F'].map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setDoctorColor(color)}
                        className={`h-8 w-8 rounded-full transition-transform ${doctorColor === color ? 'ring-2 ring-offset-2 ring-ios-blue scale-110' : 'hover:scale-105'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-ios-gray-500">Este color identificará al doctor en el calendario</p>
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
                className="flex-1 h-12 rounded-xl bg-ios-indigo text-white font-semibold hover:bg-ios-indigo/90 transition-colors touch-feedback disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  editingDoctor ? 'Guardar' : 'Agregar'
                )}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Doctors;