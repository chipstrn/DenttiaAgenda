export interface BudgetItem {
    id?: string;
    budget_id?: string;
    treatment_id: string; // Relation to treatments table
    tooth_number?: string;
    price: number;
    quantity: number;
    treatment_name?: string; // For display
    box_names?: string; // For display (Odontogram location)
}

export interface Budget {
    id: string;
    patient_id: string;
    doctor_id: string | null;
    total_amount: number;
    discount_amount: number;
    discount_percentage: number;
    final_total: number;
    sessions_count: number;
    notes: string;
    status: 'draft' | 'accepted' | 'rejected' | 'completed';
    payment_terms: 'cash' | 'months_3' | 'months_6' | 'months_12' | 'custom';
    created_at: string;
    updated_at: string;
    items?: BudgetItem[];
    doctor?: {
        first_name: string;
        last_name: string;
    };
}

export interface CreateBudgetDTO {
    patient_id: string;
    doctor_id: string | null;
    total_amount: number;
    discount_amount: number;
    discount_percentage: number;
    final_total: number;
    sessions_count: number;
    notes: string;
    payment_terms: string;
    status: 'draft' | 'accepted';
    items: BudgetItem[];
}
