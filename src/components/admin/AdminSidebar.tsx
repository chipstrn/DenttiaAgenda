"use client";

import React, { useMemo, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Building,
    Settings,
    LogOut,
    ChevronRight,
    ShieldAlert
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface SidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

const AdminSidebar = ({ isOpen, onClose }: SidebarProps) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { signOut } = useAuth();

    const menuItems = useMemo(() => [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/admin', color: 'bg-ios-blue' },
        { icon: Building, label: 'Clínicas', path: '/admin/clinics', color: 'bg-ios-orange' },
        { icon: Settings, label: 'Configuración', path: '/admin/settings', color: 'bg-ios-gray-500' },
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
                onClick={onClose}
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
    }, [location.pathname, onClose]);

    return (
        <>
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden animate-fade-in"
                    onClick={onClose}
                />
            )}

            <aside className={cn(
                "h-screen w-72 bg-ios-gray-50 flex flex-col border-r border-ios-gray-200/50",
                "fixed left-0 top-0 z-50 transition-transform duration-300 ease-ios",
                "md:translate-x-0",
                !isOpen && "-translate-x-full md:translate-x-0"
            )}>
                <div className="p-6 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center shadow-ios-sm">
                            <ShieldAlert className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold text-ios-gray-900 tracking-tight">
                                Super Admin
                            </h1>
                            <p className="text-xs text-ios-gray-500 font-medium">Gestión SaaS</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 px-3 py-2 overflow-y-auto">
                    <div className="space-y-1">
                        {menuItems.map((item) => (
                            <MenuItem key={item.path} item={item} />
                        ))}
                    </div>
                </nav>

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
            </aside>
        </>
    );
};

export default AdminSidebar;
