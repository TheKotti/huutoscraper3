import { useEffect, useRef, useCallback, useState } from "react";
import type { ClientMessage, ServerMessage, Listing, ScrapeResult } from "../types";

export interface WsState {
  connected: boolean;
  scraping: boolean;
  results: ScrapeResult[];
  error: string | null;
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<WsState>({
    connected: false,
    scraping: false,
    results: [],
    error: null,
  });

  useEffect(() => {
    function connect() {
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        setState((s) => ({ ...s, connected: true, error: null }));
      };

      ws.onclose = () => {
        setState((s) => ({ ...s, connected: false }));
        setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onmessage = (event) => {
        const msg: ServerMessage = JSON.parse(event.data);

        setState((prev) => {
          switch (msg.type) {
            case "scrape_start":
              return { ...prev, scraping: true, error: null };
            case "scrape_result":
              return { ...prev, scraping: false, results: msg.results };
            case "error":
              return { ...prev, scraping: false, error: msg.message };
            default:
              return prev;
          }
        });
      };
    }

    connect();
    return () => {
      wsRef.current?.close();
    };
  }, []);

  const subscribe = useCallback((urls: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "subscribe", urls } satisfies ClientMessage));
    }
  }, []);

  return { ...state, subscribe };
}
