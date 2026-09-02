import { formatArtDayLabel, formatArtTime, getMonthRange } from "./dateRange";

describe("getMonthRange", () => {
  it("calcula el mes corriente (offset 0) en un mes normal", () => {
    // 15 de septiembre 2026, 12:00 UTC (09:00 ART)
    const ref = new Date("2026-09-15T12:00:00Z");
    const range = getMonthRange(0, ref);

    expect(range.label).toBe("septiembre 2026");
    // 1 de septiembre 00:00 ART = 1 de septiembre 03:00 UTC
    expect(range.start.toISOString()).toBe("2026-09-01T03:00:00.000Z");
    // 1 de octubre 00:00 ART = 1 de octubre 03:00 UTC
    expect(range.endExclusive.toISOString()).toBe("2026-10-01T03:00:00.000Z");
  });

  it("retrocede un mes con rollover de año (diciembre -> enero)", () => {
    const ref = new Date("2026-01-15T12:00:00Z");
    const range = getMonthRange(-1, ref);

    expect(range.label).toBe("diciembre 2025");
    expect(range.start.toISOString()).toBe("2025-12-01T03:00:00.000Z");
    expect(range.endExclusive.toISOString()).toBe("2026-01-01T03:00:00.000Z");
  });

  it("retrocede varios meses cruzando más de un año", () => {
    const ref = new Date("2026-02-15T12:00:00Z");
    const range = getMonthRange(-12, ref);

    expect(range.label).toBe("febrero 2025");
  });

  it("respeta el límite de un año bisiesto para febrero", () => {
    const ref = new Date("2028-02-15T12:00:00Z"); // 2028 es bisiesto
    const range = getMonthRange(0, ref);

    expect(range.start.toISOString()).toBe("2028-02-01T03:00:00.000Z");
    expect(range.endExclusive.toISOString()).toBe("2028-03-01T03:00:00.000Z");
  });
});

describe("formatArtTime", () => {
  it("formatea la hora en ART, cruzando la medianoche desde UTC", () => {
    // 00:30 UTC del 2 de septiembre = 21:30 ART del 1 de septiembre
    expect(formatArtTime("2026-09-02T00:30:00Z")).toBe("21:30");
    // 03:00 UTC = 00:00 ART
    expect(formatArtTime("2026-09-02T03:00:00Z")).toBe("00:00");
    // 03:01 UTC = 00:01 ART
    expect(formatArtTime("2026-09-02T03:01:00Z")).toBe("00:01");
  });
});

describe("formatArtDayLabel", () => {
  const ref = new Date("2026-09-02T15:00:00Z"); // 12:00 ART, 2 de septiembre 2026

  it('devuelve "Hoy" para el mismo día ART que la referencia', () => {
    expect(formatArtDayLabel("2026-09-02T13:00:00Z", ref)).toBe("Hoy");
  });

  it("devuelve el día justo después de medianoche ART sin caer en el día anterior", () => {
    // 03:01 UTC del 2 de septiembre = 00:01 ART del 2 de septiembre -> sigue siendo "Hoy"
    expect(formatArtDayLabel("2026-09-02T03:01:00Z", ref)).toBe("Hoy");
    // 02:59 UTC del 2 de septiembre = 23:59 ART del 1 de septiembre -> NO es "Hoy"
    expect(formatArtDayLabel("2026-09-02T02:59:00Z", ref)).toBe("1 de septiembre");
  });

  it("omite el año cuando coincide con el año de referencia", () => {
    expect(formatArtDayLabel("2026-08-31T15:00:00Z", ref)).toBe("31 de agosto");
  });

  it("incluye el año cuando difiere del año de referencia", () => {
    expect(formatArtDayLabel("2025-08-31T15:00:00Z", ref)).toBe("31 de agosto de 2025");
  });
});
