import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Location {
    id: string;
    name: string;
    is_active: boolean;
}

export const useClinicLocations = () => {
    const [locations, setLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchLocations = useCallback(async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('locations')
                .select('*')
                .eq('is_active', true)
                .order('name', { ascending: true });

            if (error) throw error;
            setLocations(data || []);
        } catch (err) {
            console.error('Error fetching locations:', err);
            setError(err as Error);
            toast.error('Error al cargar sedes');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLocations();
    }, [fetchLocations]);

    return { locations, loading, error, refetch: fetchLocations };
};
