// Formato local (es-AR): punto para miles, coma para decimales.
export function formatCurrency(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const [intPart, decPart] = Math.abs(amount).toFixed(2).split(".");
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}$${withThousands},${decPart}`;
}
