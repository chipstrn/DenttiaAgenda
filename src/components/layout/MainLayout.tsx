"use client";

import React, { useEffect, useState, useMemo } from 'react';
import Sidebar from './Sidebar';
import { Bell, Plus, Menu } from 'lucide-react';
import GlobalSearch from './GlobalSearch';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const displayName = useMemo(() => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    return user?.email?.split('@')[0] || 'Usuario';
  }, [profile, user]);

  const initials = useMemo(() => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    return displayName.substring(0, 2).toUpperCase();
  }, [profile, displayName]);

  const roleLabel = useMemo(() => {
    switch (profile?.role) {
      case 'admin': return 'Administrador';
      case 'recepcion': return 'Recepción';
      default: return 'Doctor';
    }
  }, [profile?.role]);

  return (
    <div className="min-h-screen bg-ios-gray-100">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="pl-0 md:pl-72 flex flex-col min-h-screen transition-all duration-300">
        {/* Glass Header */}
        <header className={cn(
          "h-16 px-4 md:px-8 flex items-center justify-between sticky top-0 z-20 transition-all duration-300 ease-ios",
          scrolled
            ? "glass border-b border-white/20 shadow-glass"
            : "bg-transparent"
        )}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 text-ios-gray-600 hover:bg-black/5 rounded-lg transition-colors"
              aria-label="Abrir menú"
            >
              <Menu className="h-6 w-6" />
            </button>
            {/* Search */}
            <GlobalSearch />
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Quick Add Button */}
            <button
              onClick={() => navigate('/agenda')}
              className="h-10 w-10 rounded-xl bg-ios-blue flex items-center justify-center shadow-ios-sm hover:bg-ios-blue/90 transition-all duration-200 touch-feedback"
            >
              <Plus className="h-5 w-5 text-white" />
            </button>

            {/* Notifications */}
            <button className="h-10 w-10 rounded-xl bg-white/80 flex items-center justify-center shadow-ios-sm hover:bg-white transition-all duration-200 touch-feedback relative">
              <Bell className="h-5 w-5 text-ios-gray-600" />
              <span className="absolute top-2 right-2 h-2 w-2 bg-ios-red rounded-full ring-2 ring-white"></span>
            </button>

            {/* Profile */}
            <div className="flex items-center gap-3 pl-3 ml-1 border-l border-ios-gray-200/50">
              <div className="text-right hidden md:block">
                <p className="text-sm font-semibold text-ios-gray-900">{displayName}</p>
                <p className="text-xs text-ios-gray-500 font-medium">{roleLabel}</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-10 w-10 rounded-xl bg-gradient-to-br from-ios-blue to-ios-indigo flex items-center justify-center text-white font-semibold text-sm shadow-ios-sm hover:shadow-ios transition-all duration-200 touch-feedback">
                    {initials}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 rounded-xl">
                  <DropdownMenuLabel className="text-sm">{displayName}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/settings')}>Configuración</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="text-ios-red">Cerrar sesión</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;