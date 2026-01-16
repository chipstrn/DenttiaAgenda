"use client";

import React, { useEffect, useState, useCallback } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Users, Calendar, DollarSign, Activity, TrendingUp, Clock, ChevronRight, Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, startOfDay, endOfDay, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  delay?: number;
  onClick?: () => void;
}

const StatCard = ({ title, value, icon: Icon, color, delay = 0, onClick }: StatCardProps) => (
  <button
    onClick={onClick}
    className={cn(
      "ios-card p-5 animate-slide-up text-left",
      onClick && "hover:bg-ios-gray-50 transition-colors cursor-pointer"
    )}
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="flex items-start justify-between mb-4">
      <div className={cn("h-11 w-11 rounded-2xl flex items-center justify-center", color)}>
        <Icon className="h-5 w-5 text-white" />
      </div>
    </div>
    <p className="text-2xl font-bold text-ios-gray-900 tracking-tight">{value}</p>
    <p className="text-sm text-ios-gray-500 font-medium mt-1">{title}</p>
  </button>
);

interface AppointmentItemProps {
  time: string;
  patient: string;
  treatment: string;
  status: string;
  delay?: number;
  onClick?: () => void;
}

const AppointmentItem = ({ time, patient, treatment, status, delay = 0, onClick }: AppointmentItemProps) => {
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-ios-green/15 text-ios-green';
      case 'in-progress': return 'bg-ios-blue/15 text-ios-blue';
      case 'completed': return 'bg-ios-gray-200 text-ios-gray-600';
      case 'cancelled': return 'bg-ios-red/15 text-ios-red';
      default: return 'bg-ios-orange/15 text-ios-orange';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Confirmada';
      case 'in-progress': return 'En Sala';
      case 'completed': return 'Completada';
      case 'cancelled': return 'Cancelada';
      default: return 'Agendada';
    }
  };

  return (
    <div 
      onClick={onClick}
      className="flex items-center gap-4 p-4 rounded-2xl hover:bg-ios-gray-100 transition-all duration-200 ease-ios cursor-pointer touch-feedback animate-slide-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="w-14 text-center">
        <p className="text-base font-bold text-ios-gray-900">{time}</p>
      </div>
      <div className="h-10 w-1 rounded-full bg-ios-blue"></div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-ios-gray-900 truncate">{patient}</p>
        <p className="text-sm text-ios-gray-500 truncate">{treatment}</p>
      </div>
      <div className={cn(
        "px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap",
        getStatusStyle(status)
      )}>
        {getStatusLabel(status)}
      </div>
      <ChevronRight className="h-5 w-5 text-ios-gray-300 flex-shrink-0" />
    </div>
  );
};

