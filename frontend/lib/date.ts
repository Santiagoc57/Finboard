import { Preset } from "@/types/dashboard";

function pad(num: number): string {
  return String(num).padStart(2, "0");
}

export function utcClockToBogotaLabel(value?: string | null): string {
  if (!value) return "--";

  const match = value.match(/(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return value;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if ([hours, minutes, seconds].some((item) => Number.isNaN(item))) {
    return value;
  }

  const utcTotal = hours * 3600 + minutes * 60 + seconds;
  const bogotaTotal = ((utcTotal - 5 * 3600) % 86400 + 86400) % 86400;

  const h = Math.floor(bogotaTotal / 3600);
  const m = Math.floor((bogotaTotal % 3600) / 60);
  const s = bogotaTotal % 60;

  return `${pad(h)}:${pad(m)}:${pad(s)} COT`;
}

export function toDateInputValue(input: Date): string {
  return `${input.getFullYear()}-${pad(input.getMonth() + 1)}-${pad(input.getDate())}`;
}

function addMonths(base: Date, months: number): Date {
  const out = new Date(base);
  out.setMonth(out.getMonth() + months);
  return out;
}

function addYears(base: Date, years: number): Date {
  const out = new Date(base);
  out.setFullYear(out.getFullYear() + years);
  return out;
}

export function presetDates(preset: Preset, refDate = new Date()): { startDate: string; endDate: string } {
  const end = new Date(refDate);
  let start = new Date(refDate);

  if (preset === "1M") start = addMonths(refDate, -1);
  if (preset === "3M") start = addMonths(refDate, -3);
  if (preset === "6M") start = addMonths(refDate, -6);
  if (preset === "YTD") start = new Date(refDate.getFullYear(), 0, 1);
  if (preset === "1Y") start = addYears(refDate, -1);
  if (preset === "5Y") start = addYears(refDate, -5);
  if (preset === "MAX") start = new Date(1990, 0, 1);

  return {
    startDate: toDateInputValue(start),
    endDate: toDateInputValue(end),
  };
}
