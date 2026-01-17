"use client";

import React, { useEffect, useState, useCallback } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
    BarChart3, Users, Calendar, TrendingUp, DollarSign,
    Loader2, UserPlus, MessageCircle, Star, PieChart,
    ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface StatsData {
    totalPatients: number;
    newPatientsThisMonth: number;
    newPatientsLastMonth: number;
    totalAppointments: number;
    completedAppointments: number;
    cancelledAppointments: number;
    monthlyRevenue: number;
    lastMonthRevenue: number;
    referralSources: { source: string; count: number }[];
    doctorStats: { name: string; appointments: number; revenue: number; color: string }[];
    appointmentsByStatus: { status: string; count: number }[];
}

const REFERRAL_OPTIONS = [
    { value: 'facebook', label: 'Facebook', color: '#1877F2' },
    { value: 'instagram', label: 'Instagram', color: '#E4405F' },
    { value: 'google', label: 'Google', color: '#4285F4' },
    { value: 'recommendation', label: 'Recomendación', color: '#34C759' },
    { value: 'sign', label: 'Letrero/Local', color: '#FF9500' },
    { value: 'other', label: 'Otro', color: '#8E8E93' },
];

const Reports = () => {
    const { isAdmin } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<StatsData>({
        totalPatients: 0,
        newPatientsThisMonth: 0,
        newPatientsLastMonth: 0,
        totalAppointments: 0,
        completedAppointments: 0,
        cancelledAppointments: 0,
        monthlyRevenue: 0,
        lastMonthRevenue: 0,
        referralSources: [],
        doctorStats: [],
        appointmentsByStatus: [],
    });
    const [dateRange, setDateRange] = useState('month');

    const fetchStats = useCallback(async () => {
        try {
            const now = new Date();
            const monthStart = startOfMonth(now).toISOString();
            const monthEnd = endOfMonth(now).toISOString();
            const lastMonthStart = startOfMonth(subMonths(now, 1)).toISOString();
            const lastMonthEnd = endOfMonth(subMonths(now, 1)).toISOString();

            // Fetch all data in parallel
            const [
                patientsResult,
                newPatientsThisMonthResult,
                newPatientsLastMonthResult,
                appointmentsResult,
                paymentsThisMonthResult,
                paymentsLastMonthResult,
                doctorsResult,
                patientRecordsResult,
                patientSourcesResult,
            ] = await Promise.all([
                supabase.from('patients').select('id, created_at'),
                supabase.from('patients').select('id', { count: 'exact', head: true })
                    .gte('created_at', monthStart).lte('created_at', monthEnd),
                supabase.from('patients').select('id', { count: 'exact', head: true })
                    .gte('created_at', lastMonthStart).lte('created_at', lastMonthEnd),
                supabase.from('appointments').select('id, status, doctor_id, start_time'),
                supabase.from('payments').select('amount').eq('status', 'completed')
                    .gte('created_at', monthStart).lte('created_at', monthEnd),
                supabase.from('payments').select('amount').eq('status', 'completed')
                    .gte('created_at', lastMonthStart).lte('created_at', lastMonthEnd),
                supabase.from('doctors').select('id, full_name, color').eq('is_active', true),
                supabase.from('patient_records').select('source_id'),
                supabase.from('patient_sources').select('id, name'),
            ]);

            // Build source name lookup
            const sourceNameMap = new Map<string, string>();
            patientSourcesResult.data?.forEach(s => sourceNameMap.set(s.id, s.name));

            // Calculate referral sources from patient_records
            const referralCounts: Record<string, number> = {};
            patientRecordsResult.data?.forEach(record => {
                const sourceName = record.source_id ? (sourceNameMap.get(record.source_id) || 'Otro') : 'Sin especificar';
                referralCounts[sourceName] = (referralCounts[sourceName] || 0) + 1;
            });
            const referralSources = Object.entries(referralCounts)
                .map(([source, count]) => ({ source, count }))
                .sort((a, b) => b.count - a.count);

            // Calculate appointments by status
            const statusCounts: Record<string, number> = {};
            appointmentsResult.data?.forEach(a => {
                statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
            });
            const appointmentsByStatus = Object.entries(statusCounts)
                .map(([status, count]) => ({ status, count }));

            // Calculate doctor stats
            const doctorAppointments: Record<string, number> = {};
            appointmentsResult.data?.forEach(a => {
                if (a.doctor_id) {
                    doctorAppointments[a.doctor_id] = (doctorAppointments[a.doctor_id] || 0) + 1;
                }
            });
            const doctorStats = doctorsResult.data?.map(d => ({
                name: d.full_name,
                appointments: doctorAppointments[d.id] || 0,
                revenue: 0, // Would need to join with payments
                color: d.color || '#007AFF',
            })) || [];

            // Revenue calculations
            const monthlyRevenue = paymentsThisMonthResult.data?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
            const lastMonthRevenue = paymentsLastMonthResult.data?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

            setStats({
                totalPatients: patientsResult.data?.length || 0,
                newPatientsThisMonth: newPatientsThisMonthResult.count || 0,
                newPatientsLastMonth: newPatientsLastMonthResult.count || 0,
                totalAppointments: appointmentsResult.data?.length || 0,
                completedAppointments: statusCounts['completed'] || 0,
                cancelledAppointments: statusCounts['cancelled'] || 0,
                monthlyRevenue,
                lastMonthRevenue,
                referralSources,
                doctorStats,
                appointmentsByStatus,
            });
        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            'scheduled': 'Agendada',
            'confirmed': 'Confirmada',
            'in-progress': 'En Progreso',
            'completed': 'Completada',
            'cancelled': 'Cancelada',
            'noshow': 'No Vino',
            'rescheduled': 'Reagendada',
        };
        return labels[status] || status;
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            'scheduled': '#FF9500',
            'confirmed': '#34C759',
            'in-progress': '#007AFF',
            'completed': '#8E8E93',
            'cancelled': '#FF3B30',
            'noshow': '#FF3B30',
            'rescheduled': '#AF52DE',
        };
        return colors[status] || '#8E8E93';
    };

    const getReferralLabel = (source: string) => {
        return source || 'Sin especificar';
    };

    const getReferralColor = (source: string) => {
        // Map source names to colors
        const colorMap: Record<string, string> = {
            'Facebook': '#1877F2',
            'Instagram': '#E4405F',
            'Google': '#4285F4',
            'Recomendación': '#34C759',
            'Letrero': '#FF9500',
            'Local': '#FF9500',
            'Otro': '#8E8E93',
            'Sin especificar': '#8E8E93',
        };
        // Check for partial matches
        for (const [key, color] of Object.entries(colorMap)) {
            if (source.toLowerCase().includes(key.toLowerCase())) {
                return color;
            }
        }
        return '#AF52DE'; // Default purple for other sources
    };

    const patientGrowth = stats.newPatientsLastMonth > 0
        ? ((stats.newPatientsThisMonth - stats.newPatientsLastMonth) / stats.newPatientsLastMonth * 100).toFixed(0)
        : stats.newPatientsThisMonth > 0 ? '+100' : '0';

    const revenueGrowth = stats.lastMonthRevenue > 0
        ? ((stats.monthlyRevenue - stats.lastMonthRevenue) / stats.lastMonthRevenue * 100).toFixed(0)
        : stats.monthlyRevenue > 0 ? '+100' : '0';

    if (loading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-ios-blue" />
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            {/* Header */}
            <div className="mb-8 animate-fade-in">
                <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">Reportes y Estadísticas</h1>
                <p className="text-ios-gray-500 mt-1 font-medium">
                    Métricas clave de tu clínica • {format(new Date(), "MMMM yyyy", { locale: es })}
                </p>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                {/* Total Patients */}
                <div className="ios-card p-5 animate-slide-up">
                    <div className="flex items-start justify-between mb-4">
                        <div className="h-11 w-11 rounded-2xl bg-ios-blue flex items-center justify-center">
                            <Users className="h-5 w-5 text-white" />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-ios-gray-900">{stats.totalPatients}</p>
                    <p className="text-sm text-ios-gray-500 font-medium mt-1">Total Pacientes</p>
                </div>

                {/* New Patients This Month */}
                <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '50ms' }}>
                    <div className="flex items-start justify-between mb-4">
                        <div className="h-11 w-11 rounded-2xl bg-ios-green flex items-center justify-center">
                            <UserPlus className="h-5 w-5 text-white" />
                        </div>
                        <div className={cn(
                            "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full",
                            Number(patientGrowth) >= 0 ? "bg-ios-green/10 text-ios-green" : "bg-ios-red/10 text-ios-red"
                        )}>
                            {Number(patientGrowth) >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {patientGrowth}%
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-ios-gray-900">{stats.newPatientsThisMonth}</p>
                    <p className="text-sm text-ios-gray-500 font-medium mt-1">Pacientes Nuevos (Mes)</p>
                </div>

                {/* Monthly Revenue */}
                <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '100ms' }}>
                    <div className="flex items-start justify-between mb-4">
                        <div className="h-11 w-11 rounded-2xl bg-ios-teal flex items-center justify-center">
                            <DollarSign className="h-5 w-5 text-white" />
                        </div>
                        <div className={cn(
                            "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full",
                            Number(revenueGrowth) >= 0 ? "bg-ios-green/10 text-ios-green" : "bg-ios-red/10 text-ios-red"
                        )}>
                            {Number(revenueGrowth) >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {revenueGrowth}%
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-ios-gray-900">
                        ${stats.monthlyRevenue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-sm text-ios-gray-500 font-medium mt-1">Ingresos del Mes</p>
                </div>

                {/* Appointments */}
                <div className="ios-card p-5 animate-slide-up" style={{ animationDelay: '150ms' }}>
                    <div className="flex items-start justify-between mb-4">
                        <div className="h-11 w-11 rounded-2xl bg-ios-orange flex items-center justify-center">
                            <Calendar className="h-5 w-5 text-white" />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-ios-gray-900">{stats.completedAppointments}</p>
                    <p className="text-sm text-ios-gray-500 font-medium mt-1">Citas Completadas</p>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Referral Sources */}
                <div className="ios-card p-6 animate-slide-up" style={{ animationDelay: '200ms' }}>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-10 w-10 rounded-xl bg-ios-purple/10 flex items-center justify-center">
                            <MessageCircle className="h-5 w-5 text-ios-purple" />
                        </div>
                        <div>
                            <h3 className="font-bold text-ios-gray-900">¿Cómo nos conocieron?</h3>
                            <p className="text-xs text-ios-gray-500">Fuente de referencia de pacientes</p>
                        </div>
                    </div>

                    {stats.referralSources.length > 0 ? (
                        <div className="space-y-3">
                            {stats.referralSources.map((item, index) => {
                                const total = stats.referralSources.reduce((sum, s) => sum + s.count, 0);
                                const percentage = total > 0 ? (item.count / total * 100).toFixed(0) : 0;
                                return (
                                    <div key={item.source} className="animate-fade-in" style={{ animationDelay: `${250 + index * 50}ms` }}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-ios-gray-900">
                                                {getReferralLabel(item.source)}
                                            </span>
                                            <span className="text-sm text-ios-gray-500">{item.count} ({percentage}%)</span>
                                        </div>
                                        <div className="h-2 bg-ios-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${percentage}%`,
                                                    backgroundColor: getReferralColor(item.source)
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-ios-gray-500">
                            <PieChart className="h-12 w-12 mx-auto mb-3 opacity-20" />
                            <p>Sin datos de referencia</p>
                            <p className="text-xs mt-1">Los pacientes no tienen fuente de referencia registrada</p>
                        </div>
                    )}
                </div>

                {/* Appointments by Status */}
                <div className="ios-card p-6 animate-slide-up" style={{ animationDelay: '250ms' }}>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-10 w-10 rounded-xl bg-ios-orange/10 flex items-center justify-center">
                            <BarChart3 className="h-5 w-5 text-ios-orange" />
                        </div>
                        <div>
                            <h3 className="font-bold text-ios-gray-900">Citas por Estado</h3>
                            <p className="text-xs text-ios-gray-500">Distribución de estados de citas</p>
                        </div>
                    </div>

                    {stats.appointmentsByStatus.length > 0 ? (
                        <div className="space-y-3">
                            {stats.appointmentsByStatus.map((item, index) => {
                                const percentage = stats.totalAppointments > 0
                                    ? (item.count / stats.totalAppointments * 100).toFixed(0)
                                    : 0;
                                return (
                                    <div key={item.status} className="animate-fade-in" style={{ animationDelay: `${300 + index * 50}ms` }}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-ios-gray-900">
                                                {getStatusLabel(item.status)}
                                            </span>
                                            <span className="text-sm text-ios-gray-500">{item.count} ({percentage}%)</span>
                                        </div>
                                        <div className="h-2 bg-ios-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${percentage}%`,
                                                    backgroundColor: getStatusColor(item.status)
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-ios-gray-500">
                            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-20" />
                            <p>Sin citas registradas</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Doctor Performance */}
            <div className="ios-card p-6 animate-slide-up" style={{ animationDelay: '300ms' }}>
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 rounded-xl bg-ios-indigo/10 flex items-center justify-center">
                        <Star className="h-5 w-5 text-ios-indigo" />
                    </div>
                    <div>
                        <h3 className="font-bold text-ios-gray-900">Desempeño por Doctor</h3>
                        <p className="text-xs text-ios-gray-500">Citas atendidas por cada profesional</p>
                    </div>
                </div>

                {stats.doctorStats.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {stats.doctorStats.map((doctor, index) => (
                            <div
                                key={doctor.name}
                                className="p-4 rounded-2xl bg-ios-gray-50 animate-fade-in"
                                style={{ animationDelay: `${350 + index * 50}ms` }}
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <div
                                        className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold"
                                        style={{ backgroundColor: doctor.color }}
                                    >
                                        {doctor.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-ios-gray-900 text-sm">{doctor.name}</p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-ios-gray-500">Citas Atendidas</span>
                                    <span className="text-lg font-bold text-ios-gray-900">{doctor.appointments}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-ios-gray-500">
                        <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p>Sin datos de doctores</p>
                    </div>
                )}
            </div>
        </MainLayout>
    );
};

export default Reports;
