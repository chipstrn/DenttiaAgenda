-- 20240210_agenda_optimization.sql

-- 1. Overbooking Prevention
-- We need to prevent overlapping appointments for the SAME doctor.
-- We use PostgreSQL EXCLUDE constraint.
-- Requires: btree_gist extension for combining UUID (=) and TSRANGE (&&).

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.appointments
ADD CONSTRAINT prevent_doctor_overbooking
EXCLUDE USING GIST (
    doctor_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
)
WHERE (status != 'cancelled');
-- We exclude cancelled appointments from the check.

-- 2. Performance Indexes suited for Agenda queries
CREATE INDEX IF NOT EXISTS idx_appointments_date_range 
ON public.appointments (start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date 
ON public.appointments (doctor_id, start_time);

CREATE INDEX IF NOT EXISTS idx_appointments_location_date 
ON public.appointments (location_id, start_time);
