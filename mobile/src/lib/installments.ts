export interface InstallmentScheduleItem {
  installment_number: number;
  total_installments: number;
  amount_per_installment: number;
  due_date: string;
}

// Suma `months` a `date` y clampea el día al último día del mes destino
// cuando el día original no existe ahí (ej. 31 ene + 1 mes -> 28/29 feb).
function addMonthsClamped(date: Date, months: number): Date {
  const targetMonthIndex = date.getMonth() + months;
  const year = date.getFullYear() + Math.floor(targetMonthIndex / 12);
  const month = ((targetMonthIndex % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.min(date.getDate(), lastDayOfTargetMonth);
  return new Date(year, month, day);
}

function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// El monto ingresado es el total de la compra; se reparte en `totalInstallments`
// cuotas iguales. El resto de centavos por redondeo queda en la última cuota,
// para que la suma cierre exacto con el total (se trabaja en centavos enteros
// para evitar errores de punto flotante).
export function calculateInstallmentSchedule(
  totalAmount: number,
  totalInstallments: number,
  purchaseDate: Date,
): InstallmentScheduleItem[] {
  if (totalInstallments <= 1) return [];

  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / totalInstallments);
  const lastCents = totalCents - baseCents * (totalInstallments - 1);

  const schedule: InstallmentScheduleItem[] = [];
  for (let i = 1; i <= totalInstallments; i++) {
    const cents = i === totalInstallments ? lastCents : baseCents;
    schedule.push({
      installment_number: i,
      total_installments: totalInstallments,
      amount_per_installment: cents / 100,
      due_date: toDateOnly(addMonthsClamped(purchaseDate, i)),
    });
  }
  return schedule;
}
