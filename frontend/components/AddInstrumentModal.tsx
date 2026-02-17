"use client";

import { useEffect, useMemo, useState } from "react";

import { searchInstruments } from "@/lib/api";
import { CustomAssetItem, InstrumentSearchResult, MarketCode } from "@/types/dashboard";

interface AddInstrumentModalProps {
  open: boolean;
  market: MarketCode;
  knownLabels: string[];
  loading?: boolean;
  onClose: () => void;
  onAdd: (items: CustomAssetItem[]) => Promise<void> | void;
}

function resultKey(result: InstrumentSearchResult): string {
  return `${result.source}:${result.symbol}`.toLowerCase();
}

export function AddInstrumentModal({
  open,
  market,
  knownLabels,
  loading = false,
  onClose,
  onAdd,
}: AddInstrumentModalProps) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [results, setResults] = useState<InstrumentSearchResult[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const knownSet = useMemo(() => new Set(knownLabels), [knownLabels]);

  useEffect(() => {
    if (!open) return;
    setError(null);
  }, [open]);

  async function onSearch() {
    const clean = query.trim();
    if (!clean) {
      setError("Escribe un token o nombre para buscar.");
      return;
    }

    setSearching(true);
    setError(null);
    setWarnings([]);
    setSelectedKeys([]);
    try {
      const response = await searchInstruments(market, clean, 14);
      setResults(response.results);
      setWarnings(response.warnings || []);
    } catch (err) {
      setResults([]);
      setError(err instanceof Error ? err.message : "No se pudo completar la busqueda");
    } finally {
      setSearching(false);
    }
  }

  function toggleResult(item: InstrumentSearchResult) {
    const key = resultKey(item);
    setSelectedKeys((prev) => {
      const set = new Set(prev);
      if (set.has(key)) {
        set.delete(key);
      } else {
        set.add(key);
      }
      return Array.from(set);
    });
  }

  async function onConfirmAdd() {
    if (!selectedKeys.length) return;

    const selectedSet = new Set(selectedKeys);
    const payload = results
      .filter((item) => selectedSet.has(resultKey(item)))
      .filter((item) => !knownSet.has(item.label))
      .map((item) => ({
        label: item.label,
        source: item.source,
        symbol: item.symbol,
      })) satisfies CustomAssetItem[];

    if (!payload.length) {
      setError("No hay instrumentos nuevos para añadir.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onAdd(payload);
      setQuery("");
      setResults([]);
      setSelectedKeys([]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron añadir los instrumentos");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const disabled = loading || searching || submitting;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/45 p-4">
      <div className="w-full max-w-3xl rounded-xl border border-border-light bg-white shadow-panel">
        <div className="flex items-center justify-between border-b border-border-light px-5 py-3">
          <h3 className="text-lg font-semibold text-text-main">Añadir nuevo instrumento</h3>
          <button
            className="rounded-md px-2 py-1 text-sm text-text-muted transition hover:bg-gray-100 hover:text-text-main"
            type="button"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="h-11 flex-1 rounded-lg border border-border-light bg-white px-3 text-sm text-text-main"
              placeholder="Ej: BTC-USD, SP500, Nasdaq, Gold..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void onSearch();
                }
              }}
            />
            <button
              className="rounded-lg border border-border-light bg-white px-4 py-2 text-sm font-medium text-text-main transition hover:bg-gray-50 disabled:opacity-45"
              disabled={disabled}
              type="button"
              onClick={onSearch}
            >
              {searching ? "Buscando..." : "Buscar"}
            </button>
          </div>

          {!!warnings.length && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {warnings.join(" ")}
            </div>
          )}

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

          <div className="max-h-[360px] overflow-auto rounded-lg border border-border-light">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-gray-50 text-xs uppercase tracking-wider text-text-muted">
                <tr>
                  <th className="w-12 px-3 py-2 text-left">Sel</th>
                  <th className="px-3 py-2 text-left">Instrumento</th>
                  <th className="px-3 py-2 text-left">Fuente</th>
                  <th className="px-3 py-2 text-left">Simbolo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {results.map((item) => {
                  const key = resultKey(item);
                  const alreadyKnown = knownSet.has(item.label) || !!item.exists_in_catalog;
                  const checked = selectedKeys.includes(key);
                  return (
                    <tr key={key} className={alreadyKnown ? "bg-gray-50/60" : "hover:bg-gray-50"}>
                      <td className="px-3 py-2">
                        <input
                          checked={checked}
                          className="h-4 w-4 rounded border-border-light"
                          disabled={alreadyKnown || disabled}
                          type="checkbox"
                          onChange={() => toggleResult(item)}
                        />
                      </td>
                      <td className="px-3 py-2 text-text-main">
                        <div className="font-medium">{item.label}</div>
                        {item.description && <div className="text-xs text-text-muted">{item.description}</div>}
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-text-main">
                          {item.provider}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-text-main">
                        {item.symbol}
                        {alreadyKnown && <span className="ml-2 text-[11px] text-text-muted">(ya existe)</span>}
                      </td>
                    </tr>
                  );
                })}

                {!results.length && !searching && (
                  <tr>
                    <td className="px-3 py-8 text-center text-sm text-text-muted" colSpan={4}>
                      Busca por ticker o nombre y selecciona los resultados para añadir.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border-light px-5 py-3">
          <span className="text-xs text-text-muted">{selectedKeys.length} seleccionados</span>
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border border-border-light bg-white px-4 py-2 text-sm font-medium text-text-main transition hover:bg-gray-50"
              disabled={disabled}
              type="button"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-45"
              disabled={disabled || !selectedKeys.length}
              type="button"
              onClick={() => void onConfirmAdd()}
            >
              {submitting ? "Añadiendo..." : "Añadir seleccionados"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

