import { useState, useEffect, useRef } from 'react';

export interface WSCandle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  is_closed: boolean;
}

export const useWebSocket = (symbol: string, timeframe: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastCandle, setLastCandle] = useState<WSCandle | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    let backoff = 1000;

    const connect = () => {
      // Use standard WebSocket
      const symbolParam = encodeURIComponent(symbol);
      const wsUrl = `ws://localhost:8000/ws/market?symbol=${symbolParam}&interval=${timeframe}`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isMounted) {
          setIsConnected(true);
          backoff = 1000; // Reset backoff on successful connect
          console.log(`Connected to WS for ${symbol} ${timeframe}`);
        }
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'candle' && data.data) {
            setLastCandle(data.data);
          }
        } catch (e) {
          console.error("Failed to parse WS message", e);
        }
      };

      ws.onclose = () => {
        if (!isMounted) return;
        setIsConnected(false);
        console.log(`WS connection closed for ${symbol} ${timeframe}. Reconnecting in ${backoff}ms...`);
        // Exponential backoff capped at 30 seconds
        reconnectTimeoutRef.current = window.setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 30000);
      };

      ws.onerror = (err) => {
        console.error(`WS error for ${symbol} ${timeframe}:`, err);
        ws.close(); // Force onclose to handle reconnect
      };
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [symbol, timeframe]);

  return { isConnected, lastCandle };
};
