import { getMonthRange } from "./dateRange";
import { supabase } from "./supabase";
import type { TransactionWithProduct } from "../types";

export async function fetchTransactionsForMonth(
  userId: string,
  monthOffset: number,
  referenceDate?: Date,
): Promise<TransactionWithProduct[]> {
  const { start, endExclusive } = getMonthRange(monthOffset, referenceDate);

  const { data, error } = await supabase
    .from("transactions")
    .select("*, product:products(name, is_essential)")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .gte("date", start.toISOString())
    .lt("date", endExclusive.toISOString())
    .order("date", { ascending: false })
    .returns<TransactionWithProduct[]>();

  if (error) throw error;
  return data ?? [];
}

export interface EssentialSplit {
  totalIncome: number;
  totalExpense: number;
  totalEssential: number;
  totalNonEssential: number;
}

export function aggregateEssentialSplit(rows: TransactionWithProduct[]): EssentialSplit {
  const split: EssentialSplit = {
    totalIncome: 0,
    totalExpense: 0,
    totalEssential: 0,
    totalNonEssential: 0,
  };

  for (const row of rows) {
    if (row.type === "income") {
      split.totalIncome += row.amount;
      continue;
    }
    split.totalExpense += row.amount;
    if (row.product?.is_essential) {
      split.totalEssential += row.amount;
    } else {
      split.totalNonEssential += row.amount;
    }
  }

  return split;
}
