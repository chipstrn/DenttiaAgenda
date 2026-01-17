
import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Gift, Calendar, Loader2 } from 'lucide-react';
import { format, isSameDay, setYear, isAfter, isBefore, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface BirthdayPatient {
    id: string;
    first_name: string;
    last_name: string;
    date_of_birth: string;
    dayOfMonth: number;
    isToday: boolean;
    isPast: boolean;
}

const BirthdayList = () => {
    const navigate = useNavigate();
    const [patients, setPatients] = useState<BirthdayPatient[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBirthdays = async () => {
            try {
                const today = new Date();
                const currentMonth = today.getMonth() + 1; // 1-12

                // Fetch patients with birthdays in the current month
                // Note: Supabase/Postgres specific syntax for filtering by month
                const { data, error } = await supabase
                    .from('patients')
                    .select('id, first_name, last_name, date_of_birth')
                    .not('date_of_birth', 'is', null);

                if (error) throw error;

                // Filter and sort by upcoming day in current month logic
                // Since we can't easily filter by month extract in client-side query without RPC,
                // we'll fetch basic data and filter in JS for now (assuming not huge dataset yet)
                // Optimization: Create an RPC function 'get_birthdays_by_month' later if scaling needed.

                const birthdays = (data || [])
                    .filter(p => {
                        if (!p.date_of_birth) return false;
                        const dob = new Date(p.date_of_birth);
                        // UTC vs Local issue mitigation: split string if strictly YYYY-MM-DD
                        const [year, month, day] = p.date_of_birth.split('-').map(Number);
                        return month === currentMonth;
                    })
                    .map(p => {
                        const [year, month, day] = p.date_of_birth.split('-').map(Number);
                        const currentYearBirthDate = new Date(today.getFullYear(), month - 1, day);

                        // If birthday passed this year but in this month (e.g. today is 16th, bday 10th), 
                        // still show it or prioritize upcoming?
                        // Usually "Birthdays of the Month" shows all.
                        // Let's add a flag if it is today.

                        return {
                            ...p,
                            dayOfMonth: day,
                            isToday: day === today.getDate(),
                            isPast: day < today.getDate()
                        };
                    })
                    .sort((a, b) => a.dayOfMonth - b.dayOfMonth);

                setPatients(birthdays);
            } catch (error) {
                console.error('Error fetching birthdays:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchBirthdays();
    }, []);

    if (loading) {
        return (
            <div className="ios-card p-5 animate-slide-up flex items-center justify-center min-h-[200px]">
                <Loader2 className="h-6 w-6 text-ios-blue animate-spin" />
            </div>
        );
    }

    if (patients.length === 0) {
        return (
            <div className="ios-card p-5 animate-slide-up">
                <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-ios-pink to-ios-red flex items-center justify-center shadow-sm">
                        <Gift className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="font-bold text-ios-gray-900">Cumpleaños</h3>
                </div>
                <div className="text-center py-6">
                    <p className="text-ios-gray-500 text-sm">No hay cumpleaños este mes</p>
                </div>
            </div>
        );
    }

    return (
        <div className="ios-card p-5 animate-slide-up overflow-hidden">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-ios-pink to-ios-red flex items-center justify-center shadow-sm">
                        <Gift className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-ios-gray-900">Cumpleaños</h3>
                        <p className="text-xs text-ios-gray-500 font-medium uppercase tracking-wider">
                            {format(new Date(), 'MMMM', { locale: es })}
                        </p>
                    </div>
                </div>
                <span className="text-xs font-bold bg-ios-pink/10 text-ios-pink px-2.5 py-1 rounded-full">
                    {patients.length}
                </span>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {patients.map((patient) => (
                    <div
                        key={patient.id}
                        onClick={() => navigate('/patient/' + patient.id + '/intake')}
                        className={cn(
                            "flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer touch-feedback group",
                            patient.isToday
                                ? "bg-gradient-to-r from-ios-pink/10 to-transparent border border-ios-pink/20"
                                : "hover:bg-ios-gray-50 border border-transparent"
                        )}
                    >
                        <div className={cn(
                            "h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm transition-transform group-hover:scale-105",
                            patient.isToday ? "bg-ios-pink text-white" : "bg-white border border-ios-gray-100 text-ios-gray-700"
                        )}>
                            {patient.dayOfMonth}
                        </div>

                        <div className="flex-1 min-w-0">
                            <p className={cn(
                                "font-semibold truncate",
                                patient.isToday ? "text-ios-pink" : "text-ios-gray-900"
                            )}>
                                {patient.first_name} {patient.last_name}
                            </p>
                            <p className="text-xs text-ios-gray-500 flex items-center gap-1">
                                {patient.isToday ? (
                                    <span className="font-bold animate-pulse">¡Es hoy! 🎉</span>
                                ) : patient.isPast ? (
                                    <span>Ya pasó</span>
                                ) : (
                                    <span>Próximamente</span>
                                )}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BirthdayList;
