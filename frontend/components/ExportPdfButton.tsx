"use client";

import { useState } from "react";

interface ExportPdfButtonProps {
    targetId: string;
    filename?: string;
}

export function ExportPdfButton({ targetId, filename = "finboard-analisis.pdf" }: ExportPdfButtonProps) {
    const [loading, setLoading] = useState(false);

    async function handleExport() {
        setLoading(true);
        try {
            const element = document.getElementById(targetId);
            if (!element) {
                console.error("Target element not found:", targetId);
                return;
            }

            // Dynamic imports to avoid SSR issues
            const [html2canvas, { default: jsPDF }] = await Promise.all([
                import("html2canvas").then((m) => m.default),
                import("jspdf"),
            ]);

            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                backgroundColor: "#ffffff",
                logging: false,
                windowWidth: element.scrollWidth,
                windowHeight: element.scrollHeight,
            });

            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF({
                orientation: "landscape",
                unit: "px",
                format: [canvas.width, canvas.height],
            });

            // Header bar
            pdf.setFillColor(15, 23, 42);          // #0f172a slate-900
            pdf.rect(0, 0, canvas.width, 56, "F");

            // Logo Badge
            pdf.setFillColor(34, 197, 94);         // green-500
            pdf.roundedRect(32, 16, 24, 24, 4, 4, "F");
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(14);
            pdf.setTextColor(255, 255, 255);
            pdf.text("FB", 36, 33);

            // Title
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(20);
            pdf.setTextColor(248, 250, 252);       // slate-50
            pdf.text("Finboard — Análisis OPA", 68, 36);

            // Date stamp
            const stamp = new Date().toLocaleString("es-CO", {
                dateStyle: "long",
                timeStyle: "short",
            });
            pdf.setFontSize(10);
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(148, 163, 184);       // slate-400
            pdf.text(stamp, canvas.width - 32 - pdf.getTextWidth(stamp), 36);

            // Dashboard screenshot
            pdf.addImage(imgData, "PNG", 0, 64, canvas.width, canvas.height, undefined, "FAST");

            pdf.save(filename);
        } catch (err) {
            console.error("Error generating PDF:", err);
        } finally {
            setLoading(false);
        }
    }

    return (
        <button
            onClick={handleExport}
            disabled={loading}
            title="Exportar análisis como PDF"
            className="flex items-center gap-2 rounded-lg border border-border-light bg-white px-4 py-2 text-sm font-medium text-text-main shadow-sm transition-all hover:border-primary hover:text-primary disabled:cursor-wait disabled:opacity-60"
        >
            {loading ? (
                <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
                    Generando PDF…
                </>
            ) : (
                <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Exportar PDF
                </>
            )}
        </button>
    );
}
