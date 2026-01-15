"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar, DollarSign, Activity, TrendingUp, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const StatCard = ({ title, value, description, icon: Icon, trend, trendUp }: any) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-slate-600">
        {title}
      </CardTitle>
      <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center">
        <Icon className="h-4 w-4 text-blue-600" />
      </div>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      {trend && (
        <div className="flex items-center mt-1">
          <span className={`text-xs ${trendUp ? 'text-emerald-600' : 'text-red-600'} flex items-center font-medium`}>
            {trendUp ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingUp className="h-3 w-3 mr-1 rotate-180" />}
            {trend}
          </span>
          <span className="text-xs text-slate-500 ml-1">vs mes anterior</span>
        </div>
      )}
    </CardContent>
  </Card>
);

const AppointmentItem = ({ time, patient, treatment, status }: any) => (
  <div className="flex items-center justify-between p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors rounded-lg">
    <div className="flex items-center gap-4">
      <div className="w-16 text-center">
        <p className="text-sm font-bold text-slate-900">{time}</p>
      </div>
      <div>
        <p className="font-medium text-slate-900">{patient}</p>
        <p className="text-sm text-slate-500">{treatment}</p>
      </div>
    </div>
    <div className={`px-3 py-1 rounded-full text-xs font-medium 
      ${status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 
        status === 'in-progress' ? 'bg-blue-100 text-blue-700' : 
        status === 'scheduled' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
      {status === 'confirmed' ? 'Confirmada' : 
       status === 'in-progress' ? 'En Sala' : 
       status === 'scheduled' ? 'Agendada' : status}
    </div>
  </div>
);

const Dashboard = () => {
  const [stats, setStats] = useState({
    patientsCount: 0,
    appointmentsToday: 0,
    activeTreatments: 0
  });
  const [todaysAppointments, setTodaysAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch Patients Count
        const { count: patientsCount } = await supabase
          .from('patients')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        // Fetch Today's Appointments
        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
        const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

        const { data: appointments, count: appointmentsCount } = await supabase
          .from('appointments')
          .select('*, patients(first_name, last_name)')
          .eq('user_id', user.id)
          .gte('start_time', startOfDay)
          .lte('start_time', endOfDay)
          .order('start_time', { ascending: true });

        // Update state
        setStats({
          patientsCount: patientsCount || 0,
          appointmentsToday: appointmentsCount || 0,
          activeTreatments: 45 // Placeholder until treatments table exists
        });

        setTodaysAppointments(appointments || []);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <MainLayout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Resumen general de tu clínica</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <Calendar className="h-4 w-4" />
            Ver Agenda
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
            <Users className="h-4 w-4" />
            Nuevo Paciente
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Ingresos del Mes" 
          value="$0.00" 
          icon={DollarSign} 
          trend="+0%" 
          trendUp={true} 
        />
        <StatCard 
          title="Citas Hoy" 
          value={stats.appointmentsToday} 
          icon={Calendar} 
          // trend="+4.3%" 
          // trendUp={true} 
        />
        <StatCard 
          title="Total Pacientes" 
          value={stats.patientsCount} 
          icon={Users} 
          // trend="+8.1%" 
          // trendUp={true} 
        />
        <StatCard 
          title="Tratamientos Activos" 
          value={stats.activeTreatments} 
          icon={Activity} 
          // trend="-2.4%" 
          // trendUp={false} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upcoming Appointments */}
        <Card className="col-span-1 lg:col-span-2 shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Citas de Hoy</span>
              <Button variant="ghost" size="sm" className="text-blue-600 text-sm">Ver todas</Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="px-6 pb-4 space-y-1">
              {loading ? (
                <div className="text-center py-8 text-slate-400">Cargando citas...</div>
              ) : todaysAppointments.length > 0 ? (
                todaysAppointments.map((apt) => (
                  <AppointmentItem 
                    key={apt.id}
                    time={format(new Date(apt.start_time), 'hh:mm a')} 
                    patient={`${apt.patients?.first_name} ${apt.patients?.last_name}`} 
                    treatment={apt.title} 
                    status={apt.status} 
                  />
                ))
              ) : (
                <div className="text-center py-8 text-slate-400">No hay citas para hoy.</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions / Notifications */}
        <Card className="col-span-1 shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full justify-start h-auto py-3 px-4 border-slate-200 hover:bg-slate-50 hover:border-blue-300 group">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center mr-4 group-hover:bg-blue-200 transition-colors">
                <DollarSign className="h-5 w-5 text-blue-700" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-slate-900">Registrar Pago</p>
                <p className="text-xs text-slate-500">Ingresar cobro rápido</p>
              </div>
            </Button>
            
            <Button variant="outline" className="w-full justify-start h-auto py-3 px-4 border-slate-200 hover:bg-slate-50 hover:border-emerald-300 group">
              <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center mr-4 group-hover:bg-emerald-200 transition-colors">
                <Clock className="h-5 w-5 text-emerald-700" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-slate-900">Lista de Espera</p>
                <p className="text-xs text-slate-500">Ver pacientes en espera</p>
              </div>
            </Button>
            
            <div className="mt-6 pt-6 border-t border-slate-100">
              <h4 className="text-sm font-semibold text-slate-900 mb-3">Recordatorios</h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <Activity className="h-4 w-4 text-amber-600 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-amber-900">Inventario Bajo</p>
                    <p className="text-xs text-amber-700 mt-0.5">Quedan pocas unidades de Anestesia Local.</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Dashboard;