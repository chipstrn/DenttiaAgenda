import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, Calendar, DollarSign, Activity, 
  ArrowUpRight, ArrowDownRight, Clock, CheckCircle2 
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom'; // <--- 1. IMPORTANTE PARA LA NAVEGACIÓN

interface DashboardStats {
  totalPatients: number;
  todayAppointments: number;
  monthlyIncome: number;
  pendingBalance: number;
}

interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  patients: {
    first_name: string;
    last_name: string;
  };
}

const Dashboard = () => {
  const navigate = useNavigate(); // <--- 2. HOOK DE NAVEGACIÓN
  const [stats, setStats] = useState<DashboardStats>({
    totalPatients: 0,
    todayAppointments: 0,
    monthlyIncome: 0,
    pendingBalance: 0
  });
  const [todayAppointmentsList, setTodayAppointmentsList] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  // Función para cargar datos (Reutilizable)
  const fetchDashboardData = async () => {
    try {
      // 1. Cargar Estadísticas
      const { count: patientsCount } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true });

      const today = new Date().toISOString().split('T')[0];
      const { count: appointmentsCount } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('appointment_date', today);

      // 2. Cargar Lista de Citas de Hoy (Para Recordatorios)
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          *,
          patients (first_name, last_name)
        `)
        .eq('appointment_date', today)
        .order('start_time', { ascending: true });

      if (appointmentsError) throw appointmentsError;

      setStats({
        totalPatients: patientsCount || 0,
        todayAppointments: appointmentsCount || 0,
        monthlyIncome: 0, // Pendiente de implementar lógica financiera real
        pendingBalance: 0
      });

      setTodayAppointmentsList(appointmentsData || []);

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // 3. SUSCRIPCIÓN EN TIEMPO REAL (SOLUCIÓN A RECORDATORIOS ESTÁTICOS)
    // Esto hace que si cambias el estado de una cita en otra pantalla, 
    // el dashboard se actualice solito.
    const channel = supabase
      .channel('dashboard-updates')
      .on(
        'postgres_changes',
        {
          event: '*', // Escuchar INSERT, UPDATE y DELETE
          schema: 'public',
          table: 'appointments'
        },
        (payload) => {
          console.log('Cambio detectado en citas:', payload);
          fetchDashboardData(); // <--- RECARGAR DATOS AUTOMÁTICAMENTE
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <MainLayout>
      <div className="mb-8 animate-fade-in">
        <h1 className="text-2xl font-bold text-gray-900">Panel Principal</h1>
        <p className="text-gray-500">
          Resumen del día - {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
        </p>
      </div>

      {/* Grid de Tarjetas de Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        
        {/* RECUADRO AZUL - PACIENTES (AHORA CLICABLE) */}
        <div 
          onClick={() => navigate('/patients')} // <--- ACCIÓN AL HACER CLICK
          className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <span className="flex items-center text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
              <ArrowUpRight className="h-3 w-3 mr-1" /> +12%
            </span>
          </div>
          <h3 className="text-gray-500 text-sm font-medium">Total Pacientes</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalPatients}</p>
        </div>

        {/* RECUADRO NARANJA/ROJO - CITAS HOY (AHORA CLICABLE) */}
        <div 
          onClick={() => navigate('/agenda')} // <--- ACCIÓN AL HACER CLICK
          className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-50 rounded-xl group-hover:bg-orange-100 transition-colors">
              <Calendar className="h-6 w-6 text-orange-600" />
            </div>
            <span className="flex items-center text-xs font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
              Hoy
            </span>
          </div>
          <h3 className="text-gray-500 text-sm font-medium">Citas para Hoy</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.todayAppointments}</p>
        </div>

        {/* RECUADRO VERDE - INGRESOS (CLICABLE A CAJA) */}
        <div 
          onClick={() => navigate('/finance-audit')} 
          className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-50 rounded-xl group-hover:bg-green-100 transition-colors">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <span className="flex items-center text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
              <ArrowUpRight className="h-3 w-3 mr-1" /> +8%
            </span>
          </div>
          <h3 className="text-gray-500 text-sm font-medium">Ingresos Mes</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">$0.00</p>
        </div>

        {/* RECUADRO ROJO - PENDIENTES */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-50 rounded-xl">
              <Activity className="h-6 w-6 text-red-600" />
            </div>
            <span className="flex items-center text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">
              <ArrowDownRight className="h-3 w-3 mr-1" /> -2%
            </span>
          </div>
          <h3 className="text-gray-500 text-sm font-medium">Por Cobrar</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">$0.00</p>
        </div>
      </div>

      {/* SECCIÓN INFERIOR - RECORDATORIOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Lista de Próximas Citas (Recordatorios) */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">Recordatorios de Hoy</h2>
            <button 
              onClick={() => navigate('/agenda')}
              className="text-sm text-blue-600 font-medium hover:text-blue-700 hover:bg-blue-50 px-3 py-1 rounded-full transition-colors"
            >
              Ver Agenda Completa
            </button>
          </div>

          <div className="space-y-4">
            {loading ? (
              <p className="text-gray-400 text-center py-4">Cargando citas...</p>
            ) : todayAppointmentsList.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p className="text-gray-500">No hay citas programadas para hoy</p>
              </div>
            ) : (
              todayAppointmentsList.map((appointment) => (
                <div 
                  key={appointment.id} 
                  className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl border border-gray-100 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`
                      h-12 w-12 rounded-full flex items-center justify-center
                      ${appointment.status === 'completed' ? 'bg-green-100 text-green-600' : 
                        appointment.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                        'bg-blue-100 text-blue-600'}
                    `}>
                      {appointment.status === 'completed' ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        {appointment.patients?.first_name} {appointment.patients?.last_name}
                      </h4>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {appointment.start_time.slice(0, 5)} - {appointment.end_time.slice(0, 5)}
                        </span>
                        <span className={`
                          px-2 py-0.5 rounded-full text-xs font-medium capitalize
                          ${appointment.status === 'completed' ? 'bg-green-100 text-green-700' : 
                            appointment.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'}
                        `}>
                          {appointment.status === 'confirmed' ? 'Pendiente' : 
                           appointment.status === 'completed' ? 'Completada' : appointment.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Botón de Acción Rápida */}
                  {appointment.status === 'confirmed' && (
                    <button 
                      onClick={() => navigate(`/agenda?focus=${appointment.id}`)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm hover:bg-gray-50"
                    >
                      Gestionar
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Panel Lateral (Estático por ahora) */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-lg p-6 text-white">
          <h3 className="font-bold text-lg mb-2">Estado del Sistema</h3>
          <p className="text-blue-100 text-sm mb-6">Todo funcionando correctamente.</p>
          
          <div className="space-y-4">
            <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm">
              <p className="text-xs text-blue-200 uppercase tracking-wider font-semibold mb-1">Versión</p>
              <p className="font-mono">v1.0.2 (Stable)</p>
            </div>
            <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm">
              <p className="text-xs text-blue-200 uppercase tracking-wider font-semibold mb-1">Base de Datos</p>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse" />
                <p>Conectado (Realtime)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Dashboard;