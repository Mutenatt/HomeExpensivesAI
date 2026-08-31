import { calculateInstallmentSchedule } from "./installments";

describe("calculateInstallmentSchedule", () => {
  it("devuelve [] cuando hay 1 cuota o menos", () => {
    expect(calculateInstallmentSchedule(1000, 1, new Date(2026, 7, 31))).toEqual([]);
    expect(calculateInstallmentSchedule(1000, 0, new Date(2026, 7, 31))).toEqual([]);
  });

  it("reparte el monto exacto cuando divide justo, con fechas mensuales clampeadas a fin de mes", () => {
    const schedule = calculateInstallmentSchedule(120000, 12, new Date(2026, 7, 31)); // 31 ago 2026

    expect(schedule).toHaveLength(12);
    expect(schedule.every((item) => item.amount_per_installment === 10000)).toBe(true);
    expect(schedule.reduce((sum, item) => sum + item.amount_per_installment, 0)).toBe(120000);

    // Ago 31 + 1 mes -> Set no tiene día 31, clampea a Sep 30
    expect(schedule[0].due_date).toBe("2026-09-30");
    // Ago 31 + 4 meses -> Dic 31
    expect(schedule[3].due_date).toBe("2026-12-31");
    // Ago 31 + 6 meses -> Feb 2027 (no bisiesto) tiene 28 días
    expect(schedule[5].due_date).toBe("2027-02-28");
    // Ago 31 + 12 meses -> Ago 31 2027
    expect(schedule[11].due_date).toBe("2027-08-31");
  });

  it("pone el resto del redondeo en la última cuota", () => {
    const schedule = calculateInstallmentSchedule(100, 3, new Date(2026, 0, 15));

    expect(schedule).toHaveLength(3);
    expect(schedule[0].amount_per_installment).toBe(33.33);
    expect(schedule[1].amount_per_installment).toBe(33.33);
    expect(schedule[2].amount_per_installment).toBe(33.34);
    expect(schedule.reduce((sum, item) => sum + item.amount_per_installment, 0)).toBeCloseTo(100, 2);
  });

  it("clampea a 29 de febrero en año bisiesto", () => {
    const schedule = calculateInstallmentSchedule(200, 1 /* placeholder, se pisa abajo */, new Date(2028, 0, 31));
    // 1 cuota no genera cronograma; forzamos 2 cuotas para poder observar el clamp en la cuota 1.
    const scheduleWithTwo = calculateInstallmentSchedule(200, 2, new Date(2028, 0, 31)); // 31 ene 2028 (bisiesto)
    expect(scheduleWithTwo[0].due_date).toBe("2028-02-29");
    expect(schedule).toEqual([]);
  });

  it("numera las cuotas correctamente y repite total_installments en cada item", () => {
    const schedule = calculateInstallmentSchedule(300, 3, new Date(2026, 5, 10));
    expect(schedule.map((item) => item.installment_number)).toEqual([1, 2, 3]);
    expect(schedule.every((item) => item.total_installments === 3)).toBe(true);
  });
});
