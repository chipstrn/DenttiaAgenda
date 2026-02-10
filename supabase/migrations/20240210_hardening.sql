-- 20240210_hardening.sql

-- 0. AUDIT FUNCTION (Robust Version)
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    v_clinic_id UUID;
    v_old_json JSONB;
    v_new_json JSONB;
BEGIN
    v_old_json := to_jsonb(OLD);
    v_new_json := to_jsonb(NEW);

    IF TG_OP = 'DELETE' THEN
        v_clinic_id := (v_old_json->>'clinic_id')::uuid;
    ELSE
        v_clinic_id := (v_new_json->>'clinic_id')::uuid;
    END IF;

    INSERT INTO audit_logs (
        table_name,
        record_id,
        operation,
        old_data,
        new_data,
        changed_by,
        clinic_id
    ) VALUES (
        TG_TABLE_NAME,
        COALESCE((v_new_json->>'id')::uuid, (v_old_json->>'id')::uuid),
        TG_OP,
        v_old_json,
        v_new_json,
        auth.uid(),
        v_clinic_id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 1. CONCURRENCY: Prevent Overlapping Appointments
-- CONSTRAINT: A DOCTOR cannot have overlapping appointments.
-- Use doctor_id as the resource.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.appointments
ADD CONSTRAINT no_overlapping_appointments
EXCLUDE USING gist (
    doctor_id WITH =,
    tstzrange(start_time, end_time) WITH &&
) WHERE (status != 'cancelled');


-- 2. FINANCIAL AUDIT: Secure Payments
-- Attach trigger to payments table
DROP TRIGGER IF EXISTS audit_payments ON public.payments;
CREATE TRIGGER audit_payments
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();


-- 3. LEGAL INTEGRITY: Clinical History Snapshots
CREATE TABLE IF NOT EXISTS public.clinical_history_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    clinic_id UUID REFERENCES public.clinics(id),
    snapshot_data JSONB NOT NULL,
    snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('anamnesis', 'informed_consent', 'prescription')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.clinical_history_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant Select Snapshots" ON public.clinical_history_snapshots;
CREATE POLICY "Tenant Select Snapshots" ON public.clinical_history_snapshots
FOR SELECT USING (
    clinic_id = (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Tenant Insert Snapshots" ON public.clinical_history_snapshots;
CREATE POLICY "Tenant Insert Snapshots" ON public.clinical_history_snapshots
FOR INSERT WITH CHECK (
    clinic_id = (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
);


-- 4. RLS HARDENING: Fix potentially weak policies on Budgets
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.budgets;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.budgets;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.budgets;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.budgets;

DROP POLICY IF EXISTS "Tenant Isolation Select Budgets" ON public.budgets;
CREATE POLICY "Tenant Isolation Select Budgets" ON public.budgets
FOR SELECT USING (
    clinic_id = (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Tenant Isolation Insert Budgets" ON public.budgets;
CREATE POLICY "Tenant Isolation Insert Budgets" ON public.budgets
FOR INSERT WITH CHECK (
    clinic_id = (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Tenant Isolation Update Budgets" ON public.budgets;
CREATE POLICY "Tenant Isolation Update Budgets" ON public.budgets
FOR UPDATE USING (
    clinic_id = (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Tenant Isolation Delete Budgets" ON public.budgets;
CREATE POLICY "Tenant Isolation Delete Budgets" ON public.budgets
FOR DELETE USING (
    clinic_id = (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
);
