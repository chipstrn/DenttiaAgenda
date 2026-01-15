"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import {  User, Bell, Shield, ChevronRight, Save } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const Settings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    email: ''
  });
  const [notifications, setNotifications] = useState({
    emailReminders: true,
    appointmentAlerts: true,
    paymentNotifications: true
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') throw error;

        setProfile({
          first_name: data?.first_name || '',
          last_name: data?.last_name || '',
          email: user.email || ''
        });
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      toast.success('Perfil actualizado');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 border-3 border-ios-blue/30 border-t-ios-blue rounded-full animate-spin"></div>
        </div>
      </MainLayout>
    );
  }

  const SettingItem = ({ icon: Icon, title, subtitle, color, onClick, rightElement }: any) => (
    <button 
      onClick={onClick}
      className="flex items-center gap-4 w-full p-4 hover:bg-ios-gray-50 transition-all duration-200 ease-ios touch-feedback"
    >
      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", color)}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1 text-left">
        <p className="font-semibold text-ios-gray-900">{title}</p>
        {subtitle && <p className="text-sm text-ios-gray-500">{subtitle}</p>}
      </div>
      {rightElement || <ChevronRight className="h-5 w-5 text-ios-gray-300" />}
    </button>
  );

  return (
    <MainLayout>
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">Configuración</h1>
        <p className="text-ios-gray-500 mt-1 font-medium">Administra tu cuenta</p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Profile Section */}
        <div className="ios-card overflow-hidden animate-slide-up" style={{ animationDelay: '0ms' }}>
          <div className="p-5 border-b border-ios-gray-100 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-ios-blue flex items-center justify-center">
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-ios-gray-900">Perfil</h2>
              <p className="text-sm text-ios-gray-500">Información de tu cuenta</p>
            </div>
          </div>
          
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Nombre</Label>
                <input
                  value={profile.first_name}
                  onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                  className="ios-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ios-gray-600">Apellido</Label>
                <input
                  value={profile.last_name}
                  onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                  className="ios-input"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-ios-gray-600">Correo Electrónico</Label>
              <input
                type="email"
                value={profile.email}
                disabled
                className="ios-input bg-ios-gray-100 text-ios-gray-500"
              />
              <p className="text-xs text-ios-gray-400">El correo no puede ser modificado</p>
            </div>
            <button 
              onClick={handleSaveProfile} 
              disabled={saving}
              className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-ios-blue text-white font-semibold hover:bg-ios-blue/90 transition-colors touch-feedback disabled:opacity-50"
            >
              <Save className="h-5 w-5" />
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="ios-card overflow-hidden animate-slide-up" style={{ animationDelay: '50ms' }}>
          <div className="p-5 border-b border-ios-gray-100 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-ios-orange flex items-center justify-center">
              <Bell className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-ios-gray-900">Notificaciones</h2>
              <p className="text-sm text-ios-gray-500">Configura tus alertas</p>
            </div>
          </div>
          
          <div className="divide-y divide-ios-gray-100">
            <div className="flex items-center justify-between p-5">
              <div>
                <p className="font-semibold text-ios-gray-900">Recordatorios por Email</p>
                <p className="text-sm text-ios-gray-500">Recibe recordatorios de citas</p>
              </div>
              <Switch
                checked={notifications.emailReminders}
                onCheckedChange={(checked) => setNotifications({ ...notifications, emailReminders: checked })}
              />
            </div>
            <div className="flex items-center justify-between p-5">
              <div>
                <p className="font-semibold text-ios-gray-900">Alertas de Citas</p>
                <p className="text-sm text-ios-gray-500">Notificaciones de nuevas citas</p>
              </div>
              <Switch
                checked={notifications.appointmentAlerts}
                onCheckedChange={(checked) => setNotifications({ ...notifications, appointmentAlerts: checked })}
              />
            </div>
            <div className="flex items-center justify-between p-5">
              <div>
                <p className="font-semibold text-ios-gray-900">Notificaciones de Pagos</p>
                <p className="text-sm text-ios-gray-500">Alertas de pagos registrados</p>
              </div>
              <Switch
                checked={notifications.paymentNotifications}
                onCheckedChange={(checked) => setNotifications({ ...notifications, paymentNotifications: checked })}
              />
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="ios-card overflow-hidden animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="p-5 border-b border-ios-gray-100 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-ios-green flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-ios-gray-900">Seguridad</h2>
              <p className="text-sm text-ios-gray-500">Opciones de seguridad</p>
            </div>
          </div>
          
          <div className="divide-y divide-ios-gray-100">
            <SettingItem 
              icon={Shield}
              title="Cambiar Contraseña"
              color="bg-ios-gray-400"
            />
            <button className="flex items-center gap-4 w-full p-4 hover:bg-ios-red/5 transition-all duration-200 ease-ios touch-feedback">
              <div className="h-10 w-10 rounded-xl bg-ios-red/15 flex items-center justify-center">
                <Shield className="h-5 w-5 text-ios-red" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-ios-red">Cerrar Todas las Sesiones</p>
              </div>
              <ChevronRight className="h-5 w-5 text-ios-gray-300" />
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Settings;