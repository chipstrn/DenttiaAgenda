"use client";

import React, { useEffect, useState, useCallback } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Search, Edit, Trash2, User, Phone, Mail, FileText, CheckCircle, Clock, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  created_at: string;
}

interface PatientRecord {
  patient_id: string;
  reception_completed_at: string | null;
  doctor_completed_at: string | null;
}

const Patients = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [records, setRecords] = useState<Record<string, PatientRecord>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchPatients = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPatients(data || []);

      // Fetch records status
      const { data: recordsData } = await supabase
        .from('patient_records')
        .select('patient_id, reception_completed_at, doctor_completed_at')
        .eq('user_id', user.id);

      const recordsMap: Record<string, PatientRecord> = {};
      recordsData?.forEach(r => {
        recordsMap[r.patient_id] = r;
      });
      setRecords(recordsMap);
    } catch (error) {
      console.error('Error fetching patients:', error);
      toast.error('Error al cargar pacientes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este paciente?')) return;
    
    try {
      const { error } = await supabase
        .from('patients')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Paciente eliminado');
      fetchPatients();
    } catch (error) {
      console.error('Error deleting patient:', error);
      toast.error('Error al eliminar paciente');
    }
  };

  const getRecordStatus = (patientId: string) => {
    const record = records[patientId];
    if (!record) return 'pending';
    if (record.doctor_completed_at) return 'complete';
    if (record.reception_completed_at) return 'reception';
    return 'pending';
  };

  const filteredPatients = patients.filter(p => 
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.phone?.includes(searchTerm)
  );

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">Pacientes</h1>
          <p className="text-ios-gray-500 mt-1 font-medium">{patients.length} pacientes registrados</p>
        </div>
        <button 
          onClick={() => navigate('/patient/new')}
          className="flex items-center gap-2 h-11 px-5 rounded-xl bg-ios-blue text-white font-semibold text-sm shadow-ios-sm hover:bg-ios-blue/90 transition-all duration-200 touch-feedback"
        >
          <Plus className="h-5 w-5" />
          Nuevo Paciente
        </button>
      </div>

      {/* Search */}
      <div className="mb-6 animate-fade-in" style={{ animationDelay: '50ms' }}>
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ios-gray-400" />
          <input
            type="text"
            placeholder="Buscar paciente..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full h-12 pl-12 pr-4 rounded-2xl bg-white border-0 text-base placeholder:text-ios-gray-400 focus:ring-2 focus:ring-ios-blue/30 focus:outline-none shadow-ios-sm transition-all duration-200"
          />
        </div>
      </div>

      {/* Status Legend */}
      <div className="flex gap-4 mb-4 text-sm animate-fade-in" style={{ animationDelay: '75ms' }}>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-ios-gray-300"></div>
          <span className="text-ios-gray-500">Pendiente</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-ios-orange"></div>
          <span className="text-ios-gray-500">Recepción</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-ios-green"></div>
          <span className="text-ios-gray-500">Completo</span>
        </div>
      </div>

      {/* Patients List */}
      <div className="ios-card overflow-hidden animate-slide-up" style={{ animationDelay: '100ms' }}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 border-3 border-ios-blue/30 border-t-ios-blue rounded-full animate-spin"></div>
          </div>
        ) : filteredPatients.length > 0 ? (
          <div className="divide-y divide-ios-gray-100">
            {filteredPatients.map((patient, index) => {
              const status = getRecordStatus(patient.id);
              return (
                <div 
                  key={patient.id}
                  className="flex items-center gap-4 p-4 hover:bg-ios-gray-50 transition-all duration-200 ease-ios cursor-pointer animate-fade-in"
                  style={{ animationDelay: `${150 + index * 30}ms` }}
                  onClick={() => navigate(`/patient/${patient.id}/intake`)}
                >
                  {/* Status Indicator */}
                  <div className={cn(
                    "h-3 w-3 rounded-full flex-shrink-0",
                    status === 'complete' ? 'bg-ios-green' :
                    status === 'reception' ? 'bg-ios-orange' : 'bg-ios-gray-300'
                  )} />

                  {/* Avatar */}
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-ios-blue to-ios-indigo flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-semibold">
                      {patient.first_name[0]}{patient.last_name[0]}
                    </span>
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ios-gray-900">
                      {patient.first_name} {patient.last_name}
                    </p>
                    <div className="flex items-center gap-4 mt-1">
                      {patient.email && (
                        <span className="flex items-center gap-1 text-sm text-ios-gray-500">
                          <Mail className="h-3.5 w-3.5" />
                          <span className="truncate max-w-[150px]">{patient.email}</span>
                        </span>
                      )}
                      {patient.phone && (
                        <span className="flex items-center gap-1 text-sm text-ios-gray-500">
                          <Phone className="h-3.5 w-3.5" />
                          {patient.phone}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5",
                    status === 'complete' ? 'bg-ios-green/15 text-ios-green' :
                    status === 'reception' ? 'bg-ios-orange/15 text-ios-orange' : 'bg-ios-gray-100 text-ios-gray-500'
                  )}>
                    {status === 'complete' ? (
                      <>
                        <CheckCircle className="h-3.5 w-3.5" />
                        Completo
                      </>
                    ) : status === 'reception' ? (
                      <>
                        <Clock className="h-3.5 w-3.5" />
                        Falta Doctor
                      </>
                    ) : (
                      <>
                        <Clock className="h-3.5 w-3.5" />
                        Pendiente
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); navigate(`/patient/${patient.id}/exam`); }}
                      className="h-10 w-10 rounded-xl bg-ios-purple/10 flex items-center justify-center hover:bg-ios-purple/20 transition-colors touch-feedback"
                      title="Odontograma"
                    >
                      <Stethoscope className="h-4 w-4 text-ios-purple" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); navigate(`/patient/${patient.id}/anamnesis`); }}
                      className="h-10 w-10 rounded-xl bg-ios-green/10 flex items-center justify-center hover:bg-ios-green/20 transition-colors touch-feedback"
                      title="Anamnesis (Doctor)"
                    >
                      <FileText className="h-4 w-4 text-ios-green" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); navigate(`/patient/${patient.id}/intake`); }}
                      className="h-10 w-10 rounded-xl bg-ios-gray-100 flex items-center justify-center hover:bg-ios-gray-200 transition-colors touch-feedback"
                      title="Editar (Recepción)"
                    >
                      <Edit className="h-4 w-4 text-ios-gray-600" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(patient.id); }}
                      className="h-10 w-10 rounded-xl bg-ios-red/10 flex items-center justify-center hover:bg-ios-red/20 transition-colors touch-feedback"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4 text-ios-red" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="h-20 w-20 rounded-full bg-ios-gray-100 flex items-center justify-center mx-auto mb-4">
              <User className="h-10 w-10 text-ios-gray-400" />
            </div>
            <p className="text-ios-gray-900 font-semibold">No hay pacientes</p>
            <p className="text-ios-gray-500 text-sm mt-1">Comienza agregando tu primer paciente</p>
            <button 
              onClick={() => navigate('/patient/new')}
              className="mt-4 text-ios-blue font-semibold text-sm hover:opacity-70 transition-opacity"
            >
              Agregar paciente
            </button>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Patients;