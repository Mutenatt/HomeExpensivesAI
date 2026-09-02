import { formatArtDayLabel } from "./dateRange";
import type { TransactionWithProduct } from "../types";

export interface TransactionDaySection {
  key: string;
  title: string;
  data: TransactionWithProduct[];
}

function artDayKey(dateIso: string): string {
  // Clave estable por día ART reutilizando el mismo offset que formatArtDayLabel,
  // sin depender de la label (que varía según referenceDate).
  const ART_OFFSET_MINUTES = -180;
  const shifted = new Date(new Date(dateIso).getTime() + ART_OFFSET_MINUTES * 60000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Asume `rows` ya ordenadas por fecha descendente (como devuelve fetchTransactionsForMonth).
export function groupTransactionsIntoSections(
  rows: TransactionWithProduct[],
  referenceDate?: Date,
): TransactionDaySection[] {
  const sections: TransactionDaySection[] = [];

  for (const row of rows) {
    const key = artDayKey(row.date);
    const last = sections[sections.length - 1];
    if (last && last.key === key) {
      last.data.push(row);
    } else {
      sections.push({ key, title: formatArtDayLabel(row.date, referenceDate), data: [row] });
    }
  }

  return sections;
}
