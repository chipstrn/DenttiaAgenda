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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Stethoscope, Edit, Trash2, Phone, Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Doctor {
  id: string;
  first_name: string;
  last_name: string;
  specialty: string;
  phone: string;
  email: string;
  license_number: string;
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
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  
  // Individual form states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');

  const fetchDoctors = useCallback(async () => {
    try {
      // Fetch ALL doctors (shared data)
      const { data, error } = await supabase
        .from('doctors')
        .select('*')
        .order('first_name', { ascending: true });

      if (error) throw error;
      setDoctors(data || []);
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
    setFirstName('');
    setLastName('');
    setSpecialty('');
    setPhone('');
    setEmail('');
    setLicenseNumber('');
    setEditingDoctor(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setSaving(true);
    try {
      const doctorData = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        specialty,
        phone: phone.trim(),
        email: email.trim(),
        license_number: licenseNumber.trim(),
        is_active: true
      };

      if (editingDoctor) {
        const { error } = await supabase
          .from('doctors')
          .update(doctorData)
          .eq('id', editingDoctor.id);

        if (error) throw error;
        toast.success('Doctor actualizado');
      } else {
        const { error } = await supabase
          .from('doctors')
          .insert({ ...doctorData, user_id: user.id });

        if (error) throw error;
        toast.success('Doctor agregado');
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

  const handleEdit = useCallback((doctor: Doctor) => {
    setEditingDoctor(doctor);
    setFirstName(doctor.first_name || '');
    setLastName(doctor.last_name || '');
    setSpecialty(doctor.specialty || '');
    setPhone(doctor.phone || '');
    setEmail(doctor.email || '');
    setLicenseNumber(doctor.license_number || '');
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

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">Doctores</h1>
          <p className="text-ios-gray-500 mt-1 font-medium">{doctors.length} profesionales registrados</p>
        </div>
        <button 
          onClick={() => setIsDialogOpen(true)}
          className="flex items-center gap-2 h-11 px-5 rounded-xl bg-ios-indigo text-white font-semibold text-sm shadow-ios-sm hover:bg-ios-indigo/90 transition-all duration-200 touch-feedback"
        >
          <Plus className="h-5 w-5" />
          Nuevo Doctor
        </button>
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
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-ios-indigo to-ios-purple flex items-center justify-center">
                  <span className="text-white font-bold text-lg">
                    {doctor.first_name?.[0]}{doctor.last_name?.[0]}
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
                Dr. {doctor.first_name} {doctor.last_name}
              </h3>
              {doctor.specialty && (
                <span className="inline-block px-2.5 py-1 rounded-lg bg-ios-indigo/10 text-ios-indigo text-xs font-semibold mt-2">
                  {doctor.specialty}
                </span>
              )}
              
              <div className="mt-4 space-y-2">
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
                {doctor.license_number && (
                  <div className="flex items-center gap-2 text-sm text-ios-gray-500">
                    <Stethoscope className="h-4 w-4" />
                    Cédula: {doctor.license_number}
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
        <DialogContent className="sm:max-w-[450px] rounded-3xl border-0 shadow-ios-xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="text-xl font-bold text-ios-gray-900">
              {editingDoctor ? 'Editar Doctor' : 'Nuevo Doctor'}
            </DialogTitle>
            <DialogDescription className="text-ios-gray-500">
              {editingDoctor ? 'Modifica los datos' : 'Agrega un profesional'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit}>
            <div className="px-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-ios-gray-600">Nombre *</Label>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Nombre"
                    required
                    className="ios-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-ios-gray-600">Apellido *</Label>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Apellido"
                    required
                    className="ios-input"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Especialidad</Label>
                <select
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="ios-input"
                >
                  <option value="">Seleccionar</option>
                  {specialties.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Teléfono</Label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(000) 000-0000"
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
                <Label className="text-sm font-medium text-ios-gray-600">Cédula Profesional</Label>
                <input
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder="Número de cédula"
                  className="ios-input"
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