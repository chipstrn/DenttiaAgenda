"use client";

import React, { useMemo, useCallback } from 'react';
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
  UserCog,
  Calculator,
  Shield,
  Box,
  TrendingUp,
  BarChart3,
  DollarSign
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut, isAdmin, isRecepcion } = useAuth();

  const userName = useMemo(() => {
    if (!profile) return 'Usuario';
    return `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Usuario';
  }, [profile]);

  const userRole = profile?.role || 'doctor';

  // Menú principal - visible para todos
  const mainMenuItems = useMemo(() => [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/', color: 'bg-ios-blue' },
    { icon: Calendar, label: 'Agenda', path: '/agenda', color: 'bg-ios-orange' },
    { icon: Users, label: 'Pacientes', path: '/patients', color: 'bg-ios-green' },
  ], []);

  // Menú clínico - visible para doctores y admin
  const clinicalMenuItems = useMemo(() => [
    { icon: Activity, label: 'Tratamientos', path: '/treatments', color: 'bg-ios-purple' },
    { icon: Stethoscope, label: 'Doctores', path: '/doctors', color: 'bg-ios-indigo' },
    { icon: FileText, label: 'Recetas', path: '/prescriptions', color: 'bg-ios-pink' },
  ], []);

  // Menú de recepción
  const receptionMenuItems = useMemo(() => [
    { icon: DollarSign, label: 'Caja y Cobros', path: '/reception-finance', color: 'bg-ios-green' },
    { icon: Calculator, label: 'Corte de Caja', path: '/cash-register', color: 'bg-ios-teal' },
  ], []);

  // Menú de administración - solo admin
  const adminMenuItems = useMemo(() => [
    { icon: TrendingUp, label: 'Finanzas', path: '/finance', color: 'bg-ios-green' },
    { icon: Shield, label: 'Auditoría', path: '/finance-audit', color: 'bg-ios-red' },
    { icon: DollarSign, label: 'Comisiones', path: '/finance/commissions', color: 'bg-ios-teal' },
    { icon: BarChart3, label: 'Reportes', path: '/reports', color: 'bg-ios-purple' },
    { icon: UserCog, label: 'Personal', path: '/staff', color: 'bg-ios-indigo' },
    { icon: Settings, label: 'Configuración', path: '/settings', color: 'bg-ios-gray-500' },
  ], []);

  // Menú de inventario - visible para todos (o restringir según lógica de negocio, plan dice todos con acceso a recepción/admin)
  const inventoryMenuItems = useMemo(() => [
    { icon: Box, label: 'Inventario', path: '/inventory', color: 'bg-ios-orange' },
  ], []);

  const handleLogout = useCallback(async () => {
    try {
      await signOut();
      toast.success('Sesión cerrada');
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Error al cerrar sesión');
    }
  }, [signOut, navigate]);

  const MenuItem = useCallback(({ item }: { item: { icon: React.ElementType; label: string; path: string; color: string } }) => {
    const isActive = location.pathname === item.path;
    const Icon = item.icon;

    return (
      <Link
        to={item.path}
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
            <Icon className="h-4 w-4 text-white" />
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
  }, [location.pathname]);

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

      {/* User Info */}
      <div className="px-3 pb-4">
        <div className="p-3 rounded-xl bg-white/60">
          <p className="text-sm font-medium text-ios-gray-900 truncate">{userName}</p>
          <p className={cn(
            "text-xs font-medium mt-0.5",
            isAdmin ? 'text-ios-red' : isRecepcion ? 'text-ios-blue' : 'text-ios-green'
          )}>
            {isAdmin ? 'Administrador' : isRecepcion ? 'Recepción' : 'Doctor'}
          </p>
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

        {/* Clinical - Solo para doctores y admin */}
        {(userRole === 'doctor' || isAdmin) && (
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
        )}

        {/* Reception - Solo para recepción */}
        {(isRecepcion || isAdmin) && (
          <div className="mb-6">
            <p className="px-3 mb-2 text-xs font-semibold text-ios-gray-400 uppercase tracking-wider">
              Caja
            </p>
            <div className="space-y-1">
              {receptionMenuItems.map((item) => (
                <MenuItem key={item.path} item={item} />
              ))}
            </div>
          </div>
        )}

        {/* Inventory Section */}
        <div className="mb-6">
          <p className="px-3 mb-2 text-xs font-semibold text-ios-gray-400 uppercase tracking-wider">
            Inventario
          </p>
          <div className="space-y-1">
            {inventoryMenuItems.map((item) => (
              <MenuItem key={item.path} item={item} />
            ))}
          </div>
        </div>

        {/* Admin Section */}
        {isAdmin && (
          <div className="mb-6">
            <p className="px-3 mb-2 text-xs font-semibold text-ios-gray-400 uppercase tracking-wider">
              Administración
            </p>
            <div className="space-y-1">
              {adminMenuItems.map((item) => (
                <MenuItem key={item.path} item={item} />
              ))}
            </div>
          </div>
        )}

        {/* Settings for non-admin */}
        {!isAdmin && (
          <div className="mb-6">
            <div className="space-y-1">
              <MenuItem item={{ icon: Settings, label: 'Configuración', path: '/settings', color: 'bg-ios-gray-500' }} />
            </div>
          </div>
        )}
      </nav>

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