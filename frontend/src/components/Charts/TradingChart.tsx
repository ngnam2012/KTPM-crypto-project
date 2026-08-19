import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { createChart, ColorType, CandlestickSeries, createSeriesMarkers, type IChartApi, type ISeriesApi, type Time } from 'lightweight-charts';
import { useWebSocket } from '../../shared/hooks/useWebSocket';
import { getDeviceTimezoneOffset } from '../../shared/lib/timezone';

export interface TradingChartProps {
  symbol: string;
  initialTimeframe: string;
}

export interface TradingChartHandle {
  setMarkers: (markers: any[]) => void;
  setCandles?: (candles: any[]) => void;
  setIndicatorLines: (lines: { name: string, data: any[] }[]) => void;
  highlightTrade: (entryTime: number, exitTime: number) => void;
  fitContent?: () => void;
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
  const [activeMarkersCount, setActiveMarkersCount] = useState<number>(0);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const { isConnected, lastCandle } = useWebSocket(symbol, currentTimeframe);
  const markersPluginRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    setMarkers: (markers) => {
      if (seriesRef.current) {
        // Filter and sort markers by time ascending as required by lightweight-charts
        const validMarkers = (markers || [])
          .filter(m => m && typeof m.time === 'number' && !isNaN(m.time))
          .sort((a, b) => a.time - b.time);
        
        setActiveMarkersCount(validMarkers.length);

        if (!markersPluginRef.current) {
          markersPluginRef.current = createSeriesMarkers(seriesRef.current);
        }
        markersPluginRef.current.setMarkers(validMarkers);
      }
    },
    setCandles: (candles) => {
      if (seriesRef.current && candles && candles.length > 0) {
        const formattedData = candles.map((item: any) => {
          let timeVal: number;
          if (typeof item.time === 'number') {
            timeVal = item.time > 1e11 ? item.time / 1000 : item.time;
          } else {
            const isUTC = !item.timestamp.includes('Z') && !item.timestamp.includes('+');
            timeVal = new Date(isUTC ? item.timestamp + 'Z' : item.timestamp).getTime() / 1000;
          }
          return {
            time: timeVal as Time,
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
          };
        });
        formattedData.sort((a: any, b: any) => (a.time as number) - (b.time as number));
        seriesRef.current.setData(formattedData);
        if (chartRef.current) {
          chartRef.current.timeScale().fitContent();
        }
      }
    },
    setIndicatorLines: (lines) => {
      console.log("Setting indicator lines:", lines);
    },
    highlightTrade: (entryTime: number, exitTime: number) => {
      if (chartRef.current) {
        const duration = Math.max(exitTime - entryTime, 1800);
        const buffer = duration * 0.4;
        const from = Math.max(0, (entryTime - buffer)) as Time;
        const to = (exitTime + buffer) as Time;
        
        chartRef.current.timeScale().setVisibleRange({
          from,
          to
        });
      }
    },
    fitContent: () => {
      chartRef.current?.timeScale().fitContent();
    }
  }));

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const handleResize = () => {
      chartRef.current?.applyOptions({ width: chartContainerRef.current?.clientWidth });
    };

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94A3B8',
        fontFamily: 'JetBrains Mono, monospace',
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.08)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.08)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      localization: {
        timeFormatter: (timestamp: number) => {
          return new Date(timestamp * 1000).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }) + ' ' + getDeviceTimezoneOffset();
        },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: 'rgba(148, 163, 184, 0.15)',
      },
      rightPriceScale: {
        borderColor: 'rgba(148, 163, 184, 0.15)',
      }
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10B981',
      downColor: '#F43F5E',
      borderVisible: false,
      wickUpColor: '#34D399',
      wickDownColor: '#F87171',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    window.addEventListener('resize', handleResize);

    const fetchData = async () => {
      try {
        setLoading(true);
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
          formattedData.sort((a: any, b: any) => (a.time as number) - (b.time as number));
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

  // Real-time tick update from WebSocket
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
      <div className="absolute top-4 left-4 z-10 bg-bg-panel/80 px-3.5 py-1.5 rounded-xl border border-border-subtle flex items-center gap-3 backdrop-blur-xl shadow-md">
        <span className="font-bold text-text-main font-mono text-sm">{symbol}</span>
        <select 
          value={currentTimeframe} 
          onChange={(e) => setCurrentTimeframe(e.target.value)}
          className="text-brand-400 font-bold px-2 py-0.5 bg-bg-surface rounded-lg border border-border-subtle outline-none cursor-pointer hover:bg-bg-hover transition-colors font-mono text-xs"
        >
          <option value="1m">1m</option>
          <option value="5m">5m</option>
          <option value="15m">15m</option>
          <option value="1h">1h</option>
          <option value="4h">4h</option>
          <option value="1d">1d</option>
        </select>
        {loading ? (
          <span className="text-[11px] text-text-muted animate-pulse font-mono">Loading...</span>
        ) : isConnected ? (
          <span className="text-[11px] text-bullish-bright font-bold animate-pulse font-mono flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-bullish-bright"></span> LIVE
          </span>
        ) : (
          <span className="text-[11px] text-brand-400 font-medium font-mono">Reconnecting...</span>
        )}
      </div>

      {/* Top Right Signal Legend Overlay */}
      <div className="absolute top-4 right-4 z-10 hidden sm:flex items-center gap-2.5 bg-bg-panel/85 px-3.5 py-1.5 rounded-xl border border-border-subtle backdrop-blur-xl shadow-md text-[11px] font-mono select-none">
        <span className="flex items-center gap-1.5 text-bullish-bright font-semibold">
          <span className="inline-block w-2 h-2 rounded-full bg-bullish-bright"></span>
          ▲ LONG
        </span>
        <span className="text-border-subtle">|</span>
        <span className="flex items-center gap-1.5 text-bearish-bright font-semibold">
          <span className="inline-block w-2 h-2 rounded-full bg-bearish-bright"></span>
          ▼ SHORT
        </span>
        <span className="text-border-subtle">|</span>
        <span className="flex items-center gap-1 text-text-muted">
          <span>EXIT (TP/SL)</span>
        </span>
        {activeMarkersCount > 0 && (
          <span className="ml-1 px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-400 font-bold border border-brand-500/30 text-[10px]">
            {activeMarkersCount} markers
          </span>
        )}
      </div>

      <div ref={chartContainerRef} className="flex-1 w-full" />
    </div>
  );
});
