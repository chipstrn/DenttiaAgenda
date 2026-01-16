import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Bell, Search, Plus, Menu, User, LogOut, 
  Settings, ChevronDown 
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const { user, signOut, isAdmin, isDoctor, isReceptionist } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Obtener iniciales para el avatar
  const getInitials = () => {
    if (!user?.email) return 'U';
    // Si tienes first_name en metadata, úsalo, si no, usa el email
    return user.email.substring(0, 2).toUpperCase();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleQuickAction = () => {
    navigate('/agenda?new=true'); // Redirige a Agenda con parámetro de nueva cita
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar para Desktop */}
      <div className="hidden md:block w-64 fixed inset-y-0 z-50">
        <Sidebar />
      </div>

      {/* Contenido Principal */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        
        {/* HEADER (Barra Superior) */}
        <header className="bg-white border-b border-gray-200 h-16 px-4 flex items-center justify-between sticky top-0 z-40 shadow-sm">
          
          {/* Lado Izquierdo: Menú Móvil y Búsqueda */}
          <div className="flex items-center gap-4 flex-1">
            {/* Botón Menú hamburguesa (Solo Móvil) */}
            <div className="md:hidden">
              <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
                <SheetTrigger asChild>
                  <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">
                    <Menu className="h-6 w-6" />
                  </button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-64">
                  <Sidebar onClose={() => setIsSidebarOpen(false)} />
                </SheetContent>
              </Sheet>
            </div>

            {/* Barra de Búsqueda Global */}
            <div className="relative hidden sm:block w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input 
                type="text"
                placeholder="Buscar paciente, cita o tratamiento..." 
                className="w-full pl-10 pr-4 py-2 bg-gray-100 border-transparent rounded-xl text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
              />
            </div>
          </div>

          {/* Lado Derecho: Acciones y Perfil */}
          <div className="flex items-center gap-3">
            
            {/* Botón de Acción Rápida (+) */}
            <button 
              onClick={handleQuickAction}
              className="hidden sm:flex items-center justify-center h-10 w-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-md hover:shadow-lg transition-all active:scale-95"
              title="Nueva Cita Rápida"
            >
              <Plus className="h-6 w-6" />
            </button>

            {/* Notificaciones */}
            <button className="relative p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full border border-white"></span>
            </button>
            
            <div className="h-8 w-px bg-gray-200 mx-1 hidden sm:block"></div>

            {/* Menú de Usuario (Perfil) */}
            <DropdownMenu>
              <DropdownMenuTrigger className="outline-none">
                <div className="flex items-center gap-3 hover:bg-gray-50 p-1.5 rounded-full pl-2 pr-1 transition-colors cursor-pointer border border-transparent hover:border-gray-200">
                  <div className="text-right hidden md:block">
                    <p className="text-sm font-semibold text-gray-900 leading-none">
                      {isAdmin ? 'Administrador' : isDoctor ? 'Dr(a). Dentista' : 'Recepción'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{user?.email}</p>
                  </div>
                  
                  {/* Avatar con Iniciales */}
                  <div className="h-9 w-9 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold border border-blue-200">
                    {getInitials()}
                  </div>
                  
                  <ChevronDown className="h-4 w-4 text-gray-400 hidden sm:block" />
                </div>
              </DropdownMenuTrigger>
              
              <DropdownMenuContent align="end" className="w-56 p-2">
                <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" /> Perfil
                </DropdownMenuItem>
                
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" /> Configuración
                  </DropdownMenuItem>
                )}
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={handleSignOut} className="text-red-600 cursor-pointer focus:text-red-600 focus:bg-red-50">
                  <LogOut className="mr-2 h-4 w-4" /> Cerrar Sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Área de Contenido Hija */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto w-full animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;