import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Package, AlertTriangle, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

interface StatsCard {
    title: string;
    value: string | number;
    icon: React.ElementType;
    color: string;
    trend?: {
        value: number;
        direction: 'up' | 'down';
    };
}

interface InventoryItem {
    id: string;
    name: string;
    current_stock: number;
    minimum_stock: number;
    unit_price: number;
    category: string;
}

interface StockMovement {
    id: string;
    movement_type: 'entry' | 'exit' | 'adjustment';
    quantity: number;
    created_at: string;
    inventory_items: {
        name: string;
    };
}

export default function InventoryDashboard() {
    const [stats, setStats] = useState({
        totalItems: 0,
        totalValue: 0,
        lowStock: 0,
        outOfStock: 0,
    });

    // Fetch inventory items
    const { data: items = [], isLoading } = useQuery({
        queryKey: ['inventory-items'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('inventory_items')
                .select('*')
                .eq('active', true)
                .order('name');

            if (error) throw error;
            return data as InventoryItem[];
        },
    });

    // Fetch recent stock movements
    const { data: recentMovements = [] } = useQuery({
        queryKey: ['recent-stock-movements'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('stock_movements')
                .select(`
          id,
          movement_type,
          quantity,
          created_at,
          inventory_items (name)
        `)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;
            return data as StockMovement[];
        },
    });

    // Calculate stats from items
    useEffect(() => {
        if (items.length > 0) {
            const totalItems = items.length;
            const totalValue = items.reduce((sum, item) => sum + (item.current_stock * item.unit_price), 0);
            const lowStock = items.filter(item => item.current_stock > 0 && item.current_stock <= item.minimum_stock).length;
            const outOfStock = items.filter(item => item.current_stock === 0).length;

            setStats({
                totalItems,
                totalValue,
                lowStock,
                outOfStock,
            });
        }
    }, [items]);

    // Real-time subscription for inventory updates
    useEffect(() => {
        const channel = supabase
            .channel('inventory-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'inventory_items',
                },
                () => {
                    // Refetch data on changes
                    toast.info('Inventario actualizado');
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const statsCards: StatsCard[] = [
        {
            title: 'Total de Items',
            value: stats.totalItems,
            icon: Package,
            color: 'bg-ios-blue',
        },
        {
            title: 'Valor del Inventario',
            value: `$${stats.totalValue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
            icon: DollarSign,
            color: 'bg-ios-green',
        },
        {
            title: 'Stock Bajo',
            value: stats.lowStock,
            icon: AlertTriangle,
            color: 'bg-ios-orange',
        },
        {
            title: 'Sin Stock',
            value: stats.outOfStock,
            icon: TrendingDown,
            color: 'bg-ios-red',
        },
    ];

    // Group items by category for breakdown
    const categoryBreakdown = items.reduce((acc, item) => {
        const category = item.category || 'Sin categoría';
        if (!acc[category]) {
            acc[category] = { count: 0, value: 0 };
        }
        acc[category].count += 1;
        acc[category].value += item.current_stock * item.unit_price;
        return acc;
    }, {} as Record<string, { count: number; value: number }>);

    const lowStockItems = items.filter(
        item => item.current_stock > 0 && item.current_stock <= item.minimum_stock
    );

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
                    <h1 className="text-2xl font-bold text-gray-900">Dashboard de Inventario</h1>
                    <p className="text-gray-500 mt-1">Vista general del estado del inventario</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {statsCards.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                        <div key={index} className="ios-card p-6">
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <p className="text-sm text-gray-500 font-medium">{stat.title}</p>
                                    <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
                                </div>
                                <div className={`${stat.color} p-3 rounded-xl`}>
                                    <Icon className="h-6 w-6 text-white" />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Low Stock Alerts */}
            {lowStockItems.length > 0 && (
                <div className="ios-card p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle className="h-5 w-5 text-ios-orange" />
                        <h2 className="text-lg font-semibold text-gray-900">Alertas de Stock Bajo</h2>
                    </div>
                    <div className="space-y-3">
                        {lowStockItems.slice(0, 5).map(item => (
                            <div key={item.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                                <div className="flex-1">
                                    <p className="font-medium text-gray-900">{item.name}</p>
                                    <p className="text-sm text-gray-500">{item.category}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-semibold text-ios-orange">
                                        {item.current_stock} / {item.minimum_stock}
                                    </p>
                                    <p className="text-xs text-gray-500">Stock actual / mínimo</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Category Breakdown */}
                <div className="ios-card p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Distribución por Categoría</h2>
                    <div className="space-y-3">
                        {Object.entries(categoryBreakdown).map(([category, data]) => (
                            <div key={category} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex-1">
                                    <p className="font-medium text-gray-900">{category}</p>
                                    <p className="text-sm text-gray-500">{data.count} items</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-semibold text-gray-900">
                                        ${data.value.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent Movements */}
                <div className="ios-card p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Movimientos Recientes</h2>
                    <div className="space-y-3">
                        {recentMovements.map(movement => {
                            const isEntry = movement.movement_type === 'entry';
                            const Icon = isEntry ? TrendingUp : TrendingDown;
                            const colorClass = isEntry ? 'text-ios-green' : 'text-ios-red';

                            return (
                                <div key={movement.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-3 flex-1">
                                        <Icon className={`h-5 w-5 ${colorClass}`} />
                                        <div>
                                            <p className="font-medium text-gray-900">{movement.inventory_items.name}</p>
                                            <p className="text-xs text-gray-500">
                                                {new Date(movement.created_at).toLocaleDateString('es-MX', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-semibold ${colorClass}`}>
                                            {isEntry ? '+' : '-'}{Math.abs(movement.quantity)}
                                        </p>
                                        <p className="text-xs text-gray-500 capitalize">{movement.movement_type}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
