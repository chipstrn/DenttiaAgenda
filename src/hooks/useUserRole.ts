"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'admin' | 'doctor' | 'receptionist' | 'auditor' | null;

interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  must_change_password: boolean;
  is_active: boolean;
}

export const useUserRole = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setProfile(null);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, role, must_change_password, is_active')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching profile:', error);
          setProfile(null);
        } else {
          setProfile({
            id: data.id,
            email: user.email || '',
            first_name: data.first_name,
            last_name: data.last_name,
            role: data.role as UserRole,
            must_change_password: data.must_change_password ?? false,
            is_active: data.is_active ?? true
          });
        }
      } catch (error) {
        console.error('Error in useUserRole:', error);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchProfile();
    });

    return () => subscription.unsubscribe();
  }, []);

  const isAdmin = profile?.role === 'admin';
  const isReceptionist = profile?.role === 'receptionist';
  const isDoctor = profile?.role === 'doctor';
  const isAuditor = profile?.role === 'auditor';

  const hasPermission = (permission: string): boolean => {
    if (!profile) return false;
    if (isAdmin) return true; // Admin tiene todos los permisos
    
    // Permisos específicos por rol
    const rolePermissions: Record<string, string[]> = {
      receptionist: ['agenda', 'patients', 'appointments', 'cash_register'],
      doctor: ['agenda', 'patients', 'appointments', 'treatments', 'prescriptions', 'odontogram', 'budgets'],
      auditor: ['view_audit_logs', 'view_patients', 'view_payments', 'view_cash_registers']
    };

    return rolePermissions[profile.role || '']?.includes(permission) ?? false;
  };

  return {
    profile,
    loading,
    isAdmin,
    isReceptionist,
    isDoctor,
    isAuditor,
    hasPermission,
    mustChangePassword: profile?.must_change_password ?? false
  };
};