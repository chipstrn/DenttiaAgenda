-- 20240210_hardening.sql

-- 1. CONCURRENCY: Prevent Overlapping Appointments
-- Requires btree_gist for mixing scalar (chair_id) and range (tstzrange) types in EXCLUDE
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Clean up any invalid overlapping data before applying constraint (optional safety, implementation dependent)
-- For now, we assume data is clean or the constraint creation will fail (which is good, meaningful error).

ALTER TABLE public.appointments
ADD CONSTRAINT no_overlapping_appointments
EXCLUDE USING gist (
    chair_id WITH =,
    tstzrange(start_time, end_time) WITH &&
) WHERE (status != 'cancelled');


-- 2. FINANCIAL AUDIT: Secure Payments
-- Ensure we have the audit function (from saas_architecture.sql)
-- Attach trigger to payments table
DROP TRIGGER IF EXISTS audit_payments ON public.payments;
CREATE TRIGGER audit_payments
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();


-- 3. LEGAL INTEGRITY: Clinical History Snapshots
CREATE TABLE IF NOT EXISTS public.clinical_history_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    clinic_id UUID REFERENCES public.clinics(id), -- Tenant isolation
    snapshot_data JSONB NOT NULL, -- Full JSON content of the PDF source data
    snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('anamnesis', 'informed_consent', 'prescription')),
    metadata JSONB DEFAULT '{}'::jsonb, -- Store version, signer info, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

-- RLS for Snapshots
ALTER TABLE public.clinical_history_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Select Snapshots" ON public.clinical_history_snapshots
FOR SELECT USING (
    clinic_id = (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Tenant Insert Snapshots" ON public.clinical_history_snapshots
FOR INSERT WITH CHECK (
    clinic_id = (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
);
-- Snapshots are IMMUTABLE. No Update/Delete policies for standard users.


-- 4. RLS HARDENING: Fix potentially weak policies on Budgets
-- Refine Budgets policies to be strict Tenant-based, just in case
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.budgets;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.budgets;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.budgets;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.budgets;

CREATE POLICY "Tenant Isolation Select Budgets" ON public.budgets
FOR SELECT USING (
    clinic_id = (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Tenant Isolation Insert Budgets" ON public.budgets
FOR INSERT WITH CHECK (
    clinic_id = (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Tenant Isolation Update Budgets" ON public.budgets
FOR UPDATE USING (
    clinic_id = (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Tenant Isolation Delete Budgets" ON public.budgets
FOR DELETE USING (
    clinic_id = (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
);
