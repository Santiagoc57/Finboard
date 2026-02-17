"use client";

import { useEffect, useMemo, useState } from "react";

import { DateTripletInput } from "@/components/DateTripletInput";
import { toDateInputValue } from "@/lib/date";

interface RangePickerPopoverProps {
  open: boolean;
  loading: boolean;
  initialStartDate: string;
  initialEndDate: string;
  onApply: (startDate: string, endDate: string) => Promise<void> | void;
  onClose: () => void;
}

function parseDateInput(value: string): Date | null {
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function selectedDays(startDate: string, endDate: string): number | null {
  const start = parseDateInput(startDate);
  const end = parseDateInput(endDate);
  if (!start || !end || end < start) return null;
  const diffMs = end.getTime() - start.getTime();
  return Math.floor(diffMs / 86400000) + 1;
}

export function RangePickerPopover({
  open,
  loading,
  initialStartDate,
  initialEndDate,
  onApply,
  onClose,
}: RangePickerPopoverProps) {
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [startValid, setStartValid] = useState(true);
  const [endValid, setEndValid] = useState(true);
  const todayIso = useMemo(() => toDateInputValue(new Date()), []);

  useEffect(() => {
    if (!open) return;
    setStartDate(initialStartDate);
    setEndDate(initialEndDate);
    setStartValid(true);
    setEndValid(true);
  }, [open, initialStartDate, initialEndDate]);

  const days = useMemo(() => selectedDays(startDate, endDate), [startDate, endDate]);
  const invalidRange = !startValid || !endValid || days === null;
  const invalidMessage =
    !startValid || !endValid
      ? "Fecha invalida. Revisa el formato y evita fechas futuras."
      : "Rango invalido. La fecha final debe ser mayor o igual a la inicial.";

  if (!open) return null;

  return (
    <section className="absolute left-0 top-full z-40 mt-2 w-full max-w-[640px] rounded-xl border border-border-light bg-white p-4 shadow-panel">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-main">Seleccionar rango</p>
          <p className="text-xs text-text-muted">Elige las fechas y aplica para recargar la tabla.</p>
        </div>
        <button
          className="rounded-md border border-border-light px-2 py-1 text-xs text-text-muted transition hover:bg-gray-50"
          type="button"
          onClick={onClose}
        >
          Cerrar
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-text-muted">
          Desde
          <DateTripletInput
            disabled={loading}
            maxDate={todayIso}
            value={startDate}
            onChange={setStartDate}
            onValidityChange={setStartValid}
          />
        </label>

        <label className="text-sm font-medium text-text-muted">
          Hasta
          <DateTripletInput
            disabled={loading}
            maxDate={todayIso}
            value={endDate}
            onChange={setEndDate}
            onValidityChange={setEndValid}
          />
        </label>
      </div>

      <div className="mt-3 rounded-lg border border-border-light bg-gray-50 px-3 py-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            {invalidRange ? (
              <span className="text-red-600">{invalidMessage}</span>
            ) : (
              <span className="text-text-main">
                Dias seleccionados: <strong>{days}</strong>
              </span>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              className="rounded-lg border border-border-light bg-white px-4 py-2 text-sm font-medium text-text-main transition hover:bg-gray-50"
              type="button"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-green-300"
              disabled={invalidRange || loading}
              type="button"
              onClick={() => onApply(startDate, endDate)}
            >
              {loading ? "Aplicando..." : "Aplicar rango"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
