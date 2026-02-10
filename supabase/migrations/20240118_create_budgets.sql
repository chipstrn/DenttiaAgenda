-- Create budgets table
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    discount_percentage DECIMAL(5, 2) DEFAULT 0,
    final_total DECIMAL(10, 2) NOT NULL DEFAULT 0,
    sessions_count INTEGER DEFAULT 1,
    notes TEXT,
    status TEXT CHECK (status IN ('draft', 'accepted', 'rejected', 'completed')) DEFAULT 'draft',
    payment_terms TEXT DEFAULT 'cash',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create budget_items table
CREATE TABLE IF NOT EXISTS public.budget_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    budget_id UUID REFERENCES public.budgets(id) ON DELETE CASCADE NOT NULL,
    treatment_id UUID REFERENCES public.treatments(id) ON DELETE SET NULL,
    tooth_number TEXT,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    quantity INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;

-- Policies for budgets
CREATE POLICY "Enable read access for authenticated users" ON public.budgets
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON public.budgets
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON public.budgets
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users" ON public.budgets
    FOR DELETE USING (auth.role() = 'authenticated');

-- Policies for budget_items
CREATE POLICY "Enable read access for authenticated users" ON public.budget_items
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON public.budget_items
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON public.budget_items
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users" ON public.budget_items
    FOR DELETE USING (auth.role() = 'authenticated');
