import { formatCurrency } from "./format";

describe("formatCurrency", () => {
  it("formatea cero", () => {
    expect(formatCurrency(0)).toBe("$0,00");
  });

  it("agrega separador de miles cada 3 dígitos", () => {
    expect(formatCurrency(1234.5)).toBe("$1.234,50");
    expect(formatCurrency(3940000)).toBe("$3.940.000,00");
  });

  it("no agrega separador si no hace falta", () => {
    expect(formatCurrency(500)).toBe("$500,00");
  });

  it("maneja montos negativos con el signo antes del $", () => {
    expect(formatCurrency(-1234.5)).toBe("-$1.234,50");
  });
});
