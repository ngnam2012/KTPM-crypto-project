import { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import { 
  createChart, 
  ColorType, 
  CandlestickSeries, 
  LineSeries, 
  HistogramSeries, 
  createSeriesMarkers, 
  type IChartApi, 
  type ISeriesApi, 
  type Time 
} from 'lightweight-charts';
import { useWebSocket } from '../../shared/hooks/useWebSocket';
import { getDeviceTimezoneOffset } from '../../shared/lib/timezone';

export interface TradingChartProps {
  symbol: string;
  initialTimeframe: string;
  autoSignals?: boolean;
  enableLiveStream?: boolean;
}

export interface TradingChartHandle {
  setMarkers: (markers: any[]) => void;
  setCandles?: (candles: any[]) => void;
  setIndicatorLines: (lines: { name: string, data: any[] }[]) => void;
  highlightTrade: (entryTime: number, exitTime: number) => void;
  fitContent?: () => void;
  clearAll?: () => void;
}

interface OHLCV {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface FormattedCandle {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export const TradingChart = forwardRef<TradingChartHandle, TradingChartProps>(({ 
  symbol, 
  initialTimeframe,
  enableLiveStream = true
}, ref) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [currentTimeframe, setCurrentTimeframe] = useState(initialTimeframe);
  const [activeMarkersCount, setActiveMarkersCount] = useState<number>(0);
  
  // Realtime header metrics
  const [latestPrice, setLatestPrice] = useState<number | null>(null);
  const [priceChangePct, setPriceChangePct] = useState<number>(0);
  const [ma20Value, setMa20Value] = useState<number | null>(null);

  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const maSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const markersPluginRef = useRef<any>(null);

  // Store externally supplied backtest markers to restore across timeframe switches
  const customMarkersRef = useRef<any[] | null>(null);

  const { isConnected, lastCandle } = useWebSocket(symbol, enableLiveStream ? currentTimeframe : '');

  // Helper: compute SMA 20
  const computeSMA = (data: FormattedCandle[], period: number = 20) => {
    const smaData: { time: Time; value: number }[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) continue;
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += data[j].close;
      }
      smaData.push({
        time: data[i].time,
        value: parseFloat((sum / period).toFixed(2))
      });
    }
    return smaData;
  };

  // Helper: compute Volume histogram
  const computeVolume = (data: FormattedCandle[]) => {
    return data.map(d => ({
      time: d.time,
      value: d.volume || Math.abs(d.close - d.open) * 100,
      color: d.close >= d.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'
    }));
  };

  const applyMarkersToSeries = useCallback((markers: any[]) => {
    if (!candlestickSeriesRef.current) return;

    const validMarkers = (markers || [])
      .filter(m => m && typeof m.time === 'number' && !isNaN(m.time))
      .sort((a, b) => a.time - b.time);

    setActiveMarkersCount(validMarkers.length);

    try {
      if (!markersPluginRef.current) {
        markersPluginRef.current = createSeriesMarkers(candlestickSeriesRef.current);
      }
      markersPluginRef.current.setMarkers(validMarkers);
    } catch (e) {
      try {
        markersPluginRef.current = createSeriesMarkers(candlestickSeriesRef.current);
        markersPluginRef.current.setMarkers(validMarkers);
      } catch (err2) {
        console.warn('Error rendering series markers:', err2);
      }
    }
  }, []);

  useImperativeHandle(ref, () => ({
    clearAll: () => {
      customMarkersRef.current = [];
      setActiveMarkersCount(0);
      try {
        if (markersPluginRef.current) {
          markersPluginRef.current.setMarkers([]);
        }
      } catch (e) {
        console.warn('Error clearing markers:', e);
      }
    },
    setMarkers: (markers) => {
      customMarkersRef.current = markers || [];
      applyMarkersToSeries(markers || []);
    },
    setCandles: (candles) => {
      if (candlestickSeriesRef.current && candles && candles.length > 0) {
        const formattedData: FormattedCandle[] = candles.map((item: any) => {
          let timeVal: number;
          if (typeof item.time === 'number') {
            timeVal = item.time > 1e11 ? Math.floor(item.time / 1000) : Math.floor(item.time);
          } else {
            const isUTC = !item.timestamp?.includes('Z') && !item.timestamp?.includes('+');
            timeVal = Math.floor(new Date(isUTC ? item.timestamp + 'Z' : item.timestamp).getTime() / 1000);
          }
          return {
            time: timeVal as Time,
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
            volume: item.volume
          };
        });
        formattedData.sort((a, b) => (a.time as number) - (b.time as number));
        candlestickSeriesRef.current.setData(formattedData);
        
        // Update indicators
        if (maSeriesRef.current) {
          maSeriesRef.current.setData(computeSMA(formattedData, 20));
        }
        if (volumeSeriesRef.current) {
          volumeSeriesRef.current.setData(computeVolume(formattedData));
        }

        if (formattedData.length > 0) {
          const first = formattedData[0];
          const last = formattedData[formattedData.length - 1];
          setLatestPrice(last.close);
          setPriceChangePct(((last.close - first.open) / first.open) * 100);
        }

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
        const duration = Math.max(exitTime - entryTime, 3600);
        const buffer = Math.max(duration * 1.5, 7200);
        const from = Math.max(0, Math.floor(entryTime - buffer)) as Time;
        const to = Math.floor(exitTime + buffer) as Time;
        
        chartRef.current.timeScale().setVisibleRange({ from, to });
      }
    },
    fitContent: () => {
      chartRef.current?.timeScale().fitContent();
    }
  }));

  // Initialize and redraw chart on symbol / timeframe change
  useEffect(() => {
    if (!chartContainerRef.current) return;

    markersPluginRef.current = null;

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
      width: chartContainerRef.current.clientWidth || 300,
      height: chartContainerRef.current.clientHeight || 300,
      localization: {
        timeFormatter: (timestamp: number) => {
          const d = new Date(timestamp * 1000);
          const month = d.toLocaleDateString('en-US', { month: 'short' });
          const day = d.getDate().toString().padStart(2, '0');
          const hh = d.getHours().toString().padStart(2, '0');
          const mm = d.getMinutes().toString().padStart(2, '0');
          return `${month} ${day}, ${hh}:${mm} ${getDeviceTimezoneOffset()}`;
        },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: 'rgba(148, 163, 184, 0.15)',
        tickMarkFormatter: (time: Time, tickMarkType: number) => {
          let timestamp: number;
          if (typeof time === 'number') {
            timestamp = time > 1e11 ? time / 1000 : time;
          } else if (typeof time === 'string') {
            timestamp = new Date(time).getTime() / 1000;
          } else {
            return '';
          }
          if (isNaN(timestamp)) return '';

          const d = new Date(timestamp * 1000);
          const hh = d.getHours().toString().padStart(2, '0');
          const mm = d.getMinutes().toString().padStart(2, '0');
          const day = d.getDate().toString().padStart(2, '0');
          const month = (d.getMonth() + 1).toString().padStart(2, '0');

          // tickMarkType: 0: Year, 1: Month, 2: DayOfMonth, 3: Time, 4: TimeWithSeconds
          if (tickMarkType === 0) {
            return d.getFullYear().toString();
          }
          if (tickMarkType === 1) {
            return d.toLocaleDateString('en-US', { month: 'short' });
          }
          if (tickMarkType === 2) {
            return `${day}/${month}`;
          }
          return `${hh}:${mm}`;
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(148, 163, 184, 0.15)',
      }
    });

    // 1. Candlestick Series
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10B981',
      downColor: '#F43F5E',
      borderVisible: false,
      wickUpColor: '#34D399',
      wickDownColor: '#F87171',
    });

    // 2. MA(20) Line Series (Cyan/Blue)
    const maSeries = chart.addSeries(LineSeries, {
      color: '#38BDF8',
      lineWidth: 2,
      priceLineVisible: false,
      title: 'MA(20)',
    });

    // 3. Volume Histogram Series
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '', // Separate scale
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.82,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    maSeriesRef.current = maSeries;
    volumeSeriesRef.current = volumeSeries;

    // Use ResizeObserver for accurate container width & height tracking
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length > 0 && chartRef.current) {
        const { width, height } = entries[0].contentRect;
        if (width > 0 && height > 0) {
          chartRef.current.applyOptions({ width, height });
        }
      }
    });

    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`http://localhost:8000/api/v1/market/ohlcv?symbol=${encodeURIComponent(symbol)}&timeframe=${currentTimeframe}&limit=200`);
        const data = await response.json();
        
        if (data && data.data && data.data.length > 0) {
          const formattedData: FormattedCandle[] = data.data.map((item: OHLCV) => {
            const isUTC = !item.timestamp.includes('Z') && !item.timestamp.includes('+');
            return {
              time: (new Date(isUTC ? item.timestamp + 'Z' : item.timestamp).getTime() / 1000) as Time,
              open: item.open,
              high: item.high,
              low: item.low,
              close: item.close,
              volume: item.volume
            };
          });
          formattedData.sort((a, b) => (a.time as number) - (b.time as number));
          
          candlestickSeries.setData(formattedData);

          // Calculate and render SMA 20 line
          const smaValues = computeSMA(formattedData, 20);
          maSeries.setData(smaValues);
          if (smaValues.length > 0) {
            setMa20Value(smaValues[smaValues.length - 1].value);
          }

          // Render Volume
          volumeSeries.setData(computeVolume(formattedData));

          // Set latest price & price change
          const firstCandle = formattedData[0];
          const lastC = formattedData[formattedData.length - 1];
          setLatestPrice(lastC.close);
          const change = ((lastC.close - firstCandle.open) / firstCandle.open) * 100;
          setPriceChangePct(change);

          // Render Visual Markers only when custom backtest markers exist
          if (customMarkersRef.current && customMarkersRef.current.length > 0) {
            applyMarkersToSeries(customMarkersRef.current);
          } else {
            setActiveMarkersCount(0);
          }
        }
      } catch (error) {
        console.error("Failed to fetch OHLCV data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      resizeObserver.disconnect();
      try {
        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
        }
      } catch (err) {
        console.error("Error disposing chart:", err);
      }
    };
  }, [symbol, currentTimeframe, applyMarkersToSeries]);

  // Real-time tick update from WebSocket
  useEffect(() => {
    if (candlestickSeriesRef.current && lastCandle) {
      const isUTC = !lastCandle.timestamp.includes('Z') && !lastCandle.timestamp.includes('+');
      const timeVal = (new Date(isUTC ? lastCandle.timestamp + 'Z' : lastCandle.timestamp).getTime() / 1000) as Time;
      
      candlestickSeriesRef.current.update({
        time: timeVal,
        open: lastCandle.open,
        high: lastCandle.high,
        low: lastCandle.low,
        close: lastCandle.close,
      });

      setLatestPrice(lastCandle.close);
    }
  }, [lastCandle]);

  return (
    <div className="w-full h-full relative glass-panel overflow-hidden flex flex-col select-none">
      {/* Top Left Symbol & Timeframe Control with Live Metrics */}
      <div className="absolute top-2.5 left-2.5 z-10 bg-bg-panel/90 px-2.5 py-1 rounded-xl border border-border-subtle flex items-center gap-2 backdrop-blur-xl shadow-lg max-w-[calc(100%-20px)] flex-wrap">
        <span className="font-extrabold text-text-main font-mono text-xs">{symbol}</span>
        
        {/* Timeframe Dropdown */}
        <select 
          value={currentTimeframe} 
          onChange={(e) => setCurrentTimeframe(e.target.value)}
          className="text-brand-400 font-bold px-1.5 py-0.5 bg-bg-surface hover:bg-bg-hover rounded-lg border border-border-subtle outline-none cursor-pointer transition-colors font-mono text-[11px]"
        >
          <option value="1m">1m</option>
          <option value="5m">5m</option>
          <option value="15m">15m</option>
          <option value="1h">1h</option>
          <option value="4h">4h</option>
          <option value="1d">1d</option>
        </select>

        {/* Live Price & Change Badge */}
        {latestPrice !== null && (
          <div className="flex items-center gap-1.5 border-l border-border-subtle pl-1.5 font-mono text-xs">
            <span className="font-bold text-text-main">
              ${latestPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`text-[10px] font-bold ${priceChangePct >= 0 ? 'text-bullish-bright' : 'text-bearish-bright'}`}>
              {priceChangePct >= 0 ? '+' : ''}{priceChangePct.toFixed(2)}%
            </span>
          </div>
        )}

        {/* MA(20) Pill */}
        {ma20Value !== null && (
          <span className="hidden sm:inline-block text-[9px] px-1.5 py-0.5 rounded bg-accent-blue/15 text-accent-blue font-mono font-semibold border border-accent-blue/30">
            MA(20): ${ma20Value.toLocaleString()}
          </span>
        )}

        {/* WebSocket Connection Status */}
        {loading ? (
          <span className="text-[10px] text-text-muted animate-pulse font-mono">Loading...</span>
        ) : isConnected ? (
          <span className="text-[10px] text-bullish-bright font-bold font-mono flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-bullish-bright animate-ping"></span> LIVE
          </span>
        ) : (
          <span className="text-[10px] text-brand-400 font-medium font-mono">Reconnecting...</span>
        )}
      </div>

      {/* Top Right Signal Legend Overlay (Rendered only when active backtest trade markers exist) */}
      {activeMarkersCount > 0 && (
        <div className="absolute top-2.5 right-2.5 z-10 hidden sm:flex items-center gap-2 bg-bg-panel/90 px-2.5 py-1 rounded-xl border border-border-subtle backdrop-blur-xl shadow-lg text-[10px] font-mono select-none">
          <span className="flex items-center gap-1 text-bullish-bright font-bold">
            <span>▲ LONG</span>
          </span>
          <span className="text-border-subtle">|</span>
          <span className="flex items-center gap-1 text-bearish-bright font-bold">
            <span>▼ SHORT</span>
          </span>
          <span className="text-border-subtle">|</span>
          <span className="flex items-center gap-1 text-brand-400 font-medium">
            <span>● EXIT (TP/SL)</span>
          </span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full bg-brand-500/20 text-brand-400 font-bold border border-brand-500/40 text-[9px]">
            {activeMarkersCount} Trades
          </span>
        </div>
      )}

      <div ref={chartContainerRef} className="flex-1 w-full min-h-0" />
    </div>
  );
});
