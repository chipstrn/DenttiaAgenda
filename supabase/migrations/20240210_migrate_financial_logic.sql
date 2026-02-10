-- 20240210_migrate_financial_logic.sql
-- Migration to move financial logic (Payment creation & Commission calculation) to Backend Trigger

CREATE OR REPLACE FUNCTION handle_appointment_completion()
RETURNS TRIGGER AS $$
DECLARE
    v_treatment_price DECIMAL(10, 2) := 0;
    v_commission_amount DECIMAL(10, 2) := 0;
    v_commission_percentage DECIMAL(5, 2) := 0;
    v_commission_type TEXT;
    v_treatment_record RECORD;
    v_doctor_settings_record RECORD;
BEGIN
    -- Only proceed if status changed to 'completed'
    -- We use IS DISTINCT FROM to handle nulls safely, though status should rarely be null
    IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
        
        -- 1. Get Treatment details and Price
        -- Try to match by treatment_type (UUID) first
        IF NEW.treatment_type IS NOT NULL THEN
             SELECT * INTO v_treatment_record FROM treatments WHERE id = NEW.treatment_type;
        END IF;

        -- If found, set price. If not found (or treatment_type null), try fallback by title
        IF v_treatment_record.id IS NOT NULL THEN
            v_treatment_price := COALESCE(v_treatment_record.base_price, 0);
        ELSE
            -- Frontend fallback logic matches by title. We replicate this but it's fragile.
            -- Ideally we should enforce treatment_type.
            SELECT * INTO v_treatment_record FROM treatments WHERE name = NEW.title LIMIT 1;
            IF FOUND THEN
                v_treatment_price := COALESCE(v_treatment_record.base_price, 0);
            END IF;
        END IF;

        -- 2. Create Payment Record (Pending Collection)
        -- Check if specific payment for this appointment already exists to avoid duplicates
        IF NOT EXISTS (SELECT 1 FROM payments WHERE appointment_id = NEW.id) THEN
            INSERT INTO payments (
                appointment_id,
                amount,
                status,
                patient_id,
                created_at,
                description,
                payment_method -- Defaulting to 'cash' or null? Schema usually allows null for pending.
            ) VALUES (
                NEW.id,
                v_treatment_price,
                'pending',
                NEW.patient_id,
                NOW(),
                'Consulta / Tratamiento: ' || COALESCE(v_treatment_record.name, NEW.title),
                'cash' -- Default, can be changed during collection
            );
        END IF;

        -- 3. Calculate Commission
        IF NEW.doctor_id IS NOT NULL THEN
            v_commission_amount := 0;
            
            -- Check Treatment specific commission
            IF v_treatment_record.id IS NOT NULL AND v_treatment_record.commission_percentage > 0 THEN
                v_commission_type := COALESCE(v_treatment_record.commission_type, 'percent');
                
                IF v_commission_type = 'fixed' THEN
                    v_commission_amount := v_treatment_record.commission_percentage;
                ELSE
                    v_commission_amount := (v_treatment_price * v_treatment_record.commission_percentage) / 100;
                END IF;
            ELSE
                -- Fallback to Doctor Global Settings
                SELECT percentage INTO v_commission_percentage 
                FROM commission_settings 
                WHERE doctor_id = NEW.doctor_id;
                
                IF FOUND AND v_commission_percentage > 0 THEN
                    v_commission_amount := (v_treatment_price * v_commission_percentage) / 100;
                END IF;
            END IF;

            -- Insert Commission if amount > 0
            IF v_commission_amount > 0 THEN
                IF NOT EXISTS (SELECT 1 FROM doctor_commissions WHERE appointment_id = NEW.id) THEN
                    INSERT INTO doctor_commissions (
                        doctor_id,
                        appointment_id,
                        amount,
                        status,
                        created_at
                    ) VALUES (
                        NEW.doctor_id,
                        NEW.id,
                        v_commission_amount,
                        'pending',
                        NOW()
                    );
                END IF;
            END IF;
        END IF;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_appointment_complete ON appointments;

CREATE TRIGGER on_appointment_complete
AFTER UPDATE OF status ON appointments
FOR EACH ROW
EXECUTE FUNCTION handle_appointment_completion();
