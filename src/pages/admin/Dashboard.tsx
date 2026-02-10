"use client";

import React, { useEffect, useState } from 'react';
import AdminLayout from '@/layouts/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import {
    Building,
    Users,
    Activity,
    Power,
    Search,
    Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface Clinic {
    id: string;
    name: string;
    plan: string;
    active: boolean;
    users_limit: number;
    created_at: string;
    users_count?: number; // Calculated on client for now or via RPC
}

const Dashboard = () => {
    const [clinics, setClinics] = useState<Clinic[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createdCredentials, setCreatedCredentials] = useState<{ email: string, password: string } | null>(null);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

    // New Clinic Form State
    const [newClinicName, setNewClinicName] = useState('');
    const [adminEmail, setAdminEmail] = useState('');
    const [adminName, setAdminName] = useState('');
    const [selectedPlan, setSelectedPlan] = useState('basic');

    const fetchClinics = async () => {
        setLoading(true);
        try {
            // 1. Fetch clinics
            const { data: clinicsData, error: clinicsError } = await supabase
                .from('clinics')
                .select('*')
                .order('created_at', { ascending: false });

            if (clinicsError) throw clinicsError;

            // 2. Fetch user counts (naive approach for MVP, better via RPC)
            // Since Super Admin can see profiles, we can group by clinic_id
            const { data: profilesData, error: profilesError } = await supabase
                .from('profiles')
                .select('clinic_id');

            if (profilesError) throw profilesError;

            const userCounts: Record<string, number> = {};
            profilesData.forEach(p => {
                if (p.clinic_id) {
                    userCounts[p.clinic_id] = (userCounts[p.clinic_id] || 0) + 1;
                }
            });

            const clinicsWithCounts = clinicsData.map(clinic => ({
                ...clinic,
                users_count: userCounts[clinic.id] || 0
            }));

            setClinics(clinicsWithCounts);
        } catch (error) {
            console.error('Error fetching clinics:', error);
            toast.error('Error al cargar clínicas');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClinics();
    }, []);

    const handleToggleActive = async (clinicId: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('clinics')
                .update({ active: !currentStatus })
                .eq('id', clinicId);

            if (error) throw error;

            setClinics(clinics.map(c =>
                c.id === clinicId ? { ...c, active: !currentStatus } : c
            ));

            toast.success(`Clínica ${!currentStatus ? 'activada' : 'suspendida'} exitosamente`);
        } catch (error) {
            console.error('Error toggling clinic:', error);
            toast.error('Error al actualizar estado');
        }
    };

    const handleCreateClinic = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('create-clinic', {
                body: {
                    name: newClinicName,
                    adminEmail,
                    adminName,
                    plan: selectedPlan
                }
            });

            if (error) throw error;
            if (!data.success) throw new Error(data.error || 'Error desconocido');

            toast.success('Clínica creada exitosamente');
            setIsCreateModalOpen(false);

            // Show credentials
            setCreatedCredentials({
                email: adminEmail,
                password: data.tempPassword
            });
            setIsSuccessModalOpen(true);

            // Reset form
            setNewClinicName('');
            setAdminEmail('');
            setAdminName('');
            setSelectedPlan('basic');

            fetchClinics();
        } catch (error: any) {
            console.error('Error creating clinic:', error);
            toast.error('Error al crear clínica: ' + (error.message || error.error || 'Error interno'));
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Copiado al portapapeles');
    };

    const filteredClinics = clinics.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const stats = {
        total: clinics.length,
        active: clinics.filter(c => c.active).length,
        totalUsers: clinics.reduce((acc, curr) => acc + (curr.users_count || 0), 0)
    };

    return (
        <AdminLayout>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-ios-gray-900 tracking-tight">Dashboard SaaS</h1>
                <p className="text-ios-gray-500 mt-1">Gestión general de clínicas y suscripciones</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-ios-sm border border-ios-gray-200/50">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-ios-blue/10 flex items-center justify-center">
                            <Building className="h-6 w-6 text-ios-blue" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-ios-gray-500">Total Clínicas</p>
                            <h3 className="text-2xl font-bold text-ios-gray-900">{stats.total}</h3>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-ios-sm border border-ios-gray-200/50">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-ios-green/10 flex items-center justify-center">
                            <Activity className="h-6 w-6 text-ios-green" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-ios-gray-500">Clínicas Activas</p>
                            <h3 className="text-2xl font-bold text-ios-gray-900">{stats.active}</h3>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-ios-sm border border-ios-gray-200/50">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-ios-purple/10 flex items-center justify-center">
                            <Users className="h-6 w-6 text-ios-purple" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-ios-gray-500">Total Usuarios</p>
                            <h3 className="text-2xl font-bold text-ios-gray-900">{stats.totalUsers}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions & Filters */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ios-gray-400" />
                    <Input
                        placeholder="Buscar clínica..."
                        className="pl-10 h-11 bg-white border-ios-gray-200/50"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-ios-blue hover:bg-ios-blue/90 text-white h-11 px-6 rounded-xl shadow-ios-sm">
                            <Plus className="h-5 w-5 mr-2" />
                            Nueva Clínica
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px] rounded-2xl">
                        <DialogHeader>
                            <DialogTitle>Dar de alta Nueva Clínica</DialogTitle>
                            <DialogDescription>
                                Crea una nueva instancia de clínica y su primer administrador.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateClinic} className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Nombre de la Clínica</Label>
                                <Input
                                    placeholder="Ej. Clínica Dental Sonrisas"
                                    required
                                    value={newClinicName}
                                    onChange={(e) => setNewClinicName(e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Nombre del Admin</Label>
                                    <Input
                                        placeholder="Dr. Juan Pérez"
                                        required
                                        value={adminName}
                                        onChange={(e) => setAdminName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Plan</Label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={selectedPlan}
                                        onChange={(e) => setSelectedPlan(e.target.value)}
                                    >
                                        <option value="basic">Básico</option>
                                        <option value="pro">Pro</option>
                                        <option value="enterprise">Enterprise</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Email del Admin (Invitación)</Label>
                                <Input
                                    type="email"
                                    placeholder="admin@clinica.com"
                                    required
                                    value={adminEmail}
                                    onChange={(e) => setAdminEmail(e.target.value)}
                                />
                            </div>
                            <DialogFooter>
                                <Button type="submit" className="bg-ios-blue text-white">Crear Clínica</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Clinics Table */}
            <div className="bg-white rounded-2xl shadow-ios-sm border border-ios-gray-200/50 overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent border-b border-ios-gray-100">
                            <TableHead className="w-[300px]">Clínica</TableHead>
                            <TableHead>Plan</TableHead>
                            <TableHead>Usuarios</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-ios-gray-500">Cargando datos...</TableCell>
                            </TableRow>
                        ) : filteredClinics.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-ios-gray-500">No se encontraron clínicas</TableCell>
                            </TableRow>
                        ) : (
                            filteredClinics.map((clinic) => (
                                <TableRow key={clinic.id} className="hover:bg-ios-gray-50 border-b border-ios-gray-100/50 last:border-0">
                                    <TableCell className="font-medium text-ios-gray-900">
                                        {clinic.name}
                                        <div className="text-xs text-ios-gray-400 font-normal mt-0.5">ID: {clinic.id}</div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="uppercase text-[10px] tracking-wider font-semibold bg-ios-gray-100 text-ios-gray-600">
                                            {clinic.plan}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-ios-gray-600">
                                        {clinic.users_count} / {clinic.users_limit}
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={cn(
                                            "uppercase text-[10px] tracking-wider font-semibold shadow-none border-0",
                                            clinic.active ? "bg-ios-green/15 text-ios-green hover:bg-ios-green/20" : "bg-ios-red/15 text-ios-red hover:bg-ios-red/20"
                                        )}>
                                            {clinic.active ? 'Activa' : 'Suspendida'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <div className="flex items-center space-x-2">
                                                <Label htmlFor={`switch-${clinic.id}`} className="text-xs text-ios-gray-400">
                                                    {clinic.active ? 'Suspender' : 'Activar'}
                                                </Label>
                                                <Switch
                                                    id={`switch-${clinic.id}`}
                                                    checked={clinic.active}
                                                    onCheckedChange={() => handleToggleActive(clinic.id, clinic.active)}
                                                    className="data-[state=checked]:bg-ios-green data-[state=unchecked]:bg-ios-red"
                                                />
                                            </div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </AdminLayout>
    );
};

export default Dashboard;
