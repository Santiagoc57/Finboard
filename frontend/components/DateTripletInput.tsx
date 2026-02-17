"use client";

import { ClipboardEvent, useEffect, useMemo, useRef, useState } from "react";

interface DateTripletInputProps {
  value: string;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
  onChange: (nextIsoDate: string) => void;
  onValidityChange?: (isValid: boolean) => void;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function parseIsoParts(value: string): { day: string; month: string; year: string } {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return { day: "", month: "", year: "" };
  return {
    year: match[1],
    month: match[2],
    day: match[3],
  };
}

function normalizeDigits(value: string, max: number): string {
  return value.replace(/\D/g, "").slice(0, max);
}

function toIsoIfValid(
  day: string,
  month: string,
  year: string,
  minDate?: string,
  maxDate?: string
): string {
  if (day.length !== 2 || month.length !== 2 || year.length !== 4) return "";

  const d = Number(day);
  const m = Number(month);
  const y = Number(year);

  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return "";
  if (y < 1900 || y > 2100) return "";
  if (m < 1 || m > 12) return "";

  const probe = new Date(Date.UTC(y, m - 1, d));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() + 1 !== m ||
    probe.getUTCDate() !== d
  ) {
    return "";
  }

  const iso = `${y}-${pad2(m)}-${pad2(d)}`;
  if (minDate && iso < minDate) return "";
  if (maxDate && iso > maxDate) return "";
  return iso;
}

function parsePastedDate(raw: string): { day: string; month: string; year: string } | null {
  const text = raw.trim();
  if (!text) return null;

  const ymd = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (ymd) {
    return {
      year: ymd[1],
      month: pad2(Number(ymd[2])),
      day: pad2(Number(ymd[3])),
    };
  }

  const dmy = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    return {
      day: pad2(Number(dmy[1])),
      month: pad2(Number(dmy[2])),
      year: dmy[3],
    };
  }

  return null;
}

export function DateTripletInput({
  value,
  disabled = false,
  minDate,
  maxDate,
  onChange,
  onValidityChange,
}: DateTripletInputProps) {
  const initial = useMemo(() => parseIsoParts(value), [value]);
  const [day, setDay] = useState(initial.day);
  const [month, setMonth] = useState(initial.month);
  const [year, setYear] = useState(initial.year);

  const dayRef = useRef<HTMLInputElement | null>(null);
  const monthRef = useRef<HTMLInputElement | null>(null);
  const yearRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const parsed = parseIsoParts(value);
    setDay(parsed.day);
    setMonth(parsed.month);
    setYear(parsed.year);
    onValidityChange?.(Boolean(toIsoIfValid(parsed.day, parsed.month, parsed.year, minDate, maxDate)));
  }, [value, onValidityChange, minDate, maxDate]);

  function publish(nextDay: string, nextMonth: string, nextYear: string) {
    const iso = toIsoIfValid(nextDay, nextMonth, nextYear, minDate, maxDate);
    onValidityChange?.(Boolean(iso));
    if (iso) onChange(iso);
  }

  function onDayChange(raw: string) {
    const next = normalizeDigits(raw, 2);
    setDay(next);
    publish(next, month, year);
    if (next.length === 2) monthRef.current?.focus();
  }

  function onMonthChange(raw: string) {
    const next = normalizeDigits(raw, 2);
    setMonth(next);
    publish(day, next, year);
    if (next.length === 2) yearRef.current?.focus();
  }

  function onYearChange(raw: string) {
    const next = normalizeDigits(raw, 4);
    setYear(next);
    publish(day, month, next);
  }

  function onPasteDate(event: ClipboardEvent<HTMLInputElement>) {
    const parsed = parsePastedDate(event.clipboardData.getData("text"));
    if (!parsed) return;

    event.preventDefault();
    setDay(parsed.day);
    setMonth(parsed.month);
    setYear(parsed.year);
    publish(parsed.day, parsed.month, parsed.year);
  }

  const isFilled = day.length === 2 && month.length === 2 && year.length === 4;
  const isValid = Boolean(toIsoIfValid(day, month, year, minDate, maxDate));
  const invalidClass = isFilled && !isValid ? "border-red-300 focus:border-red-400" : "";

  return (
    <div className="mt-1 flex items-center gap-1">
      <input
        ref={dayRef}
        className={`w-14 rounded-lg border border-border-light bg-white px-2 py-2 text-sm text-center ${invalidClass}`}
        disabled={disabled}
        inputMode="numeric"
        maxLength={2}
        placeholder="DD"
        value={day}
        onChange={(e) => onDayChange(e.target.value)}
        onPaste={onPasteDate}
      />
      <span className="text-text-muted">/</span>
      <input
        ref={monthRef}
        className={`w-14 rounded-lg border border-border-light bg-white px-2 py-2 text-sm text-center ${invalidClass}`}
        disabled={disabled}
        inputMode="numeric"
        maxLength={2}
        placeholder="MM"
        value={month}
        onChange={(e) => onMonthChange(e.target.value)}
        onPaste={onPasteDate}
      />
      <span className="text-text-muted">/</span>
      <input
        ref={yearRef}
        className={`w-20 rounded-lg border border-border-light bg-white px-2 py-2 text-sm text-center ${invalidClass}`}
        disabled={disabled}
        inputMode="numeric"
        maxLength={4}
        placeholder="AAAA"
        value={year}
        onChange={(e) => onYearChange(e.target.value)}
        onPaste={onPasteDate}
      />
    </div>
  );
}
