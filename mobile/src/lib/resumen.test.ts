// resumen.ts importa el cliente de Supabase (que a su vez importa
// react-native-url-polyfill, un módulo ESM que ts-jest no puede transformar
// fuera de React Native). Solo se testea aggregateEssentialSplit, que es pura,
// así que se mockea el cliente para poder cargar el módulo bajo Jest.
jest.mock("./supabase", () => ({ supabase: {} }));

import { aggregateEssentialSplit } from "./resumen";
import type { TransactionWithProduct } from "../types";

function makeRow(overrides: Partial<TransactionWithProduct>): TransactionWithProduct {
  return {
    id: "id",
    user_id: "user",
    amount: 0,
    type: "expense",
    payment_method: "cash",
    store_name: null,
    product_id: null,
    date: "2026-09-02T12:00:00Z",
    created_at: "2026-09-02T12:00:00Z",
    deleted_at: null,
    product: null,
    ...overrides,
  };
}

describe("aggregateEssentialSplit", () => {
  it("devuelve todo en cero para un array vacío", () => {
    expect(aggregateEssentialSplit([])).toEqual({
      totalIncome: 0,
      totalExpense: 0,
      totalEssential: 0,
      totalNonEssential: 0,
    });
  });

  it("suma los gastos esenciales a totalEssential", () => {
    const rows = [makeRow({ amount: 500, product: { name: "Arroz", is_essential: true } })];
    const split = aggregateEssentialSplit(rows);
    expect(split.totalEssential).toBe(500);
    expect(split.totalNonEssential).toBe(0);
    expect(split.totalExpense).toBe(500);
  });

  it("suma los gastos no esenciales a totalNonEssential", () => {
    const rows = [makeRow({ amount: 300, product: { name: "Cine", is_essential: false } })];
    const split = aggregateEssentialSplit(rows);
    expect(split.totalNonEssential).toBe(300);
    expect(split.totalEssential).toBe(0);
  });

  it("trata los gastos sin producto (product: null) como no esenciales", () => {
    const rows = [makeRow({ amount: 200, product: null })];
    const split = aggregateEssentialSplit(rows);
    expect(split.totalNonEssential).toBe(200);
    expect(split.totalEssential).toBe(0);
  });

  it("los ingresos solo afectan totalIncome y quedan fuera del split esencial", () => {
    const rows = [makeRow({ amount: 1000, type: "income", product: null })];
    const split = aggregateEssentialSplit(rows);
    expect(split.totalIncome).toBe(1000);
    expect(split.totalExpense).toBe(0);
    expect(split.totalEssential).toBe(0);
    expect(split.totalNonEssential).toBe(0);
  });

  it("combina ingresos, esenciales y no esenciales correctamente", () => {
    const rows = [
      makeRow({ amount: 1000, type: "income", product: null }),
      makeRow({ amount: 500, product: { name: "Arroz", is_essential: true } }),
      makeRow({ amount: 300, product: { name: "Cine", is_essential: false } }),
      makeRow({ amount: 200, product: null }),
    ];
    const split = aggregateEssentialSplit(rows);
    expect(split).toEqual({
      totalIncome: 1000,
      totalExpense: 1000,
      totalEssential: 500,
      totalNonEssential: 500,
    });
  });
});
