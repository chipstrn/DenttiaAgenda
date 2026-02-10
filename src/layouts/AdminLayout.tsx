"use client";

import React, { useState } from 'react';
import AdminSidebar from '../components/admin/AdminSidebar';
import { Menu } from 'lucide-react';

interface AdminLayoutProps {
    children: React.ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <div className="min-h-screen bg-ios-gray-100">
            <AdminSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            <div className="pl-0 md:pl-72 flex flex-col min-h-screen transition-all duration-300">

                {/* Simple Header for Mobile */}
                <header className="h-16 px-4 flex items-center md:hidden sticky top-0 bg-white/80 backdrop-blur-md z-20 border-b border-ios-gray-200">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 -ml-2 text-ios-gray-600 hover:bg-black/5 rounded-lg transition-colors"
                    >
                        <Menu className="h-6 w-6" />
                    </button>
                    <span className="ml-3 font-semibold text-ios-gray-900">Super Admin</span>
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

export default AdminLayout;
