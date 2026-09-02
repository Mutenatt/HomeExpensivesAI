import { groupTransactionsIntoSections } from "./transactionGrouping";
import type { TransactionWithProduct } from "../types";

function makeRow(id: string, date: string): TransactionWithProduct {
  return {
    id,
    user_id: "user",
    amount: 100,
    type: "expense",
    payment_method: "cash",
    currency: "ARS",
    store_name: null,
    product_id: null,
    date,
    created_at: date,
    deleted_at: null,
    product: null,
  };
}

describe("groupTransactionsIntoSections", () => {
  const ref = new Date("2026-09-02T15:00:00Z"); // 12:00 ART, 2 de septiembre 2026

  it("agrupa filas de hoy y dos días previos en secciones separadas y ordenadas", () => {
    const rows = [
      makeRow("1", "2026-09-02T14:00:00Z"), // hoy, 11:00 ART
      makeRow("2", "2026-09-02T13:00:00Z"), // hoy, 10:00 ART
      makeRow("3", "2026-08-31T20:00:00Z"), // 31 ago, 17:00 ART
      makeRow("4", "2026-08-30T20:00:00Z"), // 30 ago, 17:00 ART
    ];

    const sections = groupTransactionsIntoSections(rows, ref);

    expect(sections).toHaveLength(3);
    expect(sections[0].title).toBe("Hoy");
    expect(sections[0].data.map((r) => r.id)).toEqual(["1", "2"]);
    expect(sections[1].title).toBe("31 de agosto");
    expect(sections[1].data.map((r) => r.id)).toEqual(["3"]);
    expect(sections[2].title).toBe("30 de agosto");
    expect(sections[2].data.map((r) => r.id)).toEqual(["4"]);
  });

  it("no confunde un movimiento justo después de medianoche ART con el día anterior", () => {
    const rows = [
      makeRow("1", "2026-09-02T03:01:00Z"), // 00:01 ART del 2 de sept -> "Hoy"
      makeRow("2", "2026-09-02T02:59:00Z"), // 23:59 ART del 1 de sept -> "1 de septiembre"
    ];

    const sections = groupTransactionsIntoSections(rows, ref);

    expect(sections).toHaveLength(2);
    expect(sections[0].title).toBe("Hoy");
    expect(sections[0].data.map((r) => r.id)).toEqual(["1"]);
    expect(sections[1].title).toBe("1 de septiembre");
    expect(sections[1].data.map((r) => r.id)).toEqual(["2"]);
  });

  it("devuelve un array vacío para un array vacío", () => {
    expect(groupTransactionsIntoSections([], ref)).toEqual([]);
  });
});
