"use client";

import { useEffect, useMemo, useState } from "react";

import { DateTripletInput } from "@/components/DateTripletInput";
import { toDateInputValue } from "@/lib/date";

interface DatePickerPopoverProps {
    open: boolean;
    loading: boolean;
    initialDate: string;
    onApply: (date: string) => Promise<void> | void;
    onClose: () => void;
}

export function DatePickerPopover({
    open,
    loading,
    initialDate,
    onApply,
    onClose,
}: DatePickerPopoverProps) {
    const [date, setDate] = useState(initialDate);
    const [dateValid, setDateValid] = useState(true);
    const todayIso = useMemo(() => toDateInputValue(new Date()), []);

    useEffect(() => {
        if (!open) return;
        setDate(initialDate);
        setDateValid(true);
    }, [open, initialDate]);

    if (!open) return null;

    return (
        <section className="absolute left-0 top-full z-40 mt-2 w-[calc(100vw-2rem)] sm:w-[320px] rounded-xl border border-border-light bg-white p-4 shadow-panel">
            <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold text-text-main">Seleccionar fecha</p>
                    <p className="text-xs text-text-muted">Elige el día base (Base 100).</p>
                </div>
                <button
                    className="rounded-md border border-border-light px-2 py-1 text-xs text-text-muted transition hover:bg-gray-50"
                    type="button"
                    onClick={onClose}
                >
                    Cerrar
                </button>
            </div>

            <div className="grid gap-3">
                <label className="text-sm font-medium text-text-muted">
                    Día OPA
                    <DateTripletInput
                        disabled={loading}
                        maxDate={todayIso}
                        value={date}
                        onChange={setDate}
                        onValidityChange={setDateValid}
                    />
                </label>
            </div>

            <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-amber-600">
                    {!dateValid && "Fecha invalida. Revisa el formato."}
                </p>

                <div className="flex gap-2">
                    <button
                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-text-main hover:bg-gray-50 disabled:opacity-50"
                        disabled={loading}
                        type="button"
                        onClick={onClose}
                    >
                        Cancelar
                    </button>
                    <button
                        className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
                        disabled={!dateValid || loading}
                        type="button"
                        onClick={() => onApply(date)}
                    >
                        Aplicar
                    </button>
                </div>
            </div>
        </section>
    );
}