const QuickAction = ({ icon: Icon, title, subtitle, color, onClick, delay = 0 }: any) => (
  <button 
    onClick={onClick}
    className="flex items-center gap-4 w-full p-4 rounded-2xl bg-white hover:bg-ios-gray-50 transition-all duration-200 ease-ios touch-feedback shadow-ios-sm animate-slide-up"
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center", color)}>
      <Icon className="h-6 w-6 text-white" />
    </div>
    <div className="text-left flex-1">
      <p className="font-semibold text-ios-gray-900">{title}</p>
      <p className="text-sm text-ios-gray-500">{subtitle}</p>
    </div>
    <ChevronRight className="h-5 w-5 text-ios-gray-300" />
  </button>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [stats, setStats] = useState({
    patientsCount: 0,
    appointmentsToday: 0,
    monthlyRevenue: 0,
    activeTreatments: 0
  });
  const [todaysAppointments, setTodaysAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const today = new Date();
      const dayStart = startOfDay(today).toISOString();
      const dayEnd = endOfDay(today).toISOString();
      const monthStart = startOfMonth(today).toISOString();

      // Fetch ALL data (shared across clinic)
      const [
        patientsResult,
        appointmentsResult,
        paymentsResult,
        treatmentsResult
      ] = await Promise.all([
        supabase
          .from('patients')
          .select('id', { count: 'exact', head: true }),
        supabase
          .from('appointments')
          .select('*, patients(first_name, last_name)')
          .gte('start_time', dayStart)
          .lte('start_time', dayEnd)
          .order('start_time', { ascending: true }),
        supabase
          .from('payments')
          .select('amount')
          .eq('status', 'completed')
          .gte('created_at', monthStart),
        supabase
          .from('treatments')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
      ]);

      const monthlyRevenue = paymentsResult.data?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

      setStats({
        patientsCount: patientsResult.count || 0,
        appointmentsToday: appointmentsResult.data?.length || 0,
        monthlyRevenue,
        activeTreatments: treatmentsResult.count || 0
      });

      setTodaysAppointments(appointmentsResult.data || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Supabase Realtime subscription to auto-refresh appointments and stats
  useEffect(() => {
    const channel = supabase
      .channel('realtime-appointments')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'appointments' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'appointments' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  return (
    <MainLayout>
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">Dashboard</h1>
        <p className="text-ios-gray-500 mt-1 font-medium">
          {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatCard
          title="Ingresos del Mes"
          value={`$${stats.monthlyRevenue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          color="bg-ios-green"
          delay={0}
          onClick={() => navigate('/finance-audit')}
        />
        <StatCard
          title="Citas Hoy"
          value={stats.appointmentsToday}
          icon={Calendar}
          color="bg-ios-orange"
          delay={50}
          onClick={() => navigate('/agenda')}
        />
        <StatCard
          title="Total Pacientes"
          value={stats.patientsCount}
          icon={Users}
          color="bg-ios-blue"
          delay={100}
          onClick={() => navigate('/patients')}
        />
        <StatCard
          title="Tratamientos Activos"
          value={stats.activeTreatments}
          icon={Activity}
          color="bg-ios-purple"
          delay={150}
          onClick={() => navigate('/treatments')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Appointments */}
        <div className="lg:col-span-2">
          <div className="ios-card overflow-hidden animate-slide-up" style={{ animationDelay: '200ms' }}>
            <div className="flex items-center justify-between p-5 pb-3">
              <div>
                <h2 className="text-lg font-bold text-ios-gray-900">Citas de Hoy</h2>
                <p className="text-sm text-ios-gray-500">{stats.appointmentsToday} citas programadas</p>
              </div>
              <button 
                onClick={() => navigate('/agenda')}
                className="flex items-center gap-1 text-ios-blue font-semibold text-sm hover:opacity-70 transition-opacity touch-feedback"
              >
                Ver todas
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            
            <div className="px-2 pb-3">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-ios-blue" />
                </div>
              ) : todaysAppointments.length > 0 ? (
                <div className="space-y-1">
                  {todaysAppointments.slice(0, 5).map((apt, index) => (
                    <AppointmentItem 
                      key={apt.id}
                      time={format(new Date(apt.start_time), 'HH:mm')} 
                      patient={`${apt.patients?.first_name || ''} ${apt.patients?.last_name || ''}`.trim() || 'Sin paciente'} 
                      treatment={apt.title || 'Sin título'} 
                      status={apt.status}
                      delay={250 + (index * 50)}
                      onClick={() => navigate('/agenda')}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="h-16 w-16 rounded-full bg-ios-gray-100 flex items-center justify-center mx-auto mb-4">
                    <Calendar className="h-8 w-8 text-ios-gray-400" />
                  </div>
                  <p className="text-ios-gray-500 font-medium">No hay citas para hoy</p>
                  <button 
                    onClick={() => navigate('/agenda')}
                    className="mt-3 text-ios-blue font-semibold text-sm hover:opacity-70 transition-opacity"
                  >
                    Agendar una cita
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-ios-gray-900 animate-fade-in" style={{ animationDelay: '300ms' }}>
            Acciones Rápidas
          </h2>
          
          <QuickAction 
            icon={Plus}
            title="Nueva Cita"
            subtitle="Agendar paciente"
            color="bg-ios-blue"
            onClick={() => navigate('/agenda')}
            delay={350}
          />
          
          <QuickAction 
            icon={Users}
            title="Nuevo Paciente"
            subtitle="Registrar datos"
            color="bg-ios-green"
            onClick={() => navigate('/patient/new')}
            delay={400}
          />
          
          {isAdmin && (
            <QuickAction 
              icon={DollarSign}
              title="Registrar Pago"
              subtitle="Cobro rápido"
              color="bg-ios-teal"
              onClick={() => navigate('/finance')}
              delay={450}
            />
          )}

          {/* Reminder Card */}
          <div 
            className="p-4 rounded-2xl bg-ios-orange/10 border border-ios-orange/20 animate-slide-up"
            style={{ animationDelay: '500ms' }}
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-ios-orange/20 flex items-center justify-center flex-shrink-0">
                <Clock className="h-5 w-5 text-ios-orange" />
              </div>
              <div>
                <p className="font-semibold text-ios-gray-900 text-sm">Recordatorio</p>
                <p className="text-sm text-ios-gray-600 mt-0.5">
                  Tienes {stats.appointmentsToday} citas pendientes para hoy
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Dashboard;