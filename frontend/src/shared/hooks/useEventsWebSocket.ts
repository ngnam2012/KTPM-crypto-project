import { useState, useEffect, useRef } from 'react';

export const useEventsWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<{ event: string; data: any } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    let backoff = 1000;

    const connect = () => {
      const wsUrl = `ws://localhost:8000/ws/events`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isMounted) {
          setIsConnected(true);
          backoff = 1000;
          console.log(`Connected to System Events WS`);
        }
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data);
          if (data.event && data.data) {
            setLastEvent(data);
          }
        } catch (e) {
          console.error("Failed to parse WS message", e);
        }
      };

      ws.onclose = () => {
        if (!isMounted) return;
        setIsConnected(false);
        console.log(`System Events WS closed. Reconnecting in ${backoff}ms...`);
        reconnectTimeoutRef.current = window.setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 30000);
      };

      ws.onerror = (err) => {
        console.error(`System Events WS error:`, err);
        ws.close();
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
  }, []);

  return { isConnected, lastEvent };
};
