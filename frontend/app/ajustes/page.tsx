"use client";

import { useEffect, useState } from "react";

import { TopBar } from "@/components/TopBar";
import { fetchSettings, saveSettings } from "@/lib/api";
import { SettingsResponse } from "@/types/dashboard";

function sourceLabel(source: SettingsResponse["fred"]["source"]): string {
  if (source === "runtime") return "Ajuste guardado en la app";
  if (source === "env") return "Variable de entorno (FRED_KEY)";
  return "Sin configurar";
}

export default function AjustesPage() {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [fredKeyInput, setFredKeyInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadSettings() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchSettings();
        if (!mounted) return;
        setSettings(data);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "No se pudieron cargar los ajustes");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadSettings();
    return () => {
      mounted = false;
    };
  }, []);

  async function onSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const data = await saveSettings(fredKeyInput);
      setSettings(data);
      setMessage(data.message || "Ajustes guardados");
      setFredKeyInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar los ajustes");
    } finally {
      setSaving(false);
    }
  }

  async function onClear() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const data = await saveSettings("");
      setSettings(data);
      setMessage("FRED key local eliminada");
      setFredKeyInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo limpiar la clave");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <TopBar activeSection="settings" />

      <main className="mx-auto w-full max-w-[1200px] px-4 pb-10 lg:px-6">
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
            <span>Sistema</span>
            <span>›</span>
            <span className="font-medium text-text-main">Ajustes</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-text-main">Ajustes de APIs</h1>
          <p className="mt-2 text-sm text-text-muted">
            Configura la clave de FRED para series macro. Las otras fuentes (Yahoo y Stooq) no requieren clave.
          </p>
        </div>

        {loading && <div className="card-shell p-5 text-sm text-text-muted">Cargando ajustes...</div>}

        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {message && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

        {!loading && settings && (
          <>
            <section className="card-shell mb-6 p-5">
              <h2 className="mb-3 text-lg font-semibold text-text-main">FRED Key</h2>

              <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                <input
                  className="w-full rounded-lg border border-border-light bg-white px-3 py-2 text-sm"
                  type="password"
                  placeholder="Pega aqui tu FRED API Key"
                  value={fredKeyInput}
                  onChange={(e) => setFredKeyInput(e.target.value)}
                />
                <button
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-green-300"
                  disabled={saving}
                  type="button"
                  onClick={onSave}
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
                <button
                  className="rounded-lg border border-border-light bg-white px-4 py-2 text-sm font-semibold text-text-main transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={saving}
                  type="button"
                  onClick={onClear}
                >
                  Limpiar
                </button>
              </div>

              <div className="space-y-1 text-sm text-text-muted">
                <p>
                  Estado actual: <span className="font-semibold text-text-main">{settings.fred.configured ? "Configurada" : "No configurada"}</span>
                </p>
                <p>
                  Fuente activa: <span className="font-semibold text-text-main">{sourceLabel(settings.fred.source)}</span>
                </p>
                <p>
                  Clave detectada: <span className="font-mono text-text-main">{settings.fred.masked || "-"}</span>
                </p>
              </div>
            </section>

            <section className="card-shell p-5">
              <h2 className="mb-3 text-lg font-semibold text-text-main">Que APIs usamos</h2>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-sm">
                  <thead>
                    <tr className="table-head">
                      <th className="px-4 py-3 text-left">Proveedor</th>
                      <th className="px-4 py-3 text-left">Uso</th>
                      <th className="px-4 py-3 text-left">Requiere Key</th>
                      <th className="px-4 py-3 text-left">Configurable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light">
                    {settings.providers.map((provider) => (
                      <tr key={provider.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-text-main">{provider.name}</td>
                        <td className="px-4 py-3 text-text-muted">{provider.usage}</td>
                        <td className="px-4 py-3">{provider.requires_key ? "Si" : "No"}</td>
                        <td className="px-4 py-3">{provider.configurable ? "Si" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}
