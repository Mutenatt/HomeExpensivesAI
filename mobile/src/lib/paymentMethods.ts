import type { PaymentMethod } from "../types";

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Efectivo" },
  { value: "digital_wallet", label: "Billetera virtual" },
  { value: "bank_transfer", label: "Transferencia" },
  { value: "debit_card", label: "Débito" },
  { value: "credit_card", label: "Crédito" },
];

export function paymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method;
}
