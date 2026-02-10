-- 20240210_saas_architecture.sql

-- 1. Create Clinics Table (Tenants)
CREATE TABLE IF NOT EXISTS public.clinics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    subdomain TEXT UNIQUE, -- for white-labeling later
    plan TEXT DEFAULT 'basic',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Audit Logs Table (Immutable)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    changed_by UUID REFERENCES auth.users(id),
    clinic_id UUID REFERENCES public.clinics(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Secure Audit Logs: No updates or deletes allowed
REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View Audit Logs" ON public.audit_logs FOR SELECT USING (
    clinic_id = (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()) OR 
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- 3. Migration Logic: Add clinic_id to all major tables
DO $$
DECLARE
    v_default_clinic_id UUID;
    v_table text;
BEGIN
    -- Check if we have a default clinic, if not create one
    IF NOT EXISTS (SELECT 1 FROM clinics) THEN
        INSERT INTO clinics (name, plan) VALUES ('Clinica Principal', 'enterprise') RETURNING id INTO v_default_clinic_id;
    ELSE
        SELECT id INTO v_default_clinic_id FROM clinics LIMIT 1;
    END IF;

    -- Update Profiles linked to Auth Users
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'clinic_id') THEN
            ALTER TABLE profiles ADD COLUMN clinic_id UUID REFERENCES clinics(id);
            UPDATE profiles SET clinic_id = v_default_clinic_id WHERE clinic_id IS NULL;
        END IF;
    END IF;

    -- Add clinic_id to core tables and backfill
    FOREACH v_table IN ARRAY ARRAY['patients', 'appointments', 'treatments', 'payments', 'locations', 'doctors', 'budgets', 'budget_items']
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_table) THEN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = v_table AND column_name = 'clinic_id') THEN
                
                EXECUTE format('ALTER TABLE %I ADD COLUMN clinic_id UUID REFERENCES clinics(id)', v_table);
                
                -- Backfill existing data
                EXECUTE format('UPDATE %I SET clinic_id = $1 WHERE clinic_id IS NULL', v_table) USING v_default_clinic_id;
                
                -- Make nullable for now to avoid locking issues, but ideally should be NOT NULL
                -- EXECUTE format('ALTER TABLE %I ALTER COLUMN clinic_id SET NOT NULL', v_table);
                
                -- Add Index for RLS performance
                EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_clinic_id ON %I(clinic_id)', v_table, v_table);
            END IF;
            
            -- Enable RLS
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', v_table);
            
            -- Drop existing permissive policies (if any generic ones exist)
            -- Note: We are not dropping specific named policies to avoid errors, removing "allow all" if exists would be good manual step.
            
            -- Create RLS Policy for Tenant Isolation
            EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation Select" ON %I', v_table);
            EXECUTE format('CREATE POLICY "Tenant Isolation Select" ON %I FOR SELECT USING (clinic_id = (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))', v_table);
            
            EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation Insert" ON %I', v_table);
            EXECUTE format('CREATE POLICY "Tenant Isolation Insert" ON %I FOR INSERT WITH CHECK (clinic_id = (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))', v_table);
            
            EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation Update" ON %I', v_table);
            EXECUTE format('CREATE POLICY "Tenant Isolation Update" ON %I FOR UPDATE USING (clinic_id = (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))', v_table);
            
            EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation Delete" ON %I', v_table);
            EXECUTE format('CREATE POLICY "Tenant Isolation Delete" ON %I FOR DELETE USING (clinic_id = (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))', v_table);

        END IF;
    END LOOP;
END $$;


-- 4. Trigger Function for Auditing
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    v_clinic_id UUID;
BEGIN
    -- Try to get clinic_id from the record itself or fallback to user's clinic
    IF TG_OP = 'DELETE' THEN
        v_clinic_id := OLD.clinic_id;
    ELSE
        v_clinic_id := NEW.clinic_id;
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
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        to_jsonb(OLD),
        to_jsonb(NEW),
        auth.uid(),
        v_clinic_id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach Audit Triggers to Critical Tables
DROP TRIGGER IF EXISTS audit_patients ON patients;
CREATE TRIGGER audit_patients
AFTER INSERT OR UPDATE OR DELETE ON patients
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_appointments ON appointments;
CREATE TRIGGER audit_appointments
AFTER INSERT OR UPDATE OR DELETE ON appointments
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();


-- 5. Auto-assign Clinic ID on Insert
CREATE OR REPLACE FUNCTION public.auto_set_clinic_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.clinic_id IS NULL THEN
        SELECT clinic_id INTO NEW.clinic_id
        FROM public.profiles
        WHERE id = auth.uid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply to all tenant tables
DO $$
DECLARE
    v_table text;
BEGIN
    FOREACH v_table IN ARRAY ARRAY['patients', 'appointments', 'treatments', 'payments', 'locations', 'doctors', 'budgets', 'budget_items']
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_table) THEN
            EXECUTE format('DROP TRIGGER IF EXISTS set_clinic_id_on_insert ON %I', v_table);
            EXECUTE format('CREATE TRIGGER set_clinic_id_on_insert BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION public.auto_set_clinic_id()', v_table);
        END IF;
    END LOOP;
END $$;

