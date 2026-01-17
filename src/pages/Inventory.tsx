
import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Archive, AlertTriangle, ArrowUpRight, ArrowDownRight, Package, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';

interface InventoryItem {
    id: string;
    name: string;
    sku: string;
    current_stock: number;
    min_stock: number;
    unit: string;
    cost: number;
}

const Inventory = () => {
    const { profile } = useAuth();
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isAdjustOpen, setIsAdjustOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

    // Form states
    const [newItem, setNewItem] = useState({
        name: '',
        sku: '',
        min_stock: '5',
        unit: 'piezas',
        cost: '0',
        current_stock: '0'
    });

    const [adjustment, setAdjustment] = useState({
        type: 'IN', // IN, OUT
        quantity: '1',
        notes: ''
    });

    useEffect(() => {
        fetchItems();
    }, []);

    const fetchItems = async () => {
        try {
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

    const handleCreateItem = async () => {
        try {
            if (!newItem.name) return toast.error('El nombre es obligatorio');

            setSaving(true);
            const { error } = await supabase.from('inventory_items').insert([{
                name: newItem.name,
                sku: newItem.sku,
                current_stock: parseFloat(newItem.current_stock) || 0,
                min_stock: parseFloat(newItem.min_stock) || 0,
                unit: newItem.unit,
                cost: parseFloat(newItem.cost) || 0
            }]);

            if (error) throw error;

            toast.success(`Producto "${newItem.name}" creado`);
            setIsAddOpen(false);
            setNewItem({ name: '', sku: '', min_stock: '5', unit: 'piezas', cost: '0', current_stock: '0' });
            fetchItems();
        } catch (error) {
            console.error('Error creating item:', error);
            toast.error('Error al crear producto');
        } finally {
            setSaving(false);
        }
    };

    const handleAdjustment = async () => {
        if (!selectedItem) return;

        try {
            setSaving(true);
            // 1. Create transaction
            const { error: txError } = await supabase.from('inventory_transactions').insert([{
                item_id: selectedItem.id,
                type: adjustment.type,
                quantity: adjustment.quantity,
                notes: adjustment.notes,
                user_id: profile?.id
            }]);

            if (txError) throw txError;

            // 2. Update stock
            const qty = parseFloat(adjustment.quantity) || 0;
            const newStock = adjustment.type === 'IN'
                ? selectedItem.current_stock + qty
                : selectedItem.current_stock - qty;

            const { error: updateError } = await supabase
                .from('inventory_items')
                .update({ current_stock: newStock })
                .eq('id', selectedItem.id);

            if (updateError) throw updateError;

            toast.success(`Stock de "${selectedItem.name}" actualizado: ${newStock} ${selectedItem.unit}`);
            setIsAdjustOpen(false);
            setAdjustment({ type: 'IN', quantity: '1', notes: '' });
            setSelectedItem(null);
            fetchItems();
        } catch (error) {
            console.error('Error adjusting stock:', error);
            toast.error('Error al ajustar stock');
        } finally {
            setSaving(false);
        }
    };

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <MainLayout>
            <div className="mb-8 animate-fade-in">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">Inventario</h1>
                        <p className="text-ios-gray-500 mt-1 font-medium">Gestión de materiales y productos</p>
                    </div>
                    <Button
                        onClick={() => setIsAddOpen(true)}
                        className="bg-ios-blue hover:bg-ios-blue/90 text-white rounded-xl shadow-ios-sm shadow-ios-blue/20"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Nuevo Producto
                    </Button>
                </div>
            </div>

            <div className="bg-white rounded-3xl border border-ios-gray-100 shadow-sm overflow-hidden animate-slide-up">
                {/* Toolbar */}
                <div className="p-4 border-b border-ios-gray-50 flex items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ios-gray-400" />
                        <Input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar por nombre o SKU..."
                            className="pl-9 h-10 bg-ios-gray-50 border-0 rounded-xl focus-visible:ring-1 focus-visible:ring-ios-blue/30"
                        />
                    </div>
                </div>

                {/* List */}
                <div className="divide-y divide-ios-gray-50">
                    {filteredItems.length === 0 ? (
                        <div className="p-12 text-center text-ios-gray-400">
                            <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
                            <p>No hay productos en el inventario</p>
                        </div>
                    ) : (
                        filteredItems.map((item) => (
                            <div key={item.id} className="p-4 hover:bg-ios-gray-50/50 transition-colors flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${item.current_stock <= item.min_stock ? 'bg-ios-red/10 text-ios-red' : 'bg-ios-blue/10 text-ios-blue'
                                        }`}>
                                        {item.current_stock <= item.min_stock ? <AlertTriangle className="h-5 w-5" /> : <Archive className="h-5 w-5" />}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-ios-gray-900">{item.name}</h3>
                                        <p className="text-sm text-ios-gray-500">SKU: {item.sku || 'N/A'} • Min: {item.min_stock} {item.unit}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <p className={`font-bold text-lg ${item.current_stock <= item.min_stock ? 'text-ios-red' : 'text-ios-gray-900'}`}>
                                            {item.current_stock}
                                        </p>
                                        <p className="text-xs text-ios-gray-400 font-medium uppercase">{item.unit}</p>
                                    </div>

                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-ios-green hover:bg-ios-green/10"
                                            onClick={() => {
                                                setSelectedItem(item);
                                                setAdjustment({ ...adjustment, type: 'IN' });
                                                setIsAdjustOpen(true);
                                            }}
                                        >
                                            <ArrowUpRight className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-ios-red hover:bg-ios-red/10"
                                            onClick={() => {
                                                setSelectedItem(item);
                                                setAdjustment({ ...adjustment, type: 'OUT' });
                                                setIsAdjustOpen(true);
                                            }}
                                        >
                                            <ArrowDownRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Add Item Dialog */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nuevo Producto</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Nombre</Label>
                            <Input
                                value={newItem.name}
                                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                                placeholder="Ej. Guantes Latex M"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>SKU (Opcional)</Label>
                                <Input
                                    value={newItem.sku}
                                    onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Unidad</Label>
                                <Select
                                    value={newItem.unit}
                                    onValueChange={(val) => setNewItem({ ...newItem, unit: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="piezas">Piezas</SelectItem>
                                        <SelectItem value="cajas">Cajas</SelectItem>
                                        <SelectItem value="litros">Litros</SelectItem>
                                        <SelectItem value="ml">Mililitros</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Stock Inicial</Label>
                                <Input
                                    type="number"
                                    value={newItem.current_stock}
                                    onChange={(e) => setNewItem({ ...newItem, current_stock: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Stock Mínimo</Label>
                                <Input
                                    type="number"
                                    value={newItem.min_stock}
                                    onChange={(e) => setNewItem({ ...newItem, min_stock: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsAddOpen(false)} disabled={saving}>Cancelar</Button>
                        <Button onClick={handleCreateItem} className="bg-ios-blue text-white" disabled={saving}>
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            {saving ? 'Creando...' : 'Crear'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Adjust Stock Dialog */}
            <Dialog open={isAdjustOpen} onOpenChange={setIsAdjustOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {adjustment.type === 'IN' ? 'Entrada de Stock' : 'Salida de Stock'} - {selectedItem?.name}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Cantidad</Label>
                            <Input
                                type="number"
                                min="0" // Allow decimals
                                step="any"
                                value={adjustment.quantity}
                                onChange={(e) => setAdjustment({ ...adjustment, quantity: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Notas</Label>
                            <Input
                                value={adjustment.notes}
                                onChange={(e) => setAdjustment({ ...adjustment, notes: e.target.value })}
                                placeholder="Ej. Compra semanal / Uso en paciente"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsAdjustOpen(false)} disabled={saving}>Cancelar</Button>
                        <Button
                            onClick={handleAdjustment}
                            className={adjustment.type === 'IN' ? 'bg-ios-green text-white' : 'bg-ios-red text-white'}
                            disabled={saving}
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            {saving ? 'Guardando...' : `Confirmar ${adjustment.type === 'IN' ? 'Entrada' : 'Salida'}`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </MainLayout>
    );
};

export default Inventory;
