"use client";

import React, { useState, useCallback } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, Check, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

type ImportType = 'patients' | 'inventory';

interface ColumnMapping {
    fileColumn: string;
    dbColumn: string;
}

const DB_COLUMNS: Record<ImportType, { key: string; label: string; required: boolean }[]> = {
    patients: [
        { key: 'first_name', label: 'Nombre', required: true },
        { key: 'last_name', label: 'Apellido', required: true },
        { key: 'email', label: 'Email', required: false },
        { key: 'phone', label: 'Teléfono', required: false },
        { key: 'notes', label: 'Notas', required: false },
    ],
    inventory: [
        { key: 'name', label: 'Nombre del Producto', required: true },
        { key: 'sku', label: 'SKU / Código', required: false },
        { key: 'current_stock', label: 'Stock Actual', required: true },
        { key: 'min_stock', label: 'Stock Mínimo', required: false },
        { key: 'cost', label: 'Costo Unitario', required: false },
        { key: 'unit', label: 'Unidad (pza, caja, etc)', required: false },
    ]
};

const ImportWizard = () => {
    const { user } = useAuth();
    const [importType, setImportType] = useState<ImportType>('patients');
    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [fileColumns, setFileColumns] = useState<string[]>([]);
    const [mappings, setMappings] = useState<Record<string, string>>({});
    const [step, setStep] = useState(1); // 1: Upload, 2: Map, 3: Review/Import
    const [importing, setImporting] = useState(false);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);

            if (data.length > 0) {
                setPreviewData(data.slice(0, 5));
                setFileColumns(Object.keys(data[0] as object));
                setStep(2);
            } else {
                toast.error('El archivo parece estar vacío');
            }
        };
        reader.readAsBinaryString(selectedFile);
    };

    const handleMappingChange = (dbCol: string, fileCol: string) => {
        setMappings(prev => ({ ...prev, [dbCol]: fileCol }));
    };

    const executeImport = async () => {
        if (!user?.id) return;
        setImporting(true);

        try {
            // Re-read full file to get all rows
            const reader = new FileReader();
            reader.onload = async (evt) => {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const allData = XLSX.utils.sheet_to_json(ws);

                const formattedData = allData.map((row: any) => {
                    const newRow: any = {
                        // clinic_id is handled by RLS or default constraints usually, but let's be safe if needed
                        // For now assuming RLS handles 'clinic_id' insertion based on user's context
                        // or we need to fetch it.
                        // Ideally the backend/RLS handles the tenant ID.
                    };

                    // Map fields
                    Object.entries(mappings).forEach(([dbKey, fileKey]) => {
                        if (fileKey && row[fileKey] !== undefined) {
                            let value = row[fileKey];
                            // Basic type conversion
                            if (importType === 'inventory' && (dbKey === 'current_stock' || dbKey === 'min_stock' || dbKey === 'cost')) {
                                value = Number(value) || 0;
                            }
                            newRow[dbKey] = value;
                        }
                    });
                    return newRow;
                });

                // Batch insert
                const tableName = importType === 'patients' ? 'patients' : 'inventory_items';

                // Chunking for large files
                const chunkSize = 100;
                for (let i = 0; i < formattedData.length; i += chunkSize) {
                    const chunk = formattedData.slice(i, i + chunkSize);
                    const { error } = await supabase.from(tableName).insert(chunk);
                    if (error) throw error;
                }

                toast.success(`${formattedData.length} registros importados exitosamente`);
                setStep(1);
                setFile(null);
                setPreviewData([]);
                setMappings({});
                setImporting(false);
            };
            if (file) reader.readAsBinaryString(file);

        } catch (error: any) {
            console.error('Import error:', error);
            toast.error(`Error en la importación: ${error.message || 'Error desconocido'}`);
            setImporting(false);
        }
    };

    return (
        <MainLayout>
            <div className="max-w-4xl mx-auto animate-fade-in">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-ios-gray-900 tracking-tight">Asistente de Importación</h1>
                    <p className="text-ios-gray-500 mt-1 font-medium">Importa pacientes o inventario masivamente desde Excel o CSV</p>
                </div>

                {/* Steps Indicator */}
                <div className="flex items-center justify-between mb-8 px-4">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className="flex flex-col items-center relative z-10">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors duration-300 ${step >= s ? 'bg-ios-pink text-white' : 'bg-ios-gray-200 text-ios-gray-500'
                                }`}>
                                {step > s ? <Check className="w-5 h-5" /> : s}
                            </div>
                            <span className="text-xs mt-2 text-ios-gray-500 font-medium">
                                {s === 1 ? 'Subir' : s === 2 ? 'Mapear' : 'Importar'}
                            </span>
                        </div>
                    ))}
                    <div className="absolute left-0 right-0 top-4 h-0.5 bg-ios-gray-200 -z-0 mx-8 max-w-4xl translate-y-10" />
                </div>

                <div className="ios-card p-8">
                    {step === 1 && (
                        <div className="space-y-6 animate-slide-up">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-ios-gray-900">Tipo de Importación</label>
                                <Select value={importType} onValueChange={(v: ImportType) => setImportType(v)}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="patients">Pacientes</SelectItem>
                                        <SelectItem value="inventory">Inventario</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="border-2 border-dashed border-ios-gray-200 rounded-2xl p-10 text-center hover:border-ios-pink/50 transition-colors cursor-pointer bg-ios-gray-50/50">
                                <input
                                    type="file"
                                    accept=".xlsx, .xls, .csv"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                    id="file-upload"
                                />
                                <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                                    <FileSpreadsheet className="w-12 h-12 text-ios-pink mb-4" />
                                    <span className="text-lg font-semibold text-ios-gray-900">Suelta tu archivo aquí</span>
                                    <span className="text-sm text-ios-gray-500 mt-1">o haz clic para seleccionar (.xlsx, .csv)</span>
                                </label>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 animate-slide-up">
                            <h3 className="text-lg font-semibold text-ios-gray-900">Mapeo de Columnas</h3>
                            <p className="text-sm text-ios-gray-500">Relaciona las columnas de tu archivo con los campos del sistema.</p>

                            <div className="grid gap-4">
                                {DB_COLUMNS[importType].map((col) => (
                                    <div key={col.key} className="grid grid-cols-2 gap-4 items-center p-3 bg-ios-gray-50 rounded-xl">
                                        <div>
                                            <p className="font-medium text-ios-gray-900 flex items-center gap-2">
                                                {col.label}
                                                {col.required && <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Requerido</span>}
                                            </p>
                                            <p className="text-xs text-ios-gray-400 font-mono mt-0.5">{col.key}</p>
                                        </div>
                                        <Select
                                            value={mappings[col.key] || ''}
                                            onValueChange={(val) => handleMappingChange(col.key, val)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccionar columna..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {fileColumns.map((c) => (
                                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-between pt-4">
                                <button
                                    onClick={() => setStep(1)}
                                    className="text-ios-gray-500 hover:text-ios-gray-900 font-medium px-4"
                                >
                                    Atrás
                                </button>
                                <button
                                    onClick={() => setStep(3)}
                                    disabled={DB_COLUMNS[importType].some(c => c.required && !mappings[c.key])}
                                    className="h-10 px-6 rounded-xl bg-ios-pink text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-ios-pink/90 transition-all flex items-center gap-2"
                                >
                                    Continuar
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6 animate-slide-up">
                            <h3 className="text-lg font-semibold text-ios-gray-900">Vista Previa y Confirmación</h3>

                            <div className="bg-ios-gray-50 rounded-xl p-4 overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead>
                                        <tr className="border-b border-ios-gray-200">
                                            {Object.keys(mappings).map(key => (
                                                <th key={key} className="py-2 px-3 font-semibold text-ios-gray-700">
                                                    {DB_COLUMNS[importType].find(c => c.key === key)?.label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewData.map((row, i) => (
                                            <tr key={i} className="border-b border-ios-gray-100 last:border-0">
                                                {Object.entries(mappings).map(([dbKey, fileCol]) => (
                                                    <td key={dbKey} className="py-2 px-3 text-ios-gray-600">
                                                        {row[fileCol]}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <p className="text-xs text-ios-gray-400 mt-2 text-center">Mostrando primeros 5 registros</p>
                            </div>

                            <div className="flex justify-between pt-4">
                                <button
                                    onClick={() => setStep(2)}
                                    className="text-ios-gray-500 hover:text-ios-gray-900 font-medium px-4"
                                >
                                    Atrás
                                </button>
                                <button
                                    onClick={executeImport}
                                    disabled={importing}
                                    className="h-10 px-8 rounded-xl bg-ios-pink text-white font-semibold disabled:opacity-50 hover:bg-ios-pink/90 transition-all flex items-center gap-2"
                                >
                                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                    {importing ? 'Importando...' : 'Comenzar Importación'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </MainLayout>
    );
};

export default ImportWizard;
