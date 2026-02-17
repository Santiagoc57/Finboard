"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { DashboardQuery, Preset } from "@/types/dashboard";

interface ChipOption {
  value: string;
  label: string;
}

interface ChipRowProps {
  rangeLabel: string;
  presetValue: Preset;
  frequencyValue: DashboardQuery["frequency"];
  instrumentValues: string[] | null;
  instrumentOptions: ChipOption[];
  refreshProgress: number;
  refreshing: boolean;
  onRangeClick: () => void;
  onPresetChange: (value: Preset) => void;
  onFrequencyChange: (value: DashboardQuery["frequency"]) => void;
  onInstrumentChange: (value: string[] | null) => void;
  onLiveClick: () => void;
}

const PRESET_OPTIONS: Array<{ value: Preset; label: string }> = [
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "6M", label: "6M" },
  { value: "YTD", label: "YTD" },
  { value: "1Y", label: "1Y" },
  { value: "5Y", label: "5Y" },
  { value: "MAX", label: "MAX" },
  { value: "Custom", label: "Custom" },
];

const FREQUENCY_OPTIONS: Array<{ value: DashboardQuery["frequency"]; label: string }> = [
  { value: "D", label: "Diaria" },
  { value: "W", label: "Semanal" },
  { value: "M", label: "Mensual" },
];

export function ChipRow({
  rangeLabel,
  presetValue,
  frequencyValue,
  instrumentValues,
  instrumentOptions,
  refreshProgress,
  refreshing,
  onRangeClick,
  onPresetChange,
  onFrequencyChange,
  onInstrumentChange,
  onLiveClick,
}: ChipRowProps) {
  const [instrumentOpen, setInstrumentOpen] = useState(false);
  const instrumentRef = useRef<HTMLDivElement | null>(null);

  const selectedCount = instrumentValues === null ? instrumentOptions.length : instrumentValues.length;
  const instrumentLabel = useMemo(() => {
    if (!instrumentOptions.length) return "Sin datos";
    if (instrumentValues === null) return "Todos";
    if (instrumentValues.length === 1) return "1 seleccionado";
    return `${instrumentValues.length} seleccionados`;
  }, [instrumentOptions.length, instrumentValues]);

  useEffect(() => {
    if (!instrumentOpen) return;
    function onDocClick(event: MouseEvent) {
      if (!instrumentRef.current) return;
      if (instrumentRef.current.contains(event.target as Node)) return;
      setInstrumentOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [instrumentOpen]);

  function isChecked(value: string): boolean {
    if (instrumentValues === null) return true;
    return instrumentValues.includes(value);
  }

  function toggleInstrument(value: string) {
    const all = instrumentOptions.map((opt) => opt.value);
    if (instrumentValues === null) {
      onInstrumentChange(all.filter((item) => item !== value));
      return;
    }

    const next = new Set(instrumentValues);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }

    const values = Array.from(next);
    if (values.length === all.length) {
      onInstrumentChange(null);
      return;
    }
    onInstrumentChange(values);
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <button className="chip-btn compact-target" onClick={onRangeClick} type="button">
        <span className="text-primary">▣</span>
        <span className="chip-k">Rango</span>
        <strong>{rangeLabel}</strong>
      </button>

      <label className="chip-btn compact-target">
        <span className="text-primary">⌁</span>
        <span className="chip-k">Temporalidad</span>
        <select
          className="chip-select"
          value={presetValue}
          onChange={(e) => onPresetChange(e.target.value as Preset)}
        >
          {PRESET_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label className="chip-btn compact-target">
        <span className="text-primary">◔</span>
        <span className="chip-k">Frecuencia</span>
        <select
          className="chip-select"
          value={frequencyValue}
          onChange={(e) => onFrequencyChange(e.target.value as DashboardQuery["frequency"])}
        >
          {FREQUENCY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <div className="relative" ref={instrumentRef}>
        <button className="chip-btn compact-target" type="button" onClick={() => setInstrumentOpen((prev) => !prev)}>
          <span className="text-primary">☰</span>
          <span className="chip-k">Instrumento</span>
          <strong>{instrumentLabel}</strong>
          <span className="text-xs text-text-muted">{instrumentOpen ? "▲" : "▼"}</span>
        </button>

        {instrumentOpen && (
          <div className="absolute left-0 top-full z-40 mt-2 w-[320px] max-w-[90vw] rounded-xl border border-border-light bg-white p-3 shadow-panel">
            <div className="max-h-64 space-y-1 overflow-auto pr-1">
              {instrumentOptions.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text-main transition hover:bg-gray-50"
                >
                  <input
                    checked={isChecked(opt.value)}
                    className="h-4 w-4 rounded border-border-light"
                    type="checkbox"
                    onChange={() => toggleInstrument(opt.value)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-border-light pt-2">
              <span className="text-xs text-text-muted">{selectedCount} seleccionados</span>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-md border border-border-light px-2 py-1 text-xs font-medium text-text-main transition hover:bg-gray-50"
                  type="button"
                  onClick={() => onInstrumentChange([])}
                >
                  Reset
                </button>
                <button
                  className="rounded-md border border-border-light px-2 py-1 text-xs font-medium text-text-main transition hover:bg-gray-50"
                  type="button"
                  onClick={() => onInstrumentChange(null)}
                >
                  Todos
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mx-2 hidden h-6 w-px bg-border-light lg:block" />

      <button
        className="chip-btn compact-target relative overflow-hidden"
        disabled={refreshing}
        onClick={onLiveClick}
        type="button"
      >
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-green-100 transition-[width] duration-200 ease-linear"
          style={{ width: `${Math.max(0, Math.min(100, refreshProgress))}%` }}
        />
        <span className="relative z-10 flex items-center gap-2">
          <span className={`${refreshing ? "animate-spin" : ""}`}>↻</span>
          <strong>{refreshing ? "Actualizando..." : "Actualizar"}</strong>
        </span>
      </button>
    </div>
  );
}
