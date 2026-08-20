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
  autoSignals?: boolean; // Enable automatic technical LONG/SHORT/EXIT markers
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
  autoSignals = true 
}, ref) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [currentTimeframe, setCurrentTimeframe] = useState(initialTimeframe);
  const [activeMarkersCount, setActiveMarkersCount] = useState<number>(0);
  
  // Realtime header metrics
  const [latestPrice, setLatestPrice] = useState<number | null>(null);
  const [priceChangePct, setPriceChangePct] = useState<number>(0);
  const [ma20Value, setMa20Value] = useState<number | null>(null);
  const [activeSignal, setActiveSignal] = useState<'BUY' | 'SELL' | 'HOLD'>('HOLD');

  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const maSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const markersPluginRef = useRef<any>(null);

  // Store externally supplied or calculated markers to restore across timeframe switches
  const customMarkersRef = useRef<any[] | null>(null);

  const { isConnected, lastCandle } = useWebSocket(symbol, currentTimeframe);

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

  // Helper: Generate technical LONG / SHORT / EXIT markers if no custom markers are provided
  const generateLiveSignals = (data: FormattedCandle[]): any[] => {
    if (data.length < 25) return [];
    const markers: any[] = [];
    let currentPosition: 'LONG' | 'SHORT' | null = null;
    let entryPrice = 0;
    let entryTime: number = 0;

    for (let i = 20; i < data.length; i++) {
      const c = data[i];
      const prevC = data[i - 1];
      const t = c.time as number;

      // Simple 10/20 Exponential/Simple crossover & momentum detector
      let sumFast = 0;
      let sumSlow = 0;
      for (let j = i - 9; j <= i; j++) sumFast += data[j].close;
      for (let j = i - 19; j <= i; j++) sumSlow += data[j].close;
      const maFast = sumFast / 10;
      const maSlow = sumSlow / 20;

      let prevSumFast = 0;
      let prevSumSlow = 0;
      for (let j = i - 10; j <= i - 1; j++) prevSumFast += data[j].close;
      for (let j = i - 20; j <= i - 1; j++) prevSumSlow += data[j].close;
      const prevMaFast = prevSumFast / 10;
      const prevMaSlow = prevSumSlow / 20;

      const isBullishCross = prevMaFast <= prevMaSlow && maFast > maSlow;
      const isBearishCross = prevMaFast >= prevMaSlow && maFast < maSlow;

      // LONG Entry
      if (isBullishCross && currentPosition !== 'LONG') {
        // If holding SHORT, exit first
        if (currentPosition === 'SHORT') {
          const profitPct = ((entryPrice - c.close) / entryPrice) * 100;
          markers.push({
            time: t,
            position: 'belowBar',
            color: profitPct >= 0 ? '#10B981' : '#F43F5E',
            shape: 'arrowUp',
            text: `EXIT SHORT (${profitPct >= 0 ? '+' : ''}${profitPct.toFixed(2)}%)`
          });
        }

        currentPosition = 'LONG';
        entryPrice = c.close;
        entryTime = t;
        markers.push({
          time: t,
          position: 'belowBar',
          color: '#10B981',
          shape: 'arrowUp',
          text: `▲ LONG Entry @ $${c.close.toLocaleString()}`
        });
      }
      // SHORT Entry
      else if (isBearishCross && currentPosition !== 'SHORT') {
        // If holding LONG, exit first
        if (currentPosition === 'LONG') {
          const profitPct = ((c.close - entryPrice) / entryPrice) * 100;
          markers.push({
            time: t,
            position: 'aboveBar',
            color: profitPct >= 0 ? '#10B981' : '#F43F5E',
            shape: 'arrowDown',
            text: `EXIT LONG (${profitPct >= 0 ? '+' : ''}${profitPct.toFixed(2)}%)`
          });
        }

        currentPosition = 'SHORT';
        entryPrice = c.close;
        entryTime = t;
        markers.push({
          time: t,
          position: 'aboveBar',
          color: '#F43F5E',
          shape: 'arrowDown',
          text: `▼ SHORT Entry @ $${c.close.toLocaleString()}`
        });
      }
      // Dynamic Take Profit / Stop Loss Exit
      else if (currentPosition === 'LONG') {
        const gainPct = ((c.close - entryPrice) / entryPrice) * 100;
        if (gainPct >= 3.5 || gainPct <= -2.0) {
          markers.push({
            time: t,
            position: 'aboveBar',
            color: gainPct >= 0 ? '#10B981' : '#F43F5E',
            shape: 'circle',
            text: `EXIT (${gainPct >= 0 ? 'TP +' : 'SL '}${gainPct.toFixed(2)}%)`
          });
          currentPosition = null;
        }
      }
      else if (currentPosition === 'SHORT') {
        const gainPct = ((entryPrice - c.close) / entryPrice) * 100;
        if (gainPct >= 3.5 || gainPct <= -2.0) {
          markers.push({
            time: t,
            position: 'belowBar',
            color: gainPct >= 0 ? '#10B981' : '#F43F5E',
            shape: 'circle',
            text: `EXIT (${gainPct >= 0 ? 'TP +' : 'SL '}${gainPct.toFixed(2)}%)`
          });
          currentPosition = null;
        }
      }
    }

    return markers;
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
      console.warn('Error rendering series markers:', e);
    }
  }, []);

  useImperativeHandle(ref, () => ({
    setMarkers: (markers) => {
      customMarkersRef.current = markers;
      applyMarkersToSeries(markers);
    },
    setCandles: (candles) => {
      if (candlestickSeriesRef.current && candles && candles.length > 0) {
        const formattedData: FormattedCandle[] = candles.map((item: any) => {
          let timeVal: number;
          if (typeof item.time === 'number') {
            timeVal = item.time > 1e11 ? item.time / 1000 : item.time;
          } else {
            const isUTC = !item.timestamp?.includes('Z') && !item.timestamp?.includes('+');
            timeVal = new Date(isUTC ? item.timestamp + 'Z' : item.timestamp).getTime() / 1000;
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

    window.addEventListener('resize', handleResize);

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

          // Render Visual Markers (Custom Backtest or Live Auto-Signals)
          if (customMarkersRef.current && customMarkersRef.current.length > 0) {
            applyMarkersToSeries(customMarkersRef.current);
          } else if (autoSignals) {
            const liveSignals = generateLiveSignals(formattedData);
            applyMarkersToSeries(liveSignals);

            // Determine latest active signal
            if (liveSignals.length > 0) {
              const lastSig = liveSignals[liveSignals.length - 1];
              if (lastSig.text.includes('LONG')) setActiveSignal('BUY');
              else if (lastSig.text.includes('SHORT')) setActiveSignal('SELL');
              else setActiveSignal('HOLD');
            }
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
  }, [symbol, currentTimeframe, autoSignals, applyMarkersToSeries]);

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
    <div className="w-full h-full relative glass-panel overflow-hidden flex flex-col">
      {/* Top Left Symbol & Timeframe Control with Live Metrics */}
      <div className="absolute top-3 left-3 z-10 bg-bg-panel/90 px-3 py-1.5 rounded-xl border border-border-subtle flex items-center gap-2.5 backdrop-blur-xl shadow-lg">
        <span className="font-extrabold text-text-main font-mono text-xs md:text-sm">{symbol}</span>
        
        {/* Timeframe Dropdown */}
        <select 
          value={currentTimeframe} 
          onChange={(e) => setCurrentTimeframe(e.target.value)}
          className="text-brand-400 font-bold px-2 py-0.5 bg-bg-surface hover:bg-bg-hover rounded-lg border border-border-subtle outline-none cursor-pointer transition-colors font-mono text-xs"
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
          <div className="hidden md:flex items-center gap-2 border-l border-border-subtle pl-2 font-mono text-xs">
            <span className="font-extrabold text-text-main">
              ${latestPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`text-[11px] font-bold ${priceChangePct >= 0 ? 'text-bullish-bright' : 'text-bearish-bright'}`}>
              {priceChangePct >= 0 ? '+' : ''}{priceChangePct.toFixed(2)}%
            </span>
          </div>
        )}

        {/* MA(20) Pill */}
        {ma20Value !== null && (
          <span className="hidden xl:inline-block text-[10px] px-1.5 py-0.5 rounded bg-accent-blue/15 text-accent-blue font-mono font-semibold border border-accent-blue/30">
            MA(20): ${ma20Value.toLocaleString()}
          </span>
        )}

        {/* Active Signal Pill */}
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider font-mono shadow-sm ${
          activeSignal === 'BUY'
            ? 'bg-bullish/20 text-bullish-bright border border-bullish/40'
            : activeSignal === 'SELL'
            ? 'bg-bearish/20 text-bearish-bright border border-bearish/40'
            : 'bg-bg-surface text-text-muted border border-border-subtle'
        }`}>
          {activeSignal}
        </span>

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

      {/* Top Right Signal Legend Overlay */}
      <div className="absolute top-3 right-3 z-10 hidden sm:flex items-center gap-2 bg-bg-panel/90 px-3 py-1.5 rounded-xl border border-border-subtle backdrop-blur-xl shadow-lg text-[11px] font-mono select-none">
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
        {activeMarkersCount > 0 && (
          <span className="ml-1 px-2 py-0.2 rounded-full bg-brand-500/20 text-brand-400 font-bold border border-brand-500/40 text-[10px]">
            {activeMarkersCount} Signals
          </span>
        )}
      </div>

      <div ref={chartContainerRef} className="flex-1 w-full" />
    </div>
  );
});
