-- 20240210_odontogram_snapshots.sql

-- 1. Drop existing check constraint on snapshot_type
ALTER TABLE public.clinical_history_snapshots
DROP CONSTRAINT IF EXISTS clinical_history_snapshots_snapshot_type_check;

-- 2. Add new check constraint including 'odontogram'
ALTER TABLE public.clinical_history_snapshots
ADD CONSTRAINT clinical_history_snapshots_snapshot_type_check
CHECK (snapshot_type IN ('anamnesis', 'informed_consent', 'prescription', 'odontogram'));

-- 3. (Optional) Cleanup legacy table if it exists
DROP TABLE IF EXISTS public.odontogram_snapshots;
