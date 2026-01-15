"use client";

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  CreditCard, 
  Activity, 
  Settings, 
  LogOut 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const Sidebar = () => {
  const location = useLocation();

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Calendar, label: 'Agenda', path: '/agenda' },
    { icon: Users, label: 'Pacientes', path: '/patients' },
    { icon: Activity, label: 'Tratamientos', path: '/treatments' },
    { icon: CreditCard, label: 'Finanzas / POS', path: '/finance' },
    { icon: Settings, label: 'Configuración', path: '/settings' },
  ];

  return (
    <div className="h-screen w-64 bg-slate-900 text-white flex flex-col shadow-xl fixed left-0 top-0">
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Activity className="h-8 w-8 text-blue-400" />
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">
            Dental ERP
          </h1>
        </div>
        <p className="text-xs text-slate-400 mt-1">Gestión Clínica Inteligente</p>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => (
          <Link to={item.path} key={item.path}>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start gap-3 mb-1 font-medium transition-all duration-200",
                location.pathname === item.path 
                  ? "bg-slate-800 text-blue-400 shadow-sm border-l-4 border-blue-400 rounded-l-none" 
                  : "text-slate-300 hover:text-white hover:bg-slate-800/50"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Button>
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <Button variant="ghost" className="w-full justify-start gap-3 text-red-400 hover:text-red-300 hover:bg-red-950/20">
          <LogOut className="h-5 w-5" />
          Cerrar Sesión
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;