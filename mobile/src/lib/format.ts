import type { Currency } from "../types";

// Formato local (es-AR): punto para miles, coma para decimales.
export function formatCurrency(amount: number, currency: Currency = "ARS"): string {
  const sign = amount < 0 ? "-" : "";
  const prefix = currency === "USD" ? "US$" : "$";
  const [intPart, decPart] = Math.abs(amount).toFixed(2).split(".");
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${prefix}${withThousands},${decPart}`;
}

// keyboardType="decimal-pad" no restringe la entrada en web (RN Web la ignora),
// así que hay que filtrar manualmente para permitir solo dígitos y un separador decimal.
export function sanitizeAmountInput(text: string): string {
  const cleaned = text.replace(/[^0-9.,]/g, "");
  const match = cleaned.match(/^\d*([.,]\d*)?/);
  return match ? match[0] : "";
}
