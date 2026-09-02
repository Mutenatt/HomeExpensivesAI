// Argentina no observa horario de verano: UTC-3 fijo.
// Mismo offset que usa supabase/functions/period-snapshot/index.ts, para que los
// límites de mes calculados en el cliente coincidan con los del backend.
const ART_OFFSET_MINUTES = -180;

const MONTH_NAMES_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export interface MonthRange {
  start: Date;
  endExclusive: Date;
  label: string;
  monthOffset: number;
}

interface ArtParts {
  year: number;
  month: number; // 0-11
  day: number;
  hours: number;
  minutes: number;
}

function toArtParts(date: Date): ArtParts {
  const shifted = new Date(date.getTime() + ART_OFFSET_MINUTES * 60000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
  };
}

function artMidnightToUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day) - ART_OFFSET_MINUTES * 60000);
}

export function getMonthRange(monthOffset: number, referenceDate: Date = new Date()): MonthRange {
  const ref = toArtParts(referenceDate);
  const targetMonthIndex = ref.month + monthOffset;
  const year = ref.year + Math.floor(targetMonthIndex / 12);
  const month = ((targetMonthIndex % 12) + 12) % 12;

  const start = artMidnightToUtc(year, month, 1);
  const endExclusive = artMidnightToUtc(year, month + 1, 1);

  return {
    start,
    endExclusive,
    label: `${MONTH_NAMES_ES[month]} ${year}`,
    monthOffset,
  };
}

export function formatArtTime(dateIso: string): string {
  const { hours, minutes } = toArtParts(new Date(dateIso));
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatArtDayLabel(dateIso: string, referenceDate: Date = new Date()): string {
  const target = toArtParts(new Date(dateIso));
  const ref = toArtParts(referenceDate);

  if (target.year === ref.year && target.month === ref.month && target.day === ref.day) {
    return "Hoy";
  }

  const base = `${target.day} de ${MONTH_NAMES_ES[target.month]}`;
  return target.year === ref.year ? base : `${base} de ${target.year}`;
}
