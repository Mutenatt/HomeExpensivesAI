export type TransactionType = "income" | "expense";

export type PaymentMethod =
  | "cash"
  | "debit_card"
  | "credit_card"
  | "bank_transfer"
  | "digital_wallet";

export interface Product {
  id: string;
  user_id: string;
  name: string;
  is_essential: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  type: TransactionType;
  payment_method: PaymentMethod;
  store_name: string | null;
  product_id: string | null;
  date: string;
  created_at: string;
  deleted_at: string | null;
}

export interface Installment {
  id: string;
  transaction_id: string;
  user_id: string;
  installment_number: number;
  total_installments: number;
  amount_per_installment: number;
  due_date: string;
  status: "pending" | "paid";
  created_at: string;
}

export interface PeriodSnapshot {
  id: string;
  user_id: string;
  period_type: "weekly" | "monthly";
  period_start: string;
  period_end: string;
  total_income: number;
  total_expense: number;
  total_essential: number;
  created_at: string;
}

export interface ProductUsualContext {
  product_id: string;
  user_id: string;
  store_name: string | null;
  payment_method: PaymentMethod;
  use_count: number;
}
