-- 20240210_wallet_triggers.sql

-- Trigger function to deduct from wallet balance when a payment is made using 'wallet' method
CREATE OR REPLACE FUNCTION public.deduct_wallet_on_payment()
RETURNS TRIGGER AS $$
DECLARE
    v_patient_id UUID;
    v_current_balance DECIMAL(10, 2);
    v_clinic_id UUID;
BEGIN
    -- Only proceed if payment method is 'wallet'
    IF NEW.method = 'wallet' THEN
        
        -- Get patient_id and clinic_id from the parent payment record
        SELECT patient_id, clinic_id INTO v_patient_id, v_clinic_id
        FROM public.payments
        WHERE id = NEW.payment_id;

        IF v_patient_id IS NULL THEN
            RAISE EXCEPTION 'Payment record not found or patient_id is null';
        END IF;

        -- Check current balance
        SELECT wallet_balance INTO v_current_balance
        FROM public.patients
        WHERE id = v_patient_id;

        -- Prevent usage if insufficient funds
        IF v_current_balance < NEW.amount THEN
            RAISE EXCEPTION 'Insufficient wallet balance. Current: %, Required: %', v_current_balance, NEW.amount;
        END IF;

        -- Deduct from wallet by inserting a negative transaction
        -- The existing 'update_wallet_balance' trigger on wallet_transactions will handle the actual update of patients.wallet_balance
        INSERT INTO public.wallet_transactions (
            patient_id,
            amount,
            description,
            created_at,
            clinic_id,
            created_by
        ) VALUES (
            v_patient_id,
            -NEW.amount, -- Negative amount for deduction
            'Pago con Saldo a Favor - Pago #' || SUBSTRING(NEW.payment_id::text FROM 1 FOR 8),
            NOW(),
            v_clinic_id,
            auth.uid()
        );

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_deduct_wallet_on_payment ON public.payment_transactions;
CREATE TRIGGER trigger_deduct_wallet_on_payment
AFTER INSERT ON public.payment_transactions
FOR EACH ROW
EXECUTE FUNCTION public.deduct_wallet_on_payment();
