"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  is_active: boolean;
  must_change_password: boolean;
  last_login: string | null;
  clinic_id: string | null;
  is_super_admin: boolean;
  clinics?: {
    active: boolean;
  } | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isRecepcion: boolean;
  isDoctor: boolean;
  isSuperAdmin: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      // First, get profile without joining clinics (to avoid issues with super admin who has clinic_id = NULL)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role, is_active, must_change_password, last_login, clinic_id, is_super_admin')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      // If not super admin and has clinic_id, fetch clinic status
      if (!data.is_super_admin && data.clinic_id) {
        const { data: clinicData } = await supabase
          .from('clinics')
          .select('active')
          .eq('id', data.clinic_id)
          .single();

        return {
          ...data,
          clinics: clinicData || null
        } as UserProfile;
      }

      // Super admin or no clinic - return profile without clinic data
      return {
        ...data,
        clinics: null
      } as UserProfile;
    } catch (error) {
      console.error('Error in fetchProfile:', error);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  }, [user?.id, fetchProfile]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setProfile(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);

          const profileData = await fetchProfile(currentSession.user.id);
          if (isMounted) {
            setProfile(profileData);
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
          setInitialized(true);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, [fetchProfile]);

  // Listen for auth changes (only after initialization)
  useEffect(() => {
    if (!initialized) return;

    if (profile && !profile.is_super_admin && profile.clinics && profile.clinics.active === false) {
      // Clinic is suspended
      console.warn('Clinic is suspended. Logging out.');
      // Import toast dynamically or assuming it's available. 
      // We can't use 'toast' here if not imported.
      // But standard logout is fine.
      signOut();
      // Optionally redirect to a "Suspended" page?
      // Since we sign out, they go to login.
    }
  }, [profile, initialized, signOut]);

  useEffect(() => {
    if (!initialized) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('Auth state changed:', event);

        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setProfile(null);
        } else if (event === 'SIGNED_IN' && newSession?.user) {
          setSession(newSession);
          setUser(newSession.user);

          // Fetch profile in background
          const profileData = await fetchProfile(newSession.user.id);
          setProfile(profileData);
        } else if (event === 'TOKEN_REFRESHED' && newSession) {
          setSession(newSession);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [initialized, fetchProfile]);

  const isAdmin = useMemo(() => profile?.role === 'admin', [profile?.role]);
  const isRecepcion = useMemo(() => profile?.role === 'recepcion', [profile?.role]);
  const isDoctor = useMemo(() => profile?.role === 'doctor', [profile?.role]);
  const isSuperAdmin = useMemo(() => profile?.is_super_admin || false, [profile?.is_super_admin]);

  const value = useMemo(() => ({
    session,
    user,
    profile,
    loading,
    isAdmin,
    isRecepcion,
    isDoctor,
    isSuperAdmin,
    signOut,
    refreshProfile,
  }), [session, user, profile, loading, isAdmin, isRecepcion, isDoctor, isSuperAdmin, signOut, refreshProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};