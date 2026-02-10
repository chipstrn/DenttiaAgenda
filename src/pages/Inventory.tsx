import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Search, Package, AlertTriangle, Edit2, Trash2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface InventoryItem {
    id: string;
    name: string;
    sku: string;
    description: string;
    current_stock: number;
    min_stock: number;
    cost: number;
    unit: string;
}

const Inventory = () => {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        sku: '',
        description: '',
        current_stock: 0,
        min_stock: 5,
        cost: 0,
        unit: 'pieza'
    });

    useEffect(() => {
        fetchItems();
    }, []);

    const fetchItems = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('inventory_items')
                .select('*')
                .order('name');

            if (error) throw error;
            setItems(data || []);
        } catch (error) {
            console.error('Error fetching inventory:', error);
            toast.error('Error al cargar inventario');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (item?: InventoryItem) => {
        if (item) {
            setEditingItem(item);
            setFormData({
                name: item.name,
                sku: item.sku || '',
                description: item.description || '',
                current_stock: item.current_stock,
                min_stock: item.min_stock,
                cost: item.cost || 0,
                unit: item.unit || 'pieza'
            });
        } else {
            setEditingItem(null);
            setFormData({
                name: '',
                sku: '',
                description: '',
                current_stock: 0,
                min_stock: 5,
                cost: 0,
                unit: 'pieza'
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingItem) {
                const { error } = await supabase
                    .from('inventory_items')
                    .update(formData)
                    .eq('id', editingItem.id);
                if (error) throw error;
                toast.success('Ítem actualizado');
            } else {
                const { error } = await supabase
                    .from('inventory_items')
                    .insert([formData]);
                if (error) throw error;
                toast.success('Ítem creado');
            }
            setIsModalOpen(false);
            fetchItems();
        } catch (error) {
            console.error('Error saving item:', error);
            toast.error('Error al guardar');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este ítem?')) return;
        try {
            const { error } = await supabase
                .from('inventory_items')
                .delete()
                .eq('id', id);
            if (error) throw error;
            toast.success('Ítem eliminado');
            fetchItems();
        } catch (error) {
            console.error('Error deleting:', error);
            toast.error('Error al eliminar');
        }
    };

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const lowStockCount = items.filter(i => i.current_stock <= i.min_stock).length;

    return (
        <div className="flex flex-col h-screen bg-ios-gray-50 overflow-hidden">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-md border-b border-ios-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
                <div>
                    <h1 className="text-2xl font-bold text-ios-gray-900">Inventario</h1>
                    <p className="text-sm text-ios-gray-500">Gestión de materiales e insumos</p>
                </div>
                <div className="flex items-center gap-3">
                    {lowStockCount > 0 && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 text-orange-600 rounded-full text-sm font-medium border border-orange-200">
                            <AlertTriangle className="w-4 h-4" />
                            <span>{lowStockCount} Bajos en Stock</span>
                        </div>
                    )}
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 px-4 py-2 bg-ios-blue text-white rounded-xl hover:bg-ios-blue-dark transition-colors shadow-sm active:scale-95 transform duration-100"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Nuevo Ítem</span>
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-auto p-6">

                {/* Search Bar */}
                <div className="mb-6 max-w-md relative">
                    <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-ios-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o SKU..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white border border-ios-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ios-blue/50 transition-all font-medium text-ios-gray-800 placeholder-ios-gray-400"
                    />
                </div>

                {/* Inventory List */}
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ios-blue"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredItems.map(item => (
                            <div
                                key={item.id}
                                className={`bg-white rounded-2xl p-5 border shadow-sm hover:shadow-md transition-all group relative ${item.current_stock <= item.min_stock ? 'border-orange-200 ring-1 ring-orange-100' : 'border-ios-gray-200'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="p-2 bg-ios-gray-100 rounded-lg text-ios-gray-600">
                                        <Package className="w-6 h-6" />
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleOpenModal(item)}
                                            className="p-1.5 text-ios-gray-500 hover:text-ios-blue hover:bg-blue-50 rounded-lg transition-colors"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="p-1.5 text-ios-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <h3 className="font-semibold text-ios-gray-900 mb-1 line-clamp-1">{item.name}</h3>
                                <p className="text-sm text-ios-gray-500 mb-4 line-clamp-2 min-h-[40px]">{item.description || 'Sin descripción'}</p>

                                <div className="flex justify-between items-end border-t border-ios-gray-100 pt-3">
                                    <div>
                                        <p className="text-xs text-ios-gray-400 uppercase tracking-wider font-semibold mb-0.5">Stock</p>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xl font-bold ${item.current_stock <= item.min_stock ? 'text-orange-600' : 'text-ios-gray-800'
                                                }`}>
                                                {item.current_stock}
                                            </span>
                                            <span className="text-xs text-ios-gray-500">{item.unit}s</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-ios-gray-400 uppercase tracking-wider font-semibold mb-0.5">Costo</p>
                                        <span className="font-medium text-ios-gray-700">${item.cost.toFixed(2)}</span>
                                    </div>
                                </div>

                                {item.current_stock <= item.min_stock && (
                                    <div className="absolute top-4 right-4 flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
                        <div className="px-6 py-4 border-b border-ios-gray-100 flex justify-between items-center bg-white">
                            <h2 className="text-lg font-bold text-ios-gray-900">
                                {editingItem ? 'Editar Ítem' : 'Nuevo Ítem'}
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 text-ios-gray-400 hover:text-ios-gray-600 rounded-full hover:bg-ios-gray-100 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-ios-gray-700 mb-1">Nombre del Material</label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-2 rounded-xl border border-ios-gray-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/50"
                                        placeholder="Ej. Anestesia Local"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-ios-gray-700 mb-1">Descripción</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-4 py-2 rounded-xl border border-ios-gray-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/50"
                                    rows={2}
                                    placeholder="Detalles opcionales..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-ios-gray-700 mb-1">SKU / Código</label>
                                    <input
                                        type="text"
                                        value={formData.sku}
                                        onChange={e => setFormData({ ...formData, sku: e.target.value })}
                                        className="w-full px-4 py-2 rounded-xl border border-ios-gray-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/50"
                                        placeholder="OPCIONAL"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-ios-gray-700 mb-1">Unidad de Medida</label>
                                    <select
                                        value={formData.unit}
                                        onChange={e => setFormData({ ...formData, unit: e.target.value })}
                                        className="w-full px-4 py-2 rounded-xl border border-ios-gray-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/50 bg-white"
                                    >
                                        <option value="pieza">Pieza</option>
                                        <option value="caja">Caja</option>
                                        <option value="paquete">Paquete</option>
                                        <option value="litro">Litro</option>
                                        <option value="ml">Mililitro</option>
                                        <option value="gramo">Gramo</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4 bg-ios-gray-50 p-4 rounded-xl border border-ios-gray-200">
                                <div>
                                    <label className="block text-xs font-bold text-ios-gray-500 uppercase mb-1">Stock Actual</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.current_stock}
                                        onChange={e => setFormData({ ...formData, current_stock: parseInt(e.target.value) || 0 })}
                                        className="w-full px-3 py-1.5 rounded-lg border border-ios-gray-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/50 text-center font-bold text-ios-gray-800"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-ios-gray-500 uppercase mb-1">Mínimo</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.min_stock}
                                        onChange={e => setFormData({ ...formData, min_stock: parseInt(e.target.value) || 0 })}
                                        className="w-full px-3 py-1.5 rounded-lg border border-ios-gray-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/50 text-center text-ios-gray-600"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-ios-gray-500 uppercase mb-1">Costo Unit.</label>
                                    <div className="relative">
                                        <span className="absolute left-2 top-1.5 text-ios-gray-400">$</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={formData.cost}
                                            onChange={e => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                                            className="w-full pl-6 pr-3 py-1.5 rounded-lg border border-ios-gray-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/50 font-medium text-ios-gray-800"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-ios-gray-600 font-medium hover:bg-ios-gray-100 rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-ios-blue text-white font-medium rounded-xl hover:bg-ios-blue-dark shadow-md active:scale-95 transition-all"
                                >
                                    {editingItem ? 'Guardar Cambios' : 'Crear Ítem'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventory;
