import { useState, useRef, useEffect } from "react";
import { MarketCode, SeriesRow, SnapshotRow, MarkowitzPoint, RiskMetric } from "@/types/dashboard";

interface AiAssistantProps {
    market: MarketCode;
    contextData: {
        type: "snapshot" | "matrix" | "markowitz";
        rows?: (SeriesRow | SnapshotRow)[];
        points?: MarkowitzPoint[] | null;
        risk?: RiskMetric[];
    };
}

export function AiAssistant({ market, contextData }: AiAssistantProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [prompt, setPrompt] = useState("");
    const [chatHistory, setChatHistory] = useState<{ role: "user" | "ai"; text: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const endOfChatRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (endOfChatRef.current) {
            endOfChatRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [chatHistory, isOpen]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!prompt.trim()) return;

        const userText = prompt.trim();
        setPrompt("");
        setChatHistory((prev) => [...prev, { role: "user", text: userText }]);
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000"}/api/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    market,
                    context_type: contextData.type,
                    rows: contextData.rows?.slice(0, 50),
                    markowitz_points: contextData.points?.slice(0, 100),
                    risk_metrics: contextData.risk,
                    prompt: userText,
                }),
            });

            if (!response.ok) {
                const errText = await response.text();
                let parsedErr = "Error al consultar la IA";
                try {
                    parsedErr = JSON.parse(errText).detail || parsedErr;
                } catch { }
                throw new Error(parsedErr);
            }

            const data = await response.json();
            setChatHistory((prev) => [...prev, { role: "ai", text: data.response }]);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="relative">
            <button
                type="button"
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span>✨</span>
                Preguntar a la IA
            </button>

            {isOpen && (
                <div className="absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-xl border border-border-light bg-white p-4 shadow-xl">
                    <div className="mb-3 flex items-center justify-between border-b border-border-light pb-2">
                        <h3 className="font-semibold text-text-main flex items-center gap-2">
                            <span className="text-xl">🤖</span> FinBoard AI
                        </h3>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-text-muted hover:text-text-main"
                            aria-label="Cerrar"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="mb-4 flex h-64 flex-col gap-3 overflow-y-auto pr-1 text-sm">
                        {chatHistory.length === 0 ? (
                            <div className="flex h-full flex-col items-center justify-center text-center text-text-muted">
                                <span className="mb-2 text-3xl opacity-50">💡</span>
                                <p>Preguntame sobre los datos actuales que estas viendo.</p>
                                <p className="mt-2 text-xs opacity-70">El contexto se envía automáticamente.</p>
                            </div>
                        ) : (
                            chatHistory.map((msg, idx) => (
                                <div
                                    key={idx}
                                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} w-full`}
                                >
                                    <div
                                        className={`max-w-[85%] rounded-2xl px-3 py-2 ${msg.role === "user"
                                            ? "bg-indigo-100 text-indigo-900 rounded-tr-sm"
                                            : "bg-gray-100 text-gray-800 rounded-tl-sm whitespace-pre-wrap"
                                            }`}
                                    >
                                        {msg.role === "ai" ? (
                                            <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 text-gray-800 whitespace-pre-wrap">
                                                {msg.text}
                                            </div>
                                        ) : (
                                            msg.text
                                        )}
                                    </div>
                                </div>
                            ))
                        )}

                        {loading && (
                            <div className="flex justify-start">
                                <div className="max-w-[85%] rounded-2xl bg-gray-100 px-4 py-2.5 rounded-tl-sm flex items-center gap-1.5">
                                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "0ms" }} />
                                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "150ms" }} />
                                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "300ms" }} />
                                </div>
                            </div>
                        )}
                        <div ref={endOfChatRef} />
                    </div>

                    {error && <div className="mb-3 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100">{error}</div>}

                    <form onSubmit={handleSubmit} className="flex gap-2">
                        <input
                            type="text"
                            className="flex-1 rounded-lg border border-border-light bg-gray-50 px-3 py-2 text-sm text-text-main focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="Haz tu pregunta..."
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            disabled={loading}
                            autoFocus
                        />
                        <button
                            type="submit"
                            disabled={loading || !prompt.trim()}
                            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                            aria-label="Enviar"
                        >
                            🚀
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}
