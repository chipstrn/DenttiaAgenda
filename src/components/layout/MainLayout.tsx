"use client";

import React, { useEffect, useState, useCallback } from 'react';
import Sidebar from './Sidebar';
import { Bell, Search, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: React.ReactNode;
}

interface UserData {
  displayName: string;
  initials: string;
  role: string;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const [userData, setUserData] = useState<UserData>({
    displayName: 'Usuario',
    initials: 'US',
    role: 'Doctor'
  });
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !isMounted) return;
        
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('first_name, last_name, role')
          .eq('id', user.id)
          .single();
        
        if (error) {
          console.error('Error fetching profile:', error);
          return;
        }

        if (isMounted && profileData) {
          const displayName = profileData.first_name && profileData.last_name 
            ? `${profileData.first_name} ${profileData.last_name}`
            : user.email?.split('@')[0] || 'Usuario';

          const initials = profileData.first_name && profileData.last_name
            ? `${profileData.first_name[0]}${profileData.last_name[0]}`.toUpperCase()
            : displayName.substring(0, 2).toUpperCase();

          setUserData({
            displayName,
            initials,
            role: profileData.role || 'Doctor'
          });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-ios-gray-100">
      <Sidebar />
      
      <div className="pl-72 flex flex-col min-h-screen">
        {/* Glass Header */}
        <header className={cn(
          "h-16 px-8 flex items-center justify-between sticky top-0 z-20 transition-all duration-300 ease-ios",
          scrolled 
            ? "glass border-b border-white/20 shadow-glass" 
            : "bg-transparent"
        )}>
          {/* Search */}
          <div className="w-80">
            <div className="relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ios-gray-400 transition-colors group-focus-within:text-ios-blue" />
              <Input 
                placeholder="Buscar..." 
                className="pl-10 h-10 bg-white/80 border-0 rounded-xl text-sm placeholder:text-ios-gray-400 focus-visible:ring-2 focus-visible:ring-ios-blue/30 focus-visible:bg-white transition-all duration-200 shadow-ios-sm"
              />
            </div>
          </div>
          
          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Quick Add Button */}
            <button className="h-10 w-10 rounded-xl bg-ios-blue flex items-center justify-center shadow-ios-sm hover:bg-ios-blue/90 transition-all duration-200 touch-feedback">
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
                <p className="text-sm font-semibold text-ios-gray-900">{userData.displayName}</p>
                <p className="text-xs text-ios-gray-500 font-medium">{userData.role}</p>
              </div>
              <button className="h-10 w-10 rounded-xl bg-gradient-to-br from-ios-blue to-ios-indigo flex items-center justify-center text-white font-semibold text-sm shadow-ios-sm hover:shadow-ios transition-all duration-200 touch-feedback">
                {userData.initials}
              </button>
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