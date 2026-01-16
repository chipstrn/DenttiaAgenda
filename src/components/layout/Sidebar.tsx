"use client";

import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  CreditCard, 
  Activity, 
  Settings, 
  LogOut,
  ChevronRight,
  Stethoscope,
  FileText,
  Calculator,
  ClipboardCheck,
  Shield,
  UserCog,
  ScrollText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    const fetchUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        setUserRole(data?.role || '');
      }
    };
    fetchUserRole();
  }, []);

  const mainMenuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/', color: 'bg-ios-blue' },
    { icon: Calendar, label: 'Agenda', path: '/agenda', color: 'bg-ios-orange' },
    { icon: Users, label: 'Pacientes', path: '/patients', color: 'bg-ios-green' },
  ];

  const clinicalMenuItems = [
    { icon: Activity, label: 'Tratamientos', path: '/treatments', color: 'bg-ios-purple' },
    { icon: Stethoscope, label: 'Doctores', path: '/doctors', color: 'bg-ios-indigo' },
    { icon: FileText, label: 'Recetas', path: '/prescriptions', color: 'bg-ios-pink' },
  ];

  const financeMenuItems = [
    { icon: CreditCard, label: 'Finanzas', path: '/finance', color: 'bg-ios-teal' },
    { icon: Calculator, label: 'Corte de Caja', path: '/cash-register', color: 'bg-ios-blue' },
    { icon: ClipboardCheck, label: 'Auditoría Caja', path: '/cash-audit', color: 'bg-ios-orange' },
  ];

  const adminMenuItems = [
    { icon: UserCog, label: 'Usuarios', path: '/users', color: 'bg-ios-purple', adminOnly: true },
    { icon: ScrollText, label: 'Logs Auditoría', path: '/audit-logs', color: 'bg-ios-red', adminOnly: true },
    { icon: Settings, label: 'Configuración', path: '/settings', color: 'bg-ios-gray-500' },
  ];

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success('Sesión cerrada');
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Error al cerrar sesión');
    }
  };

  const MenuItem = ({ item }: { item: any }) => {
    // Hide admin-only items for non-admins
    if (item.adminOnly && userRole !== 'admin') {
      return null;
    }

    const isActive = location.pathname === item.path;
    return (
      <Link 
        to={item.path} 
        key={item.path}
        className="block"
      >
        <div
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ease-ios group touch-feedback",
            isActive 
              ? "bg-white shadow-ios-sm" 
              : "hover:bg-white/60"
          )}
        >
          <div className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center transition-transform duration-200",
            item.color,
            isActive ? "scale-100" : "scale-95 group-hover:scale-100"
          )}>
            <item.icon className="h-4 w-4 text-white" />
          </div>
          <span className={cn(
            "flex-1 text-sm font-medium transition-colors duration-200",
            isActive ? "text-ios-gray-900" : "text-ios-gray-600 group-hover:text-ios-gray-900"
          )}>
            {item.label}
          </span>
          {isActive && (
            <ChevronRight className="h-4 w-4 text-ios-gray-400" />
          )}
        </div>
      </Link>
    );
  };

  return (
    <div className="h-screen w-72 bg-ios-gray-50 flex flex-col fixed left-0 top-0 border-r border-ios-gray-200/50">
      {/* Logo */}
      <div className="p-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-ios-blue to-ios-indigo flex items-center justify-center shadow-ios-sm">
            <Activity className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-ios-gray-900 tracking-tight">
              Denttia
            </h1>
            <p className="text-xs text-ios-gray-500 font-medium">ERP Dental</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto">
        {/* Main */}
        <div className="mb-6">
          <p className="px-3 mb-2 text-xs font-semibold text-ios-gray-400 uppercase tracking-wider">
            Principal
          </p>
          <div className="space-y-1">
            {mainMenuItems.map((item) => (
              <MenuItem key={item.path} item={item} />
            ))}
          </div>
        </div>

        {/* Clinical */}
        <div className="mb-6">
          <p className="px-3 mb-2 text-xs font-semibold text-ios-gray-400 uppercase tracking-wider">
            Clínico
          </p>
          <div className="space-y-1">
            {clinicalMenuItems.map((item) => (
              <MenuItem key={item.path} item={item} />
            ))}
          </div>
        </div>

        {/* Finance */}
        <div className="mb-6">
          <p className="px-3 mb-2 text-xs font-semibold text-ios-gray-400 uppercase tracking-wider">
            Finanzas
          </p>
          <div className="space-y-1">
            {financeMenuItems.map((item) => (
              <MenuItem key={item.path} item={item} />
            ))}
          </div>
        </div>

        {/* Admin */}
        <div className="mb-6">
          <p className="px-3 mb-2 text-xs font-semibold text-ios-gray-400 uppercase tracking-wider flex items-center gap-2">
            {userRole === 'admin' && <Shield className="h-3 w-3" />}
            Administración
          </p>
          <div className="space-y-1">
            {adminMenuItems.map((item) => (
              <MenuItem key={item.path} item={item} />
            ))}
          </div>
        </div>
      </nav>

      {/* User Role Badge */}
      {userRole && (
        <div className="px-6 py-2">
          <div className={cn(
            "px-3 py-2 rounded-xl text-center text-xs font-semibold",
            userRole === 'admin' ? 'bg-ios-red/15 text-ios-red' :
            userRole === 'doctor' ? 'bg-ios-blue/15 text-ios-blue' :
            userRole === 'receptionist' ? 'bg-ios-green/15 text-ios-green' :
            'bg-ios-purple/15 text-ios-purple'
          )}>
            {userRole === 'admin' ? '👑 Administrador' :
             userRole === 'doctor' ? '🩺 Doctor' :
             userRole === 'receptionist' ? '📋 Recepcionista' :
             '🦷 Asistente'}
          </div>
        </div>
      )}

      {/* Logout */}
      <div className="p-3 border-t border-ios-gray-200/50">
        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all duration-200 ease-ios hover:bg-ios-red/10 touch-feedback group"
        >
          <div className="h-8 w-8 rounded-lg bg-ios-red/15 flex items-center justify-center group-hover:bg-ios-red/20 transition-colors">
            <LogOut className="h-4 w-4 text-ios-red" />
          </div>
          <span className="text-sm font-medium text-ios-red">
            Cerrar Sesión
          </span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;