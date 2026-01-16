"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { 
  Plus, 
  Edit, 
  Trash2, 
  User, 
  Phone, 
  Mail, 
  Award,
  Building,
  Stethoscope
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Doctor {
  id: string;
  full_name: string;
  specialty: string;
  professional_license: string;
  university: string;
  phone: string;
  email: string;
  address: string;
  is_active: boolean;
}

const Doctors = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  
  const [formData, setFormData] = useState({
    full_name: '',
    specialty: '',
    professional_license: '',
    university: '',
    phone: '',
    email: '',
    address: ''
  });

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('doctors')
        .select('*')
        .eq('user_id', user.id)
        .order('full_name');

      if (error) throw error;
      setDoctors(data || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
      toast.error('Error al cargar doctores');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (editingDoctor) {
        const { error } = await supabase
          .from('doctors')
          .update(formData)
          .eq('id', editingDoctor.id);

        if (error) throw error;
        toast.success('Doctor actualizado');
      } else {
        const { error } = await supabase
          .from('doctors')
          .insert({ ...formData, user_id: user.id });

        if (error) throw error;
        toast.success('Doctor agregado');
      }

      setIsDialogOpen(false);
      setEditingDoctor(null);
      setFormData({
        full_name: '',
        specialty: '',
        professional_license: '',
        university: '',
        phone: '',
        email: '',
        address: ''
      });
      fetchDoctors();
    } catch (error) {
      console.error('Error saving doctor:', error);
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (doctor: Doctor) => {
    setEditingDoctor(doctor);
    setFormData({
      full_name: doctor.full_name,
      specialty: doctor.specialty || '',
      professional_license: doctor.professional_license || '',
      university: doctor.university || '',
      phone: doctor.phone || '',
      email: doctor.email || '',
      address: doctor.address || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este doctor?')) return;

    try {
      const { error } = await supabase
        .from('doctors')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Doctor eliminado');
      fetchDoctors();
    } catch (error) {
      console.error('Error deleting doctor:', error);
      toast.error('Error al eliminar');
    }
  };

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">Doctores</h1>
          <p className="text-ios-gray-500 mt-1 font-medium">Gestiona la información del equipo médico</p>
        </div>
        <button
          onClick={() => setIsDialogOpen(true)}
          className="flex items-center gap-2 h-11 px-5 rounded-xl bg-ios-blue text-white font-semibold text-sm shadow-ios-sm hover:bg-ios-blue/90 transition-all duration-200 touch-feedback"
        >
          <Plus className="h-5 w-5" />
          Nuevo Doctor
        </button>
      </div>

      {/* Doctors Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 border-3 border-ios-blue/30 border-t-ios-blue rounded-full animate-spin"></div>
        </div>
      ) : doctors.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {doctors.map((doctor, index) => (
            <div
              key={doctor.id}
              className="ios-card p-6 animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-ios-blue to-ios-indigo flex items-center justify-center">
                  <Stethoscope className="h-7 w-7 text-white" />
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

              <h3 className="font-bold text-lg text-ios-gray-900 mb-1">{doctor.full_name}</h3>
              {doctor.specialty && (
                <p className="text-ios-blue font-medium text-sm mb-3">{doctor.specialty}</p>
              )}

              <div className="space-y-2 text-sm">
                {doctor.professional_license && (
                  <div className="flex items-center gap-2 text-ios-gray-600">
                    <Award className="h-4 w-4 text-ios-gray-400" />
                    <span>Cédula: {doctor.professional_license}</span>
                  </div>
                )}
                {doctor.university && (
                  <div className="flex items-center gap-2 text-ios-gray-600">
                    <Building className="h-4 w-4 text-ios-gray-400" />
                    <span>{doctor.university}</span>
                  </div>
                )}
                {doctor.phone && (
                  <div className="flex items-center gap-2 text-ios-gray-600">
                    <Phone className="h-4 w-4 text-ios-gray-400" />
                    <span>{doctor.phone}</span>
                  </div>
                )}
                {doctor.email && (
                  <div className="flex items-center gap-2 text-ios-gray-600">
                    <Mail className="h-4 w-4 text-ios-gray-400" />
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
          <p className="text-ios-gray-900 font-semibold">Sin doctores registrados</p>
          <p className="text-ios-gray-500 text-sm mt-1">Agrega la información de tu equipo médico</p>
          <button
            onClick={() => setIsDialogOpen(true)}
            className="mt-4 text-ios-blue font-semibold text-sm hover:opacity-70 transition-opacity"
          >
            Agregar doctor
          </button>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
          setEditingDoctor(null);
          setFormData({
            full_name: '',
            specialty: '',
            professional_license: '',
            university: '',
            phone: '',
            email: '',
            address: ''
          });
        }
      }}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl border-0 shadow-ios-xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="text-xl font-bold text-ios-gray-900">
              {editingDoctor ? 'Editar Doctor' : 'Nuevo Doctor'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="px-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Nombre Completo *</Label>
                <input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                  className="ios-input"
                  placeholder="Dr. Juan Pérez García"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Especialidad</Label>
                <input
                  value={formData.specialty}
                  onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                  className="ios-input"
                  placeholder="Odontología General, Ortodoncia, etc."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-ios-gray-600">Cédula Profesional</Label>
                  <input
                    value={formData.professional_license}
                    onChange={(e) => setFormData({ ...formData, professional_license: e.target.value })}
                    className="ios-input"
                    placeholder="12345678"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-ios-gray-600">Teléfono</Label>
                  <input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="ios-input"
                    placeholder="2381234567"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Universidad</Label>
                <input
                  value={formData.university}
                  onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                  className="ios-input"
                  placeholder="Benemérita Universidad Autónoma de Puebla"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Email</Label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="ios-input"
                  placeholder="doctor@clinica.com"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Dirección del Consultorio</Label>
                <input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="ios-input"
                  placeholder="Calle, Número, Colonia, Ciudad"
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
                {saving ? 'Guardando...' : editingDoctor ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Doctors;