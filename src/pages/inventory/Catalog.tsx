import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Search, Grid3x3, List, Edit, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface InventoryItem {
    id: string;
    name: string;
    category: string;
    current_stock: number;
    minimum_stock: number;
    unit_price: number;
    unit_of_measure: string;
    active: boolean;
    description?: string;
}

type ViewMode = 'grid' | 'list';

export default function InventoryCatalog() {
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

    const queryClient = useQueryClient();

    // Fetch inventory items
    const { data: items = [], isLoading } = useQuery({
        queryKey: ['inventory-items', categoryFilter, statusFilter],
        queryFn: async () => {
            let query = supabase
                .from('inventory_items')
                .select('*')
                .order('name');

            if (statusFilter === 'active') {
                query = query.eq('active', true);
            } else if (statusFilter === 'inactive') {
                query = query.eq('active', false);
            }

            if (categoryFilter !== 'all') {
                query = query.eq('category', categoryFilter);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data as InventoryItem[];
        },
    });

    // Get unique categories
    const categories = Array.from(new Set(items.map(item => item.category || 'Sin categoría')));

    // Filter items by search term
    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('inventory_items')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
            toast.success('Item eliminado exitosamente');
        },
        onError: () => {
            toast.error('Error al eliminar el item');
        },
    });

    // Toggle active status mutation
    const toggleActiveMutation = useMutation({
        mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
            const { error } = await supabase
                .from('inventory_items')
                .update({ active: !active })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
            toast.success('Estado actualizado');
        },
    });

    const handleDelete = (id: string, name: string) => {
        if (window.confirm(`¿Está seguro de eliminar "${name}"?`)) {
            deleteMutation.mutate(id);
        }
    };

    const getStockStatusColor = (item: InventoryItem) => {
        if (item.current_stock === 0) return 'text-ios-red bg-red-50';
        if (item.current_stock <= item.minimum_stock) return 'text-ios-orange bg-orange-50';
        return 'text-ios-green bg-green-50';
    };

    const getStockStatusText = (item: InventoryItem) => {
        if (item.current_stock === 0) return 'Sin stock';
        if (item.current_stock <= item.minimum_stock) return 'Stock bajo';
        return 'Stock normal';
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ios-blue"></div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Catálogo de Inventario</h1>
                    <p className="text-gray-500 mt-1">{filteredItems.length} items encontrados</p>
                </div>
                <button
                    onClick={() => {
                        setEditingItem(null);
                        setShowForm(true);
                    }}
                    className="px-4 py-2 bg-ios-blue text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                >
                    <Plus className="h-5 w-5" />
                    Nuevo Item
                </button>
            </div>

            {/* Filters and Search */}
            <div className="ios-card p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar items..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ios-blue"
                        />
                    </div>

                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ios-blue"
                    >
                        <option value="all">Todas las categorías</option>
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ios-blue"
                    >
                        <option value="all">Todos los estados</option>
                        <option value="active">Activos</option>
                        <option value="inactive">Inactivos</option>
                    </select>

                    <div className="flex gap-2">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`flex-1 px-4 py-2 rounded-lg transition-colors ${viewMode === 'grid'
                                ? 'bg-ios-blue text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            <Grid3x3 className="h-5 w-5 mx-auto" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`flex-1 px-4 py-2 rounded-lg transition-colors ${viewMode === 'list'
                                ? 'bg-ios-blue text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            <List className="h-5 w-5 mx-auto" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Items Display */}
            {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredItems.map(item => (
                        <div key={item.id} className="ios-card p-4 relative">
                            {!item.active && (
                                <div className="absolute top-2 right-2">
                                    <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded-full">
                                        Inactivo
                                    </span>
                                </div>
                            )}

                            <div className="mb-3">
                                <h3 className="font-semibold text-lg text-gray-900">{item.name}</h3>
                                <p className="text-sm text-gray-500">{item.category}</p>
                            </div>

                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">Stock actual:</span>
                                    <span className={`px-2 py-1 rounded-full text-sm font-medium ${getStockStatusColor(item)}`}>
                                        {item.current_stock} {item.unit_of_measure}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">Stock mínimo:</span>
                                    <span className="text-sm font-medium">{item.minimum_stock}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">Precio:</span>
                                    <span className="text-sm font-medium">
                                        ${item.unit_price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setEditingItem(item);
                                        setShowForm(true);
                                    }}
                                    className="flex-1 px-3 py-2 bg-ios-blue text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Edit className="h-4 w-4" />
                                    Editar
                                </button>
                                <button
                                    onClick={() => toggleActiveMutation.mutate({ id: item.id, active: item.active })}
                                    className={`flex-1 px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${item.active
                                        ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                        : 'bg-ios-green text-white hover:bg-green-600'
                                        }`}
                                >
                                    {item.active ? (
                                        <>
                                            <AlertCircle className="h-4 w-4" />
                                            Desactivar
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle className="h-4 w-4" />
                                            Activar
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="ios-card divide-y">
                    {filteredItems.map(item => (
                        <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                            <div className="flex-1">
                                <div className="flex items-center gap-3">
                                    <h3 className="font-semibold text-gray-900">{item.name}</h3>
                                    {!item.active && (
                                        <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded-full">
                                            Inactivo
                                        </span>
                                    )}
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStockStatusColor(item)}`}>
                                        {getStockStatusText(item)}
                                    </span>
                                </div>
                                <div className="flex gap-6 mt-2 text-sm text-gray-600">
                                    <span>Categoría: {item.category}</span>
                                    <span>Stock: {item.current_stock} / {item.minimum_stock} {item.unit_of_measure}</span>
                                    <span>Precio: ${item.unit_price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setEditingItem(item);
                                        setShowForm(true);
                                    }}
                                    className="p-2 text-ios-blue hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                    <Edit className="h-5 w-5" />
                                </button>
                                <button
                                    onClick={() => toggleActiveMutation.mutate({ id: item.id, active: item.active })}
                                    className={`p-2 rounded-lg transition-colors ${item.active
                                        ? 'text-gray-600 hover:bg-gray-100'
                                        : 'text-ios-green hover:bg-green-50'
                                        }`}
                                >
                                    {item.active ? <AlertCircle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
                                </button>
                                <button
                                    onClick={() => handleDelete(item.id, item.name)}
                                    className="p-2 text-ios-red hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <Trash2 className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {filteredItems.length === 0 && (
                <div className="ios-card p-12 text-center">
                    <p className="text-gray-500">No se encontraron items que coincidan con los filtros</p>
                </div>
            )}
        </div>
    );
}
