"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SnapshotRow } from "@/types/dashboard";

const WS_BASE_URL = (() => {
    const envBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (envBase) return envBase.replace(/^http/, "ws");

    // Fallback for local development
    if (typeof window !== "undefined") {
        const hostname = window.location.hostname; // e.g., 'localhost' or '127.0.0.1'
        return `ws://${hostname}:8000`;
    }
    return "ws://127.0.0.1:8000";
})();

export type WsStatus = "disconnected" | "connecting" | "connected" | "error";

interface UseMarketSocketOptions {
    market: string;
    assets: string[];
    frequency?: string;
    excludeWeekends?: boolean;
    customAssets?: { label: string; source: string; symbol: string }[];
    /** Automatically connect on mount when true (default: false) */
    autoConnect?: boolean;
    /** Interval in ms between reconnect attempts (default: 5000) */
    reconnectMs?: number;
}

interface UseMarketSocketReturn {
    status: WsStatus;
    rows: SnapshotRow[];
    lastTs: string | null;
    connect: () => void;
    disconnect: () => void;
}

/**
 * React hook that opens a WebSocket to `ws://…/ws/market_data`
 * and receives live snapshot rows every ~30 s.
 *
 * Usage:
 *   const { status, rows, lastTs, connect, disconnect } = useMarketSocket({
 *     market: "indices_etfs", assets: ["S&P 500"], autoConnect: true
 *   });
 */
export function useMarketSocket({
    market,
    assets,
    frequency = "D",
    excludeWeekends = true,
    customAssets = [],
    autoConnect = false,
    reconnectMs = 5000,
}: UseMarketSocketOptions): UseMarketSocketReturn {
    const [status, setStatus] = useState<WsStatus>("disconnected");
    const [rows, setRows] = useState<SnapshotRow[]>([]);
    const [lastTs, setLastTs] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const intentionalClose = useRef(false);

    const subscriptionPayload = {
        market,
        assets,
        frequency,
        exclude_weekends: excludeWeekends,
        custom_assets: customAssets,
    };

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;
        intentionalClose.current = false;
        setStatus("connecting");

        const url = `${WS_BASE_URL}/ws/market_data`;
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            setStatus("connected");
            ws.send(JSON.stringify(subscriptionPayload));
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data as string);
                if (msg.type === "snapshot") {
                    setRows(msg.rows ?? []);
                    setLastTs(msg.ts ?? null);
                }
            } catch {
                // silently ignore malformed frames
            }
        };

        ws.onerror = () => {
            setStatus("error");
        };

        ws.onclose = () => {
            wsRef.current = null;
            if (!intentionalClose.current) {
                setStatus("disconnected");
                reconnectTimer.current = setTimeout(connect, reconnectMs);
            } else {
                setStatus("disconnected");
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [market, JSON.stringify(assets), frequency, excludeWeekends, reconnectMs]);

    const disconnect = useCallback(() => {
        intentionalClose.current = true;
        if (reconnectTimer.current) {
            clearTimeout(reconnectTimer.current);
            reconnectTimer.current = null;
        }
        wsRef.current?.close();
        wsRef.current = null;
        setStatus("disconnected");
    }, []);

    useEffect(() => {
        if (autoConnect) {
            connect();
        }
        return () => {
            intentionalClose.current = true;
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            wsRef.current?.close();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoConnect, market, JSON.stringify(assets), frequency]);

    return { status, rows, lastTs, connect, disconnect };
}
