"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    Calendar, CheckCircle, Clock, DollarSign, Filter,
    Search, Settings, User, Loader2, Save, Percent
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface Commission {
    id: string;
    appointment_id: string;
    doctor_id: string;
    amount: number;
    status: 'pending' | 'paid';
    created_at: string;
    doctors: {
        full_name: string;
    };
    appointments: {
        start_time: string;
        treatment_type: string;
        title: string;
        patients: {
            first_name: string;
            last_name: string;
        };
    };
}

interface Doctor {
    id: string;
    full_name: string;
    color: string;
}

interface CommissionSetting {
    id?: string;
    doctor_id: string;
    percentage: number;
    doctor?: Doctor;
}

const DoctorCommissions = () => {
    const [activeTab, setActiveTab] = useState<'commissions' | 'settings'>('commissions');

    // Commission list state
    const [commissions, setCommissions] = useState<Commission[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
    const [selectedStatus, setSelectedStatus] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Settings state
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [commissionSettings, setCommissionSettings] = useState<CommissionSetting[]>([]);
    const [savingSettings, setSavingSettings] = useState(false);
    const [loadingSettings, setLoadingSettings] = useState(false);

    const months = useMemo(() => {
        const options = [];
        for (let i = 0; i < 12; i++) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            options.push({
                value: format(date, 'yyyy-MM'),
                label: format(date, 'MMMM yyyy', { locale: es })
            });
        }
        return options;
    }, []);

    const fetchCommissions = useCallback(async () => {
        try {
            setLoading(true);
            const start = startOfMonth(parseISO(`${selectedMonth}-01`)).toISOString();
            const end = endOfMonth(parseISO(`${selectedMonth}-01`)).toISOString();

            const { data, error } = await supabase
                .from('doctor_commissions')
                .select(`
                    *,
                    doctors (full_name),
                    appointments (
                        start_time,
                        title,
                        patients (first_name, last_name)
                    )
                `)
                .gte('created_at', start)
                .lte('created_at', end)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setCommissions(data || []);
        } catch (error) {
            console.error('Error fetching commissions:', error);
            toast.error('Error al cargar comisiones');
        } finally {
            setLoading(false);
        }
    }, [selectedMonth]);

    const fetchSettings = useCallback(async () => {
        try {
            setLoadingSettings(true);

            // Fetch doctors
            const { data: doctorsData, error: doctorsError } = await supabase
                .from('doctors')
                .select('id, full_name, color')
                .eq('is_active', true)
                .order('full_name');

            if (doctorsError) throw doctorsError;
            setDoctors(doctorsData || []);

            // Fetch commission settings
            const { data: settingsData, error: settingsError } = await supabase
                .from('commission_settings')
                .select('*');

            if (settingsError) throw settingsError;

            // Map settings to doctors
            const settingsMap = new Map(settingsData?.map(s => [s.doctor_id, s]) || []);
            const combinedSettings = (doctorsData || []).map(doctor => ({
                doctor_id: doctor.id,
                percentage: settingsMap.get(doctor.id)?.percentage || 0,
                id: settingsMap.get(doctor.id)?.id,
                doctor
            }));

            setCommissionSettings(combinedSettings);
        } catch (error) {
            console.error('Error fetching settings:', error);
            toast.error('Error al cargar configuración');
        } finally {
            setLoadingSettings(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'commissions') {
            fetchCommissions();
        } else {
            fetchSettings();
        }
    }, [activeTab, fetchCommissions, fetchSettings]);

    const handleMarkAsPaid = async (id: string, currentStatus: string) => {
        if (currentStatus === 'paid') return;

        try {
            const { error } = await supabase
                .from('doctor_commissions')
                .update({ status: 'paid' })
                .eq('id', id);

            if (error) throw error;

            setCommissions(prev => prev.map(c =>
                c.id === id ? { ...c, status: 'paid' } : c
            ));
            toast.success('Comisión marcada como pagada');
        } catch (error) {
            toast.error('Error al actualizar');
        }
    };

    const handlePercentageChange = (doctorId: string, percentage: number) => {
        setCommissionSettings(prev => prev.map(s =>
            s.doctor_id === doctorId ? { ...s, percentage: Math.min(100, Math.max(0, percentage)) } : s
        ));
    };

    const handleSaveSettings = async () => {
        setSavingSettings(true);
        try {
            for (const setting of commissionSettings) {
                if (setting.id) {
                    // Update existing
                    const { error } = await supabase
                        .from('commission_settings')
                        .update({
                            percentage: setting.percentage,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', setting.id);

                    if (error) throw error;
                } else if (setting.percentage > 0) {
                    // Insert new
                    const { error } = await supabase
                        .from('commission_settings')
                        .insert({
                            doctor_id: setting.doctor_id,
                            percentage: setting.percentage
                        });

                    if (error) throw error;
                }
            }

            toast.success('Configuración de comisiones guardada');
            fetchSettings(); // Refresh to get IDs
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error('Error al guardar configuración');
        } finally {
            setSavingSettings(false);
        }
    };

    const filteredCommissions = useMemo(() => {
        return commissions.filter(comm => {
            const matchesStatus = selectedStatus === 'all' || comm.status === selectedStatus;
            const matchesSearch = searchTerm === '' ||
                comm.doctors?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                comm.appointments?.patients?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                comm.appointments?.patients?.last_name?.toLowerCase().includes(searchTerm.toLowerCase());

            return matchesStatus && matchesSearch;
        });
    }, [commissions, selectedStatus, searchTerm]);

    const stats = useMemo(() => {
        return {
            total: filteredCommissions.reduce((acc, curr) => acc + Number(curr.amount), 0),
            pending: filteredCommissions.filter(c => c.status === 'pending').reduce((acc, curr) => acc + Number(curr.amount), 0),
            paid: filteredCommissions.filter(c => c.status === 'paid').reduce((acc, curr) => acc + Number(curr.amount), 0),
            count: filteredCommissions.length
        };
    }, [filteredCommissions]);

    return (
        <MainLayout>
            <div className="flex flex-col gap-6 animate-fade-in">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight flex items-center gap-3">
                            <DollarSign className="h-8 w-8 text-ios-green" />
                            Comisiones Médicas
                        </h1>
                        <p className="text-ios-gray-500 mt-1 font-medium">
                            Gestiona los pagos y porcentajes de comisión de los doctores
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 p-1 bg-ios-gray-100 rounded-xl w-fit">
                    <button
                        onClick={() => setActiveTab('commissions')}
                        className={cn(
                            "px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                            activeTab === 'commissions'
                                ? "bg-white text-ios-gray-900 shadow-sm"
                                : "text-ios-gray-500 hover:text-ios-gray-700"
                        )}
                    >
                        <DollarSign className="h-4 w-4 inline mr-2" />
                        Comisiones
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={cn(
                            "px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                            activeTab === 'settings'
                                ? "bg-white text-ios-gray-900 shadow-sm"
                                : "text-ios-gray-500 hover:text-ios-gray-700"
                        )}
                    >
                        <Settings className="h-4 w-4 inline mr-2" />
                        Configuración
                    </button>
                </div>

                {activeTab === 'commissions' ? (
                    <>
                        {/* Month Selector */}
                        <div className="flex items-center gap-3 bg-white p-1 rounded-xl shadow-ios-sm border border-ios-gray-100 w-fit">
                            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                <SelectTrigger className="w-[180px] border-0 h-10 font-medium">
                                    <Calendar className="h-4 w-4 mr-2 text-ios-gray-500" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {months.map(m => (
                                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="ios-card p-5 bg-gradient-to-br from-ios-green/10 to-emerald-500/5 border-emerald-100/50">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-lg bg-emerald-500/10">
                                        <DollarSign className="h-5 w-5 text-emerald-600" />
                                    </div>
                                    <span className="text-sm font-semibold text-emerald-700/80">Total Generado</span>
                                </div>
                                <p className="text-2xl font-bold text-emerald-900">${stats.total.toLocaleString()}</p>
                            </div>

                            <div className="ios-card p-5 bg-gradient-to-br from-ios-blue/10 to-blue-500/5 border-blue-100/50">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-lg bg-blue-500/10">
                                        <Clock className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <span className="text-sm font-semibold text-blue-700/80">Pendiente de Pago</span>
                                </div>
                                <p className="text-2xl font-bold text-blue-900">${stats.pending.toLocaleString()}</p>
                            </div>

                            <div className="ios-card p-5 bg-gradient-to-br from-ios-gray-100 to-gray-200/50 border-gray-200/50">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-lg bg-gray-500/10">
                                        <CheckCircle className="h-5 w-5 text-gray-600" />
                                    </div>
                                    <span className="text-sm font-semibold text-gray-700/80">Pagado</span>
                                </div>
                                <p className="text-2xl font-bold text-gray-900">${stats.paid.toLocaleString()}</p>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ios-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar por doctor o paciente..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="ios-input pl-10 h-11"
                                />
                            </div>
                            <div className="w-full md:w-[200px]">
                                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                                    <SelectTrigger className="ios-input h-11">
                                        <Filter className="h-4 w-4 mr-2 text-ios-gray-500" />
                                        <SelectValue placeholder="Estado" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos</SelectItem>
                                        <SelectItem value="pending">Pendiente</SelectItem>
                                        <SelectItem value="paid">Pagado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Commissions List */}
                        <div className="ios-card overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-ios-gray-100 bg-ios-gray-50/50">
                                            <th className="p-4 text-xs font-semibold text-ios-gray-500 uppercase tracking-wider">Fecha</th>
                                            <th className="p-4 text-xs font-semibold text-ios-gray-500 uppercase tracking-wider">Doctor</th>
                                            <th className="p-4 text-xs font-semibold text-ios-gray-500 uppercase tracking-wider">Paciente / Tratamiento</th>
                                            <th className="p-4 text-xs font-semibold text-ios-gray-500 uppercase tracking-wider text-right">Monto</th>
                                            <th className="p-4 text-xs font-semibold text-ios-gray-500 uppercase tracking-wider text-center">Estado</th>
                                            <th className="p-4 text-xs font-semibold text-ios-gray-500 uppercase tracking-wider text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-ios-gray-100">
                                        {loading ? (
                                            Array.from({ length: 5 }).map((_, i) => (
                                                <tr key={i} className="animate-pulse">
                                                    <td className="p-4"><div className="h-4 w-24 bg-ios-gray-100 rounded"></div></td>
                                                    <td className="p-4"><div className="h-4 w-32 bg-ios-gray-100 rounded"></div></td>
                                                    <td className="p-4"><div className="h-4 w-48 bg-ios-gray-100 rounded"></div></td>
                                                    <td className="p-4"><div className="h-4 w-16 bg-ios-gray-100 rounded ml-auto"></div></td>
                                                    <td className="p-4"><div className="h-6 w-20 bg-ios-gray-100 rounded-full mx-auto"></div></td>
                                                    <td className="p-4"><div className="h-8 w-8 bg-ios-gray-100 rounded ml-auto"></div></td>
                                                </tr>
                                            ))
                                        ) : filteredCommissions.length > 0 ? (
                                            filteredCommissions.map((comm) => (
                                                <tr key={comm.id} className="hover:bg-ios-gray-50/50 transition-colors">
                                                    <td className="p-4 text-sm text-ios-gray-600">
                                                        {format(new Date(comm.created_at), 'dd MMM, HH:mm', { locale: es })}
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-8 w-8 rounded-full bg-ios-indigo/10 flex items-center justify-center text-ios-indigo text-xs font-bold">
                                                                {comm.doctors?.full_name?.substring(0, 2).toUpperCase() || '??'}
                                                            </div>
                                                            <span className="font-medium text-ios-gray-900">{comm.doctors?.full_name || 'N/A'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-ios-gray-900">
                                                                {comm.appointments?.patients?.first_name} {comm.appointments?.patients?.last_name}
                                                            </span>
                                                            <span className="text-xs text-ios-gray-500">{comm.appointments?.title || 'Sin tratamiento'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-right font-bold text-ios-gray-900">
                                                        ${Number(comm.amount).toLocaleString()}
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className={cn(
                                                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                                                            comm.status === 'paid'
                                                                ? "bg-ios-green/15 text-ios-green"
                                                                : "bg-ios-orange/15 text-ios-orange"
                                                        )}>
                                                            {comm.status === 'paid' ? 'Pagado' : 'Pendiente'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        {comm.status === 'pending' && (
                                                            <button
                                                                onClick={() => handleMarkAsPaid(comm.id, comm.status)}
                                                                className="h-8 px-3 rounded-lg bg-ios-blue text-white text-xs font-medium hover:bg-ios-blue/90 transition-colors"
                                                            >
                                                                Pagar
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={6} className="p-8 text-center text-ios-gray-500">
                                                    No se encontraron comisiones para los filtros seleccionados
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                ) : (
                    /* Settings Tab */
                    <div className="ios-card p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="h-11 w-11 rounded-2xl bg-ios-purple flex items-center justify-center">
                                <Percent className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-ios-gray-900">Porcentajes de Comisión</h2>
                                <p className="text-sm text-ios-gray-500">Configura el porcentaje de comisión por cada doctor</p>
                            </div>
                        </div>

                        {loadingSettings ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-ios-blue" />
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {commissionSettings.length > 0 ? (
                                    <>
                                        {commissionSettings.map((setting) => (
                                            <div
                                                key={setting.doctor_id}
                                                className="flex items-center justify-between p-4 bg-ios-gray-50 rounded-xl"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold"
                                                        style={{ backgroundColor: setting.doctor?.color || '#007AFF' }}
                                                    >
                                                        {setting.doctor?.full_name?.substring(0, 2).toUpperCase() || '??'}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-ios-gray-900">{setting.doctor?.full_name || 'Doctor'}</p>
                                                        <p className="text-xs text-ios-gray-500">ID: {setting.doctor_id.substring(0, 8)}...</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        value={setting.percentage}
                                                        onChange={(e) => handlePercentageChange(setting.doctor_id, Number(e.target.value))}
                                                        className="ios-input w-20 text-center font-bold text-lg"
                                                    />
                                                    <span className="text-ios-gray-500 font-medium">%</span>
                                                </div>
                                            </div>
                                        ))}

                                        <button
                                            onClick={handleSaveSettings}
                                            disabled={savingSettings}
                                            className="w-full h-12 rounded-xl bg-ios-blue text-white font-semibold flex items-center justify-center gap-2 hover:bg-ios-blue/90 transition-colors touch-feedback disabled:opacity-50 mt-6"
                                        >
                                            {savingSettings ? (
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                            ) : (
                                                <>
                                                    <Save className="h-5 w-5" />
                                                    Guardar Configuración
                                                </>
                                            )}
                                        </button>
                                    </>
                                ) : (
                                    <div className="text-center py-12 text-ios-gray-500">
                                        <User className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                        <p>No hay doctores registrados</p>
                                        <p className="text-sm mt-1">Agrega doctores primero para configurar comisiones</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </MainLayout>
    );
};

export default DoctorCommissions;
