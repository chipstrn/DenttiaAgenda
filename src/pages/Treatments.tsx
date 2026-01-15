"use client";

import React, { useEffect, useState } from 'react';
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
import { Plus, Search, Edit, Trash2, Activity, Clock, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Treatment {
  id: string;
  name: string;
  description: string;
  category: string;
  base_price: number;
  duration_minutes: number;
  is_active: boolean;
}

const categories = [
  'Preventivo',
  'Restaurativo',
  'Endodoncia',
  'Periodoncia',
  'Cirugía',
  'Ortodoncia',
  'Estética',
  'Prótesis',
  'Otro'
];

const categoryColors: Record<string, string> = {
  'Preventivo': 'bg-ios-green',
  'Restaurativo': 'bg-ios-blue',
  'Endodoncia': 'bg-ios-orange',
  'Periodoncia': 'bg-ios-pink',
  'Cirugía': 'bg-ios-red',
  'Ortodoncia': 'bg-ios-purple',
  'Estética': 'bg-ios-indigo',
  'Prótesis': 'bg-ios-teal',
  'Otro': 'bg-ios-gray-500',
};

const Treatments = () => {
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    base_price: '',
    duration_minutes: '30',
    is_active: true
  });

  const fetchTreatments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('treatments')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (error) throw error;
      setTreatments(data || []);
    } catch (error) {
      console.error('Error fetching treatments:', error);
      toast.error('Error al cargar tratamientos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTreatments();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const treatmentData = {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        base_price: parseFloat(formData.base_price) || 0,
        duration_minutes: parseInt(formData.duration_minutes) || 30,
        is_active: formData.is_active
      };

      if (editingTreatment) {
        const { error } = await supabase
          .from('treatments')
          .update(treatmentData)
          .eq('id', editingTreatment.id);

        if (error) throw error;
        toast.success('Tratamiento actualizado');
      } else {
        const { error } = await supabase
          .from('treatments')
          .insert({ ...treatmentData, user_id: user.id });

        if (error) throw error;
        toast.success('Tratamiento creado');
      }

      setIsDialogOpen(false);
      setEditingTreatment(null);
      setFormData({
        name: '',
        description: '',
        category: '',
        base_price: '',
        duration_minutes: '30',
        is_active: true
      });
      fetchTreatments();
    } catch (error) {
      console.error('Error saving treatment:', error);
      toast.error('Error al guardar tratamiento');
    }
  };

  const handleEdit = (treatment: Treatment) => {
    setEditingTreatment(treatment);
    setFormData({
      name: treatment.name,
      description: treatment.description || '',
      category: treatment.category || '',
      base_price: treatment.base_price?.toString() || '',
      duration_minutes: treatment.duration_minutes?.toString() || '30',
      is_active: treatment.is_active
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este tratamiento?')) return;
    
    try {
      const { error } = await supabase
        .from('treatments')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Tratamiento eliminado');
      fetchTreatments();
    } catch (error) {
      console.error('Error deleting treatment:', error);
      toast.error('Error al eliminar');
    }
  };

  const filteredTreatments = treatments.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || t.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">Tratamientos</h1>
          <p className="text-ios-gray-500 mt-1 font-medium">Catálogo de servicios</p>
        </div>
        <button 
          onClick={() => setIsDialogOpen(true)}
          className="flex items-center gap-2 h-11 px-5 rounded-xl bg-ios-purple text-white font-semibold text-sm shadow-ios-sm hover:bg-ios-purple/90 transition-all duration-200 touch-feedback"
        >
          <Plus className="h-5 w-5" />
          Nuevo Tratamiento
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6 animate-fade-in" style={{ animationDelay: '50ms' }}>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ios-gray-400" />
          <input
            type="text"
            placeholder="Buscar tratamiento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-12 pl-12 pr-4 rounded-2xl bg-white border-0 text-base placeholder:text-ios-gray-400 focus:ring-2 focus:ring-ios-purple/30 focus:outline-none shadow-ios-sm transition-all duration-200"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[180px] h-12 rounded-2xl bg-white border-0 shadow-ios-sm">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">Todas</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Treatments Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 border-3 border-ios-purple/30 border-t-ios-purple rounded-full animate-spin"></div>
        </div>
      ) : filteredTreatments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTreatments.map((treatment, index) => (
            <div 
              key={treatment.id} 
              className="ios-card p-5 animate-slide-up"
              style={{ animationDelay: `${100 + index * 50}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={cn(
                  "h-11 w-11 rounded-2xl flex items-center justify-center",
                  categoryColors[treatment.category] || 'bg-ios-gray-500'
                )}>
                  <Activity className="h-5 w-5 text-white" />
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => handleEdit(treatment)}
                    className="h-9 w-9 rounded-xl bg-ios-gray-100 flex items-center justify-center hover:bg-ios-gray-200 transition-colors touch-feedback"
                  >
                    <Edit className="h-4 w-4 text-ios-gray-600" />
                  </button>
                  <button 
                    onClick={() => handleDelete(treatment.id)}
                    className="h-9 w-9 rounded-xl bg-ios-red/10 flex items-center justify-center hover:bg-ios-red/20 transition-colors touch-feedback"
                  >
                    <Trash2 className="h-4 w-4 text-ios-red" />
                  </button>
                </div>
              </div>
              
              <h3 className="font-bold text-ios-gray-900 mb-1">{treatment.name}</h3>
              {treatment.category && (
                <span className={cn(
                  "inline-block px-2.5 py-1 rounded-lg text-xs font-semibold mb-3",
                  `${categoryColors[treatment.category]}/15 text-ios-gray-700`
                )}>
                  {treatment.category}
                </span>
              )}
              {treatment.description && (
                <p className="text-sm text-ios-gray-500 mb-4 line-clamp-2">{treatment.description}</p>
              )}
              
              <div className="flex items-center justify-between pt-3 border-t border-ios-gray-100">
                <div className="flex items-center gap-1.5 text-ios-gray-500">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm font-medium">{treatment.duration_minutes} min</span>
                </div>
                <div className="flex items-center gap-1 text-ios-green font-bold">
                  <DollarSign className="h-4 w-4" />
                  <span>{treatment.base_price?.toFixed(2) || '0.00'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="ios-card text-center py-16 animate-fade-in">
          <div className="h-20 w-20 rounded-full bg-ios-gray-100 flex items-center justify-center mx-auto mb-4">
            <Activity className="h-10 w-10 text-ios-gray-400" />
          </div>
          <p className="text-ios-gray-900 font-semibold">Sin tratamientos</p>
          <p className="text-ios-gray-500 text-sm mt-1">Agrega servicios a tu catálogo</p>
          <button 
            onClick={() => setIsDialogOpen(true)}
            className="mt-4 text-ios-purple font-semibold text-sm hover:opacity-70 transition-opacity"
          >
            Agregar tratamiento
          </button>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
          setEditingTreatment(null);
          setFormData({
            name: '',
            description: '',
            category: '',
            base_price: '',
            duration_minutes: '30',
            is_active: true
          });
        }
      }}>
        <DialogContent className="sm:max-w-[450px] rounded-3xl border-0 shadow-ios-xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="text-xl font-bold text-ios-gray-900">
              {editingTreatment ? 'Editar Tratamiento' : 'Nuevo Tratamiento'}
            </DialogTitle>
            <DialogDescription className="text-ios-gray-500">
              {editingTreatment ? 'Modifica los datos' : 'Agrega un nuevo servicio'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit}>
            <div className="px-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Nombre *</Label>
                <input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Limpieza Dental"
                  required
                  className="ios-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Categoría</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger className="ios-input">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-ios-gray-600">Precio ($)</Label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.base_price}
                    onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                    placeholder="0.00"
                    className="ios-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-ios-gray-600">Duración (min)</Label>
                  <input
                    type="number"
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                    className="ios-input"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Descripción</Label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
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
                className="flex-1 h-12 rounded-xl bg-ios-purple text-white font-semibold hover:bg-ios-purple/90 transition-colors touch-feedback"
              >
                {editingTreatment ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Treatments;