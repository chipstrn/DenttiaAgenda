# Task List: DenttiaAgenda SaaS Scaling

## Phase 1: Critical Fixes (High Priority)
- [/] **Remove Hardcoded IDs in `Agenda.tsx`**
    - [x] Create a hook to fetch `location_id` dynamically based on user/clinic.
    - [x] Replace hardcoded ID initialization in `Agenda.tsx`.
- [/] **Migrate Financial Logic to Backend**
    - [x] Create Database Trigger for `appointments` status change to `completed`.
    - [x] Move Payment record creation logic to SQL Function/Trigger.
    - [x] Move Commission calculation logic to SQL Function/Trigger.
    - [x] Remove legacy frontend logic from `Agenda.tsx`.

## Phase 2: SaaS Architecture & Security
- [/] **Implement Row Level Security (RLS)**
    - [x] Enable RLS on `patients`, `appointments`, `payments`, `treatments`.
    - [x] Define policies for Tenant isolation (Clinic A cannot see Clinic B data).
- [/] **Audit Logs**
    - [x] Create `audit_logs` table.
    - [x] Implement triggers to record changes on critical tables.

## Phase 3: Financial Engineering
- [x] **Split Payments**
    - [x] Modify `payments` table schema to support split payments or create `payment_methods` sub-table.
    - [x] Update frontend UI in `Finance.tsx` to allow multiple payment methods.
- [x] **Patient Wallet (Saldo a Favor)**
    - [x] Add `wallet_balance` to `patients` table.
    - [x] Implement logic to add funds (Advance Payment).
    - [x] Implement logic to use funds for payment.
- [x] **Cash Basis Commissions**
    - [x] Update commission logic to trigger on `payment` status `completed`, not `appointment` completion.
    - [x] Calculate commission proportionally to the amount paid.

## Phase 4: Agenda Optimization
- [x] **Virtualization**
    - [x] Implement `react-window` or similar in `Agenda.tsx`.
- [x] **Overbooking Prevention**
    - [x] Add PostgreSQL constraint for `doctor_id` + `time_slot`.

## Phase 5: Clinical Module & Inventory
- [x] **Odontogram Evolution**
    - [x] Store snapshots of odontogram state (via DB schema).
    - [x] Add support for Mixed Dentition (Deciduous teeth).
- [x] **PDF Generation**
    - [x] Implement backend PDF generation for legal docs.
- [x] **Automated Inventory**
    - [x] Link `treatments` to `inventory` items (Schema created).
    - [x] Trigger inventory deduction on treatment completion (DB Trigger implemented).

## Phase 6: Onboarding
- [x] **Import Wizard**
    - [x] Create `ImportWizard` page.
    - [x] Implement Excel/CSV parsing (xlsx).
    - [x] processing logic for Patients and Inventory.
- [x] **Guided Tours**
    - [x] Implement `driver.js` for "New Appointment" tour.
    - [x] Implement `driver.js` for "Clinical Chart" tour.nts and Treatments.
