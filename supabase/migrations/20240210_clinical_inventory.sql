-- 20240210_clinical_inventory.sql

-- 1. Odontogram Snapshots
-- Store the state of a patient's mouth at a specific point in time
CREATE TABLE IF NOT EXISTS public.odontogram_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES public.patients(id) NOT NULL,
    state JSONB NOT NULL, -- Full JSON state of the teeth
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    clinic_id UUID REFERENCES public.clinics(id)
);

-- RLS for Snapshots
ALTER TABLE public.odontogram_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Isolation Snapshots" ON public.odontogram_snapshots
    USING (clinic_id = (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));


-- 2. Inventory System
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT,
    description TEXT,
    current_stock INTEGER DEFAULT 0 NOT NULL,
    min_stock INTEGER DEFAULT 5, -- Low stock alert threshold
    cost DECIMAL(10, 2),
    unit TEXT DEFAULT 'pieza', -- e.g., 'caja', 'litro', 'unidad'
    clinic_id UUID REFERENCES public.clinics(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for Inventory
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Isolation Inventory" ON public.inventory_items
    USING (clinic_id = (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));


-- 3. Treatment Inventory Link
-- Defines what materials are consumed by a specific treatment type
CREATE TABLE IF NOT EXISTS public.treatment_inventory_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    treatment_type_id UUID REFERENCES public.treatments(id) ON DELETE CASCADE,
    inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    quantity_used INTEGER DEFAULT 1 NOT NULL,
    clinic_id UUID REFERENCES public.clinics(id),
    UNIQUE(treatment_type_id, inventory_item_id)
);

-- RLS for Usage Link
ALTER TABLE public.treatment_inventory_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Isolation Usage" ON public.treatment_inventory_usage
    USING (clinic_id = (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));


-- 4. Auto-Deduction Trigger
-- When an appointment is completed, find the treatment type, check usage, and deduct stock.
CREATE OR REPLACE FUNCTION public.deduct_inventory_on_completion()
RETURNS TRIGGER AS $$
DECLARE
    v_treatment_type_id UUID;
    v_usage RECORD;
BEGIN
    -- Only run on status change to 'completed'
    IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
        
        -- Determine the treatment type
        v_treatment_type_id := NEW.treatment_type;
        
        -- If no type is set, we can't deduct (fallback by name is too risky for inventory)
        IF v_treatment_type_id IS NOT NULL THEN
            
            -- Loop through all items used by this treatment
            FOR v_usage IN 
                SELECT inventory_item_id, quantity_used 
                FROM public.treatment_inventory_usage 
                WHERE treatment_type_id = v_treatment_type_id
            LOOP
                -- Deduct stock
                UPDATE public.inventory_items
                SET current_stock = current_stock - v_usage.quantity_used
                WHERE id = v_usage.inventory_item_id;
                
                -- Ideally, we'd log this deduction in an 'inventory_transactions' table for audit
                -- kept simple for now.
            END LOOP;
            
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to appointments
DROP TRIGGER IF EXISTS trigger_auto_inventory_deduction ON public.appointments;
CREATE TRIGGER trigger_auto_inventory_deduction
AFTER UPDATE OF status ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.deduct_inventory_on_completion();
