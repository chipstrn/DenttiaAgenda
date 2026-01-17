
import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, User, Stethoscope, ChevronRight, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

// Simple debounce hook implementation if not found
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

interface SearchResult {
    id: string;
    type: 'patient' | 'doctor';
    title: string;
    subtitle: string;
}

const GlobalSearch = () => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const debouncedSearch = useDebounce(searchTerm, 300);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const performSearch = async () => {
            if (!debouncedSearch.trim()) {
                setResults([]);
                return;
            }

            setLoading(true);
            try {
                const term = debouncedSearch.toLowerCase().trim();

                // Search Patients
                const { data: patients } = await supabase
                    .from('patients')
                    .select('id, first_name, last_name, phone')
                    .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%`)
                    .limit(5);

                // Search Doctors
                const { data: doctors } = await supabase
                    .from('doctors')
                    .select('id, full_name, specialty')
                    .ilike('full_name', `%${term}%`)
                    .limit(3);

                const formattedResults: SearchResult[] = [
                    ...(patients || []).map(p => ({
                        id: p.id,
                        type: 'patient' as const,
                        title: `${p.first_name} ${p.last_name}`,
                        subtitle: p.phone || 'Sin teléfono'
                    })),
                    ...(doctors || []).map(d => ({
                        id: d.id,
                        type: 'doctor' as const,
                        title: d.full_name,
                        subtitle: d.specialty || 'Doctor'
                    }))
                ];

                setResults(formattedResults);
                setIsOpen(true);
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setLoading(false);
            }
        };

        performSearch();
    }, [debouncedSearch]);

    const handleSelect = (result: SearchResult) => {
        setIsOpen(false);
        setSearchTerm(''); // Optional: clear search on select
        if (result.type === 'patient') {
            navigate(`/patient/${result.id}/intake`); // Or dashboard/profile view if exists
        } else if (result.type === 'doctor') {
            navigate('/doctors'); // Navigate to doctors list, maybe filter? For now list.
        }
    };

    return (
        <div className="relative w-80" ref={containerRef}>
            <div className="relative group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ios-gray-400 transition-colors group-focus-within:text-ios-blue" />
                <Input
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        if (!isOpen && e.target.value.trim()) setIsOpen(true);
                    }}
                    onFocus={() => {
                        if (results.length > 0) setIsOpen(true);
                    }}
                    placeholder="Buscar pacientes, doctores..."
                    className="pl-10 h-10 bg-white/80 border-0 rounded-xl text-sm placeholder:text-ios-gray-400 focus-visible:ring-2 focus-visible:ring-ios-blue/30 focus-visible:bg-white transition-all duration-200 shadow-ios-sm w-full"
                />
                {searchTerm && (
                    <button
                        onClick={() => {
                            setSearchTerm('');
                            setResults([]);
                            setIsOpen(false);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ios-gray-400 hover:text-ios-gray-600"
                    >
                        <X className="h-3 w-3" />
                    </button>
                )}
            </div>

            {/* Results Dropdown */}
            {isOpen && (searchTerm.trim().length > 0) && (
                <div className="absolute top-12 left-0 w-full bg-white/80 backdrop-blur-xl rounded-2xl shadow-ios-lg border border-white/20 overflow-hidden animate-slide-up z-50">
                    {loading ? (
                        <div className="p-4 flex items-center justify-center text-ios-gray-500">
                            <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            <span className="text-sm">Buscando...</span>
                        </div>
                    ) : results.length > 0 ? (
                        <div className="py-2 max-h-[400px] overflow-y-auto">
                            <div className="px-3 py-1.5 text-xs font-semibold text-ios-gray-400 uppercase tracking-wider">
                                Resultados
                            </div>
                            {results.map((result) => (
                                <button
                                    key={`${result.type}-${result.id}`}
                                    onClick={() => handleSelect(result)}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-ios-blue/5 transition-colors touch-feedback text-left"
                                >
                                    <div className={cn(
                                        "h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0",
                                        result.type === 'patient' ? "bg-ios-blue/10 text-ios-blue" : "bg-ios-green/10 text-ios-green"
                                    )}>
                                        {result.type === 'patient' ? <User className="h-4 w-4" /> : <Stethoscope className="h-4 w-4" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-ios-gray-900 truncate">{result.title}</p>
                                        <p className="text-xs text-ios-gray-500 truncate">{result.subtitle}</p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-ios-gray-300" />
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="p-4 text-center text-ios-gray-500 text-sm">
                            No se encontraron resultados
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default GlobalSearch;
