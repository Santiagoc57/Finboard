"use client";

import { useMemo } from "react";

import { instrumentIcon } from "@/lib/instrument";
import { MarketCode, SnapshotRow } from "@/types/dashboard";

export interface SnapshotViewRow extends SnapshotRow {
  displayInstrument: string;
}

export interface InstrumentOption {
  value: string;
  label: string;
}

export type SnapshotSortField = "date" | "instrument" | "open" | "high" | "low" | "close" | "change_pct";
export type SnapshotSortDirection = "asc" | "desc";

export interface SnapshotSortState {
  field: SnapshotSortField;
  direction: SnapshotSortDirection;
}

interface UseSnapshotTableInput {
  market: MarketCode;
  rowsRaw: SnapshotRow[];
  invertGlobal: boolean;
  invertedAssets: string[];
  instrumentFilters: string[] | null;
  searchTerm: string;
  sort: SnapshotSortState;
  page: number;
  pageSize?: number;
}

function invertValue(value: number | null): number | null {
  if (value === null || value === 0) return value;
  return 1 / value;
}

function flipPair(pair: string): string {
  const [left, right] = pair.split("/");
  if (!left || !right) return pair;
  return `${right}/${left}`;
}

function compareNullableNumbers(
  left: number | null,
  right: number | null,
  direction: SnapshotSortDirection
): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return direction === "asc" ? left - right : right - left;
}

export function useSnapshotTable({
  market,
  rowsRaw,
  invertGlobal,
  invertedAssets,
  instrumentFilters,
  searchTerm,
  sort,
  page,
  pageSize = 10,
}: UseSnapshotTableInput) {
  const transformedRows = useMemo(() => {
    const invertedSet = new Set(invertedAssets);

    return rowsRaw.map((row) => {
      const manual = invertedSet.has(row.instrument);
      const effective = invertGlobal ? !manual : manual;

      if (!effective) {
        return { ...row, isInverted: false, displayInstrument: row.instrument };
      }

      const nextOpen = invertValue(row.open);
      const nextHigh = invertValue(row.low);
      const nextLow = invertValue(row.high);
      const nextClose = invertValue(row.close);
      const nextPrevClose = invertValue(row.prev_close);

      const nextChangePct =
        nextClose !== null && nextPrevClose !== null && nextPrevClose !== 0
          ? (nextClose / nextPrevClose - 1) * 100
          : null;

      const displayInstrument = market === "monedas" ? flipPair(row.instrument) : row.instrument;

      return {
        ...row,
        open: nextOpen,
        high: nextHigh,
        low: nextLow,
        close: nextClose,
        prev_close: nextPrevClose,
        change_pct: Number.isFinite(nextChangePct) ? nextChangePct : null,
        isInverted: true,
        displayInstrument,
      };
    });
  }, [rowsRaw, invertGlobal, invertedAssets, market]);

  const instrumentOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: InstrumentOption[] = [];

    for (const row of transformedRows) {
      if (seen.has(row.instrument)) continue;
      seen.add(row.instrument);
      const icon = instrumentIcon(row.displayInstrument, market);
      options.push({
        value: row.instrument,
        label: icon ? `${icon} ${row.displayInstrument}` : row.displayInstrument,
      });
    }

    options.sort((a, b) => a.label.localeCompare(b.label));
    return options;
  }, [transformedRows, market]);

  const rows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filterSet = instrumentFilters ? new Set(instrumentFilters) : null;
    const filtered = transformedRows.filter((row) => {
      if (filterSet && !filterSet.has(row.instrument)) return false;
      if (!term) return true;
      return (
        row.instrument.toLowerCase().includes(term) ||
        row.displayInstrument.toLowerCase().includes(term)
      );
    });

    filtered.sort((a, b) => {
      if (sort.field === "date") {
        const cmp = a.date.localeCompare(b.date);
        return sort.direction === "asc" ? cmp : -cmp;
      }

      if (sort.field === "instrument") {
        const cmp = a.displayInstrument.localeCompare(b.displayInstrument, "es", {
          sensitivity: "base",
        });
        return sort.direction === "asc" ? cmp : -cmp;
      }

      return compareNullableNumbers(a[sort.field], b[sort.field], sort.direction);
    });

    return filtered;
  }, [transformedRows, searchTerm, instrumentFilters, sort]);

  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageRows = rows.slice(pageStart, pageStart + pageSize);
  const highlightInstrument = rows[0]?.instrument ?? null;

  return {
    rows,
    instrumentOptions,
    pageRows,
    totalRows,
    totalPages,
    safePage,
    pageStart,
    highlightInstrument,
  };
}
