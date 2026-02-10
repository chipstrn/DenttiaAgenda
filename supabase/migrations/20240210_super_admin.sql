-- 20240210_super_admin.sql

-- 1. Schema Changes
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'basic';
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS users_limit INTEGER DEFAULT 5;

-- 2. Helper Function for Super Admin Check (Security Definer to bypass RLS recursion)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_super_admin = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RLS for 'clinics' table
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super Admin Full Access on Clinics" ON public.clinics
    FOR ALL
    USING (public.is_super_admin());

CREATE POLICY "Users view own clinic" ON public.clinics
    FOR SELECT
    USING (
        id = (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
    );

-- 4. Update RLS policies for all Tenant Tables to include Super Admin bypass & Kill Switch
DO $$
DECLARE
    v_table text;
BEGIN
    FOREACH v_table IN ARRAY ARRAY['patients', 'appointments', 'treatments', 'payments', 'locations', 'doctors', 'budgets', 'budget_items', 'clinical_history_snapshots']
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_table) THEN
            
            -- Drop existing policies
            EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation Select" ON %I', v_table);
            EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation Insert" ON %I', v_table);
            EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation Update" ON %I', v_table);
            EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation Delete" ON %I', v_table);

            -- Create new policies with Super Admin bypass AND Active Clinic restriction
            
            -- SELECT: Super Admin OR (Same Clinic AND Clinic Active)
            EXECUTE format('CREATE POLICY "Tenant Isolation Select" ON %I FOR SELECT USING (
                public.is_super_admin() OR 
                (
                    clinic_id = (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
                    AND EXISTS (SELECT 1 FROM public.clinics WHERE id = clinic_id AND active = true)
                )
            )', v_table);

            -- INSERT: Super Admin OR (Same Clinic AND Clinic Active)
            EXECUTE format('CREATE POLICY "Tenant Isolation Insert" ON %I FOR INSERT WITH CHECK (
                public.is_super_admin() OR 
                (
                    clinic_id = (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
                    AND EXISTS (SELECT 1 FROM public.clinics WHERE id = clinic_id AND active = true)
                )
            )', v_table);

            -- UPDATE: Super Admin OR (Same Clinic AND Clinic Active)
            EXECUTE format('CREATE POLICY "Tenant Isolation Update" ON %I FOR UPDATE USING (
                public.is_super_admin() OR 
                (
                    clinic_id = (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
                    AND EXISTS (SELECT 1 FROM public.clinics WHERE id = clinic_id AND active = true)
                )
            )', v_table);

            -- DELETE: Super Admin OR (Same Clinic AND Clinic Active)
            EXECUTE format('CREATE POLICY "Tenant Isolation Delete" ON %I FOR DELETE USING (
                public.is_super_admin() OR 
                (
                    clinic_id = (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
                    AND EXISTS (SELECT 1 FROM public.clinics WHERE id = clinic_id AND active = true)
                )
            )', v_table);

        END IF;
    END LOOP;
END $$;

-- 5. Update Policies for Profiles (allow Super Admin to see all)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile OR Super Admin" ON public.profiles
    FOR SELECT
    USING (
        auth.uid() = id OR public.is_super_admin()
    );

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile OR Super Admin" ON public.profiles
    FOR UPDATE
    USING (
        auth.uid() = id OR public.is_super_admin()
    );
