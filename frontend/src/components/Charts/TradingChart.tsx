import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { createChart, ColorType, CandlestickSeries, createSeriesMarkers, type IChartApi, type ISeriesApi, type Time } from 'lightweight-charts';
import { useWebSocket } from '../../shared/hooks/useWebSocket';

export interface TradingChartProps {
  symbol: string;
  initialTimeframe: string;
}

export interface TradingChartHandle {
  setMarkers: (markers: any[]) => void;
  setIndicatorLines: (lines: { name: string, data: any[] }[]) => void;
  highlightTrade: (entryTime: number, exitTime: number) => void;
}

interface OHLCV {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const TradingChart = forwardRef<TradingChartHandle, TradingChartProps>(({ symbol, initialTimeframe }, ref) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [currentTimeframe, setCurrentTimeframe] = useState(initialTimeframe);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const { isConnected, lastCandle } = useWebSocket(symbol, currentTimeframe);
  const markersPluginRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    setMarkers: (markers) => {
      if (seriesRef.current) {
        // Sort markers by time as required by lightweight-charts
        const sortedMarkers = [...markers].sort((a, b) => a.time - b.time);
        
        if (!markersPluginRef.current) {
          markersPluginRef.current = createSeriesMarkers(seriesRef.current);
        }
        markersPluginRef.current.setMarkers(sortedMarkers);
      }
    },
    setIndicatorLines: (lines) => {
      // Future implementation for indicators if API provides them
      // E.g., chartRef.current.addLineSeries().setData(...)
      console.log("Setting indicator lines:", lines);
    },
    highlightTrade: (entryTime: number, exitTime: number) => {
      if (chartRef.current) {
        // Add a small buffer around the trade duration
        const buffer = (exitTime - entryTime) * 0.1;
        const from = (entryTime - buffer) as Time;
        const to = (exitTime + buffer) as Time;
        
        chartRef.current.timeScale().setVisibleRange({
          from,
          to
        });
      }
    }
  }));

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Initialize Chart
    const handleResize = () => {
      chartRef.current?.applyOptions({ width: chartContainerRef.current?.clientWidth });
    };

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#848E9C',
        fontFamily: 'JetBrains Mono, monospace',
      },
      grid: {
        vertLines: { color: 'rgba(43, 49, 57, 0.3)' },
        horzLines: { color: 'rgba(43, 49, 57, 0.3)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      localization: {
        timeFormatter: (timestamp: number) => {
          return new Date(timestamp * 1000).toLocaleString(undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
          });
        },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      }
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#0ECB81',
      downColor: '#F6465D',
      borderVisible: false,
      wickUpColor: '#0ECB81',
      wickDownColor: '#F6465D',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    window.addEventListener('resize', handleResize);

    // Fetch Data
    const fetchData = async () => {
      try {
        setLoading(true);
        // Using localhost:8000 assuming FastAPI runs on default port
        const response = await fetch(`http://localhost:8000/api/v1/market/ohlcv?symbol=${encodeURIComponent(symbol)}&timeframe=${currentTimeframe}&limit=200`);
        const data = await response.json();
        
        if (data && data.data) {
          const formattedData = data.data.map((item: OHLCV) => {
            const isUTC = !item.timestamp.includes('Z') && !item.timestamp.includes('+');
            return {
              time: (new Date(isUTC ? item.timestamp + 'Z' : item.timestamp).getTime() / 1000) as Time,
              open: item.open,
              high: item.high,
              low: item.low,
              close: item.close,
            };
          });
          // Lightweight charts requires data to be sorted by time ascending
          formattedData.sort((a: any, b: any) => a.time - b.time);
          candlestickSeries.setData(formattedData);
        }
      } catch (error) {
        console.error("Failed to fetch OHLCV data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      window.removeEventListener('resize', handleResize);
      try {
        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
        }
      } catch (err) {
        console.error("Error disposing chart:", err);
      }
    };
  }, [symbol, currentTimeframe]);

  // Update chart when a new candle arrives from WebSocket
  useEffect(() => {
    if (seriesRef.current && lastCandle) {
      const isUTC = !lastCandle.timestamp.includes('Z') && !lastCandle.timestamp.includes('+');
      seriesRef.current.update({
        time: (new Date(isUTC ? lastCandle.timestamp + 'Z' : lastCandle.timestamp).getTime() / 1000) as Time,
        open: lastCandle.open,
        high: lastCandle.high,
        low: lastCandle.low,
        close: lastCandle.close,
      });
    }
  }, [lastCandle]);

  return (
    <div className="w-full h-full relative glass-panel overflow-hidden flex flex-col">
      <div className="absolute top-6 left-6 z-10 bg-bg-panel/60 px-4 py-2 rounded-xl border border-border-subtle flex items-center gap-3 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
        <span className="font-bold text-text-main font-mono text-lg">{symbol}</span>
        <select 
          value={currentTimeframe} 
          onChange={(e) => setCurrentTimeframe(e.target.value)}
          className="text-brand-500 font-bold px-2 py-1 bg-brand-500/10 rounded-lg border-none outline-none cursor-pointer hover:bg-brand-500/20 transition-colors font-mono"
        >
          <option value="1m">1m</option>
          <option value="5m">5m</option>
          <option value="15m">15m</option>
          <option value="1h">1h</option>
          <option value="4h">4h</option>
          <option value="1d">1d</option>
        </select>
        {loading ? (
          <span className="text-xs text-text-muted animate-pulse ml-2">Loading...</span>
        ) : isConnected ? (
          <span className="text-xs text-red-500 font-bold animate-pulse ml-2 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500"></span> LIVE
          </span>
        ) : (
          <span className="text-xs text-yellow-500 font-medium ml-2">Reconnecting...</span>
        )}
      </div>
      <div ref={chartContainerRef} className="flex-1 w-full" />
    </div>
  );
});
