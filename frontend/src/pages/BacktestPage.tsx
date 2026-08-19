import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  FlaskConical, 
  Sparkles, 
  Globe, 
  Calendar, 
  DollarSign, 
  Sliders, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  Activity, 
  Layers, 
  Check, 
  X,
  RefreshCw,
  Award
} from 'lucide-react';
import { TradingChart, type TradingChartHandle } from '../components/Charts/TradingChart';
import { TradeDetailTable, type TradeRecord } from '../components/TradeDetailTable';

interface StrategyMetadata {
  id: string;
  name: string;
  description: string;
  default_params: Record<string, any>;
}

interface BacktestMetrics {
  total_return: number;
  total_profit_usd: number;
  max_drawdown: number;
  winrate: number;
  wins_count: number;
  losses_count: number;
  total_trades: number;
  profit_factor: number;
  sharpe_ratio: number;
  initial_capital: number;
  total_fees_usd: number;
  total_slippage_usd: number;
}

export const BacktestPage: React.FC = () => {
  // Available strategies from backend
  const [availableStrategies, setAvailableStrategies] = useState<StrategyMetadata[]>([]);
  
  // Backtest Parameters
  const [symbol, setSymbol] = useState("BTC/USDT");
  const [timeframe, setTimeframe] = useState("15m");
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>(["ma_crossover"]);
  const [compositeLogic, setCompositeLogic] = useState<"AND" | "OR" | "WEIGHTED">("AND");
  const [strategyWeights, setStrategyWeights] = useState<Record<string, number>>({});
  const [initialCapital, setInitialCapital] = useState<number>(100);
  const [feePct, setFeePct] = useState<number>(0.05);
  const [slippageBps, setSlippageBps] = useState<number>(5.0);
  
  // Date Range (from - to)
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [candleLimit, setCandleLimit] = useState<number>(2000);

  // Risk Management
  const [takeProfitPct, setTakeProfitPct] = useState<string>("");
  const [stopLossPct, setStopLossPct] = useState<string>("");
  const [trailingStopPct, setTrailingStopPct] = useState<string>("");

  // Results State
  const [metrics, setMetrics] = useState<BacktestMetrics | null>(null);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Modals
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [aiPrompt, setAiPrompt] = useState<string>("");
  const [aiSourceUrl, setAiSourceUrl] = useState<string>("");
  const [aiLoading, setAiLoading] = useState<boolean>(false);

  const [isCrawlerModalOpen, setIsCrawlerModalOpen] = useState<boolean>(false);
  const [crawlerUrl, setCrawlerUrl] = useState<string>("");
  const [crawlerResult, setCrawlerResult] = useState<any>(null);
  const [crawlerLoading, setCrawlerLoading] = useState<boolean>(false);

  const chartRef = useRef<TradingChartHandle>(null);

  // Fetch available strategies on mount
  useEffect(() => {
    fetch('http://localhost:8000/api/v1/strategies')
      .then(res => res.json())
      .then(data => {
        if (data && data.strategies) {
          setAvailableStrategies(data.strategies);
        }
      })
      .catch(err => console.error("Error fetching strategies:", err));
  }, []);

  const toggleStrategy = (id: string) => {
    setSelectedStrategies(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const setDatePreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
  };

  const handleRunBacktest = async () => {
    if (selectedStrategies.length === 0) {
      setToast({ message: "Please select at least 1 strategy to backtest.", type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        strategies: selectedStrategies.map(id => ({
          id,
          params: compositeLogic === "WEIGHTED" ? { weight: strategyWeights[id] || 0.5 } : {}
        })),
        logic: compositeLogic,
        symbol: symbol,
        timeframe: timeframe,
        limit: candleLimit,
        initial_capital: Number(initialCapital) || 100,
        fee_pct: Number(feePct) || 0.05,
        slippage_bps: Number(slippageBps) || 5.0,
        start_date: startDate ? new Date(startDate).toISOString() : null,
        end_date: endDate ? new Date(endDate).toISOString() : null,
        take_profit_pct: takeProfitPct ? parseFloat(takeProfitPct) : null,
        stop_loss_pct: stopLossPct ? parseFloat(stopLossPct) : null,
        trailing_stop_pct: trailingStopPct ? parseFloat(trailingStopPct) : null
      };

      const res = await fetch("http://localhost:8000/api/v1/backtest/run-with-trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Backtest execution failed.");
      }

      const data = await res.json();
      if (data.metrics) {
        setMetrics(data.metrics);
      }
      if (data.trades) {
        setTrades(data.trades);
      }
      if (data.ohlcv && chartRef.current?.setCandles) {
        chartRef.current.setCandles(data.ohlcv);
      }
      if (data.markers && chartRef.current) {
        chartRef.current.setMarkers(data.markers);
      }

      setToast({ message: `Backtest executed successfully! (${data.trades?.length || 0} trades visualized on chart)`, type: 'success' });
      setTimeout(() => setToast(null), 3500);
    } catch (err: any) {
      console.error(err);
      setToast({ message: err.message || 'Error running backtest', type: 'error' });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleTradeClick = (trade: TradeRecord) => {
    setSelectedTradeId(trade.id || null);
    if (chartRef.current) {
      const isEntryUTC = !trade.entry_time.includes('Z') && !trade.entry_time.includes('+');
      const isExitUTC = !trade.exit_time.includes('Z') && !trade.exit_time.includes('+');
      const entryTime = new Date(isEntryUTC ? trade.entry_time + 'Z' : trade.entry_time).getTime() / 1000;
      const exitTime = new Date(isExitUTC ? trade.exit_time + 'Z' : trade.exit_time).getTime() / 1000;
      chartRef.current.highlightTrade(entryTime, exitTime);
    }
  };

  const handleGenerateAiStrategy = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/v1/custom-strategies/generate-from-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt, source_url: aiSourceUrl || null })
      });
      if (!res.ok) throw new Error("Failed to parse prompt into strategy schema.");
      const data = await res.json();
      
      const stratIds = data.strategies.map((s: any) => s.id);
      setSelectedStrategies(stratIds);
      if (data.logic) setCompositeLogic(data.logic);

      setToast({ message: `Successfully generated: ${data.name}!`, type: 'success' });
      setIsAiModalOpen(false);
      setAiPrompt("");
      setAiSourceUrl("");
      setTimeout(() => setToast(null), 4000);
    } catch (e: any) {
      setToast({ message: e.message || "AI Strategy generation error", type: 'error' });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setAiLoading(false);
    }
  };

  const handleCrawlNews = async () => {
    if (!crawlerUrl.trim()) return;
    setCrawlerLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/v1/custom-strategies/crawl-news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: crawlerUrl })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Unable to crawl this URL.");
      }
      const data = await res.json();
      setCrawlerResult(data);
      setToast({ message: "Article extracted and tag schema saved successfully!", type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (e: any) {
      setToast({ message: e.message || "News crawler error", type: 'error' });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setCrawlerLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-[1750px] mx-auto space-y-6 text-text-main min-h-screen flex flex-col">
      {/* Header Bar */}
      {/* Top Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-bg-panel/80 p-5 rounded-2xl border border-border-subtle backdrop-blur-xl shadow-lg shrink-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-500/10 text-brand-400 rounded-xl border border-brand-500/20 shrink-0">
              <FlaskConical className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-text-main flex items-center gap-2 flex-wrap">
                Backtest Workbench
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-bullish/15 text-bullish-bright border border-bullish/30 font-mono">
                  QUANTITATIVE SIMULATOR
                </span>
              </h1>
              <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                Simulate single and composite trading strategies with 5bps slippage, transaction cost modeling, and Stop Loss / Take Profit rules.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Tools */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0 w-full xl:w-auto">
          <button
            onClick={() => setIsAiModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2.5 bg-accent-purple/10 hover:bg-accent-purple/20 text-accent-purple border border-accent-purple/30 rounded-xl font-medium text-xs transition-all duration-200 hover:scale-[1.02] whitespace-nowrap"
          >
            <Sparkles size={16} />
            <span>AI Strategy Prompt</span>
          </button>

          <button
            onClick={() => setIsCrawlerModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2.5 bg-accent-blue/10 hover:bg-accent-blue/20 text-accent-blue border border-accent-blue/30 rounded-xl font-medium text-xs transition-all duration-200 hover:scale-[1.02] whitespace-nowrap"
          >
            <Globe size={16} />
            <span>Smart News Crawler</span>
          </button>

          <button
            onClick={handleRunBacktest}
            disabled={loading}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-bg-deep font-bold rounded-xl text-xs transition-all duration-200 shadow-md shadow-brand-500/20 cursor-pointer whitespace-nowrap shrink-0 ${
              loading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02]'
            }`}
          >
            <Play size={16} fill="currentColor" />
            <span>{loading ? 'Evaluating...' : 'Run Backtest'}</span>
          </button>
        </div>
      </div>

      {/* Configuration Panel */}
      <div className="bg-bg-panel/70 border border-border-subtle rounded-2xl p-5 backdrop-blur-md shadow-md space-y-4 shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Pair/Coin */}
          <div>
            <label className="text-xs font-semibold text-text-muted mb-1.5 flex items-center gap-1">
              <DollarSign size={14} className="text-brand-400" />
              <span>1. Trading Pair</span>
            </label>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full bg-bg-deep border border-border-subtle text-text-main text-xs font-bold rounded-xl p-2.5 outline-none focus:border-brand-400"
            >
              <option value="BTC/USDT">BTC/USDT</option>
              <option value="ETH/USDT">ETH/USDT</option>
              <option value="SOL/USDT">SOL/USDT</option>
              <option value="BNB/USDT">BNB/USDT</option>
              <option value="XRP/USDT">XRP/USDT</option>
              <option value="ADA/USDT">ADA/USDT</option>
              <option value="DOGE/USDT">DOGE/USDT</option>
              <option value="AVAX/USDT">AVAX/USDT</option>
            </select>
          </div>

          {/* Timeframe */}
          <div>
            <label className="text-xs font-semibold text-text-muted mb-1.5 flex items-center gap-1">
              <Clock size={14} className="text-brand-400" />
              <span>2. Timeframe</span>
            </label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="w-full bg-bg-deep border border-border-subtle text-text-main text-xs font-bold rounded-xl p-2.5 outline-none focus:border-brand-400"
            >
              <option value="1m">1m (Scalping)</option>
              <option value="5m">5m (Fast)</option>
              <option value="15m">15m (Recommended)</option>
              <option value="1h">1h (Standard)</option>
              <option value="4h">4h (Swing)</option>
              <option value="1d">1d (Macro Position)</option>
            </select>
          </div>

          {/* Initial Capital ($100 default) */}
          <div>
            <label className="text-xs font-semibold text-text-muted mb-1.5 flex items-center gap-1">
              <DollarSign size={14} className="text-bullish-bright" />
              <span>3. Initial Capital ($)</span>
            </label>
            <input
              type="number"
              value={initialCapital}
              onChange={(e) => setInitialCapital(parseFloat(e.target.value) || 100)}
              min="10"
              step="10"
              className="w-full bg-bg-deep border border-border-subtle text-text-main text-xs font-mono font-bold rounded-xl p-2.5 outline-none focus:border-brand-400"
              placeholder="100"
            />
          </div>

          {/* Transaction Fee & Slippage */}
          <div>
            <label className="text-xs font-semibold text-text-muted mb-1.5 flex items-center gap-1">
              <ShieldAlert size={14} className="text-brand-400" />
              <span>4. Fee & Slippage</span>
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={feePct}
                onChange={(e) => setFeePct(parseFloat(e.target.value) || 0.05)}
                step="0.01"
                className="w-1/2 bg-bg-deep border border-border-subtle text-text-main text-xs font-mono rounded-xl p-2.5 outline-none focus:border-brand-400"
                title="Trading Fee (% per order)"
                placeholder="0.05%"
              />
              <input
                type="number"
                value={slippageBps}
                onChange={(e) => setSlippageBps(parseFloat(e.target.value) || 5.0)}
                step="1"
                className="w-1/2 bg-bg-deep border border-border-subtle text-text-main text-xs font-mono rounded-xl p-2.5 outline-none focus:border-brand-400"
                title="Slippage (bps) - Default 5bps = 0.05%"
                placeholder="5 bps"
              />
            </div>
          </div>

          {/* Date Range (From - To) */}
          <div className="lg:col-span-2">
            <label className="text-xs font-semibold text-text-muted mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Calendar size={14} className="text-brand-400" />
                <span>5. Date Range (From - To)</span>
              </span>
              <span className="flex gap-1 font-mono">
                <button onClick={() => setDatePreset(7)} className="text-[10px] px-1.5 py-0.5 bg-bg-deep rounded hover:text-brand-400">7D</button>
                <button onClick={() => setDatePreset(30)} className="text-[10px] px-1.5 py-0.5 bg-bg-deep rounded hover:text-brand-400">30D</button>
                <button onClick={() => setDatePreset(90)} className="text-[10px] px-1.5 py-0.5 bg-bg-deep rounded hover:text-brand-400">90D</button>
                <button onClick={() => { setStartDate(''); setEndDate(''); }} className="text-[10px] px-1.5 py-0.5 bg-bg-deep rounded hover:text-brand-400">ALL</button>
              </span>
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-1/2 bg-bg-deep border border-border-subtle text-text-main text-xs rounded-xl p-2.5 outline-none focus:border-brand-400"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-1/2 bg-bg-deep border border-border-subtle text-text-main text-xs rounded-xl p-2.5 outline-none focus:border-brand-400"
              />
            </div>
          </div>
        </div>

        {/* Risk Management Row: Stop Loss, Take Profit, Trailing Stop */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-border-subtle/50">
          <div>
            <label className="text-xs font-semibold text-bearish-bright mb-1 flex items-center gap-1">
              <ShieldAlert size={14} className="text-bearish-bright" />
              <span>Stop Loss (%)</span>
            </label>
            <input
              type="number"
              value={stopLossPct}
              onChange={(e) => setStopLossPct(e.target.value)}
              step="0.5"
              min="0.1"
              placeholder="e.g. 2 (for 2%)"
              className="w-full bg-bg-deep border border-border-subtle text-text-main text-xs font-mono rounded-xl p-2.5 outline-none focus:border-bearish-bright"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-bullish-bright mb-1 flex items-center gap-1">
              <TrendingUp size={14} className="text-bullish-bright" />
              <span>Take Profit (%)</span>
            </label>
            <input
              type="number"
              value={takeProfitPct}
              onChange={(e) => setTakeProfitPct(e.target.value)}
              step="0.5"
              min="0.1"
              placeholder="e.g. 4 (for 4%)"
              className="w-full bg-bg-deep border border-border-subtle text-text-main text-xs font-mono rounded-xl p-2.5 outline-none focus:border-bullish-bright"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-accent-purple mb-1 flex items-center gap-1">
              <Sliders size={14} className="text-accent-purple" />
              <span>Trailing Stop (%)</span>
            </label>
            <input
              type="number"
              value={trailingStopPct}
              onChange={(e) => setTrailingStopPct(e.target.value)}
              step="0.5"
              min="0.1"
              placeholder="e.g. 1.5 (for 1.5%)"
              className="w-full bg-bg-deep border border-border-subtle text-text-main text-xs font-mono rounded-xl p-2.5 outline-none focus:border-accent-purple"
            />
          </div>
        </div>

        {/* Strategy Selection (Single vs Composite) */}
        <div className="pt-3 border-t border-border-subtle">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
            <span className="text-xs font-bold text-text-main uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={14} className="text-brand-400" />
              Strategy Selection (Single / Composite):
            </span>

            {selectedStrategies.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">Combination Logic:</span>
                <select
                  value={compositeLogic}
                  onChange={(e: any) => setCompositeLogic(e.target.value)}
                  className="bg-bg-deep border border-brand-500/30 text-text-main text-xs font-bold rounded-lg px-2.5 py-1 outline-none"
                >
                  <option value="AND">AND (Unanimous Consensus)</option>
                  <option value="OR">OR (Any Signal Fires)</option>
                  <option value="WEIGHTED">WEIGHTED (Weighted Score)</option>
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {availableStrategies.map(strat => {
              const isSelected = selectedStrategies.includes(strat.id);
              return (
                <div
                  key={strat.id}
                  onClick={() => toggleStrategy(strat.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                    isSelected 
                      ? 'bg-brand-500/15 border-brand-500/50 shadow-sm text-text-main ring-1 ring-brand-500/40' 
                      : 'bg-bg-deep/70 border-border-subtle text-text-muted hover:border-brand-500/30 hover:text-text-main'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-bold truncate" title={strat.name}>{strat.name}</span>
                    <div className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${isSelected ? 'bg-brand-500 text-bg-deep font-bold' : 'border border-border-subtle'}`}>
                      {isSelected && <Check size={12} strokeWidth={3} />}
                    </div>
                  </div>
                  <span className="text-[10px] text-text-muted mt-1 line-clamp-1" title={strat.description}>
                    {strat.description}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Weighted Sliders if WEIGHTED */}
          {selectedStrategies.length > 1 && compositeLogic === 'WEIGHTED' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t border-border-subtle/50">
              {selectedStrategies.map(id => (
                <div key={id} className="bg-bg-deep/80 p-2.5 rounded-xl border border-border-subtle">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-semibold text-text-main truncate max-w-[120px]">{id}</span>
                    <span className="text-xs text-brand-400 font-mono">{(strategyWeights[id] || 0.5).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.1"
                    value={strategyWeights[id] || 0.5}
                    onChange={(e) => setStrategyWeights(prev => ({ ...prev, [id]: parseFloat(e.target.value) }))}
                    className="w-full h-1 bg-border-subtle rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Summary Metrics Bar */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0 animate-in fade-in slide-in-from-top-3 duration-300">
          {/* Winrate */}
          <div className="bg-bg-panel/80 p-4 rounded-2xl border border-border-subtle shadow-md">
            <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Win Rate</div>
            <div className="text-2xl font-bold mt-0.5 font-mono text-text-main">
              {((metrics.winrate || 0) * 100).toFixed(1)}%
            </div>
            <div className="text-[11px] text-text-muted font-mono mt-1 flex gap-2">
              <span className="text-bullish-bright font-semibold">Wins: {metrics.wins_count || 0}</span>
              <span>|</span>
              <span className="text-bearish-bright font-semibold">Losses: {metrics.losses_count || 0}</span>
            </div>
          </div>

          {/* Total Profit ($ and %) */}
          <div className="bg-bg-panel/80 p-4 rounded-2xl border border-border-subtle shadow-md">
            <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Net Profit ($)</div>
            <div className={`text-2xl font-bold mt-0.5 font-mono ${(metrics.total_profit_usd || 0) >= 0 ? 'text-bullish-bright' : 'text-bearish-bright'}`}>
              {(metrics.total_profit_usd || 0) >= 0 ? '+' : ''}${metrics.total_profit_usd || 0}
            </div>
            <div className={`text-[11px] font-mono mt-1 ${(metrics.total_return || 0) >= 0 ? 'text-bullish-bright' : 'text-bearish-bright'}`}>
              {(metrics.total_return || 0) >= 0 ? '+' : ''}{((metrics.total_return || 0) * 100).toFixed(2)}% Return
            </div>
          </div>

          {/* Max Drawdown */}
          <div className="bg-bg-panel/80 p-4 rounded-2xl border border-border-subtle shadow-md">
            <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Max Drawdown</div>
            <div className="text-2xl font-bold mt-0.5 font-mono text-bearish-bright">
              {((metrics.max_drawdown || 0) * 100).toFixed(1)}%
            </div>
            <div className="text-[11px] text-text-muted font-mono mt-1">
              Peak-to-trough risk
            </div>
          </div>

          {/* Profit Factor */}
          <div className="bg-bg-panel/80 p-4 rounded-2xl border border-border-subtle shadow-md">
            <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Profit Factor</div>
            <div className="text-2xl font-bold mt-0.5 font-mono text-text-main">
              {metrics.profit_factor || 0}
            </div>
            <div className="text-[11px] text-text-muted font-mono mt-1">
              Sharpe Ratio: {metrics.sharpe_ratio || 0}
            </div>
          </div>

          {/* Total Trades */}
          <div className="bg-bg-panel/80 p-4 rounded-2xl border border-border-subtle shadow-md">
            <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Total Trades</div>
            <div className="text-2xl font-bold mt-0.5 font-mono text-brand-400">
              {metrics.total_trades || 0}
            </div>
            <div className="text-[11px] text-text-muted font-mono mt-1">
              Executed orders count
            </div>
          </div>

          {/* Total Costs (Fees & Slippage) */}
          <div className="bg-bg-panel/80 p-4 rounded-2xl border border-border-subtle shadow-md">
            <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Fees & Slippage</div>
            <div className="text-2xl font-bold mt-0.5 font-mono text-text-muted">
              ${((metrics.total_fees_usd || 0) + (metrics.total_slippage_usd || 0)).toFixed(2)}
            </div>
            <div className="text-[11px] text-text-muted font-mono mt-1">
              5bps modeled slippage
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace Layout (Chart + Trades Table) */}
      <div className="grid grid-cols-1 gap-6 flex-1">
        {/* Full-width Interactive Chart */}
        <div className="bg-bg-panel/60 border border-border-subtle rounded-2xl p-4 backdrop-blur-md shadow-md h-[450px]">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-xs text-text-main flex items-center gap-2">
              <Activity size={16} className="text-brand-400" />
              Visualized Signal Execution Chart ({symbol} - {timeframe})
            </h3>
            <span className="text-[11px] text-text-muted font-mono">
              Click any trade in table below to zoom and highlight entry/exit
            </span>
          </div>
          <div className="h-[390px]">
            <TradingChart ref={chartRef} symbol={symbol} initialTimeframe={timeframe} />
          </div>
        </div>

        {/* Full-width Detailed Trades Table */}
        <div className="min-h-[400px]">
          <TradeDetailTable 
            trades={trades} 
            onRowClick={handleTradeClick}
            selectedTradeId={selectedTradeId}
          />
        </div>
      </div>

      {/* AI Strategy Generator Modal */}
      {isAiModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-bg-panel border border-brand-500/30 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-border-subtle pb-3">
              <h3 className="font-bold text-base text-text-main flex items-center gap-2">
                <Sparkles className="text-accent-purple w-5 h-5" />
                Generate Strategy from Natural Language / Article URL
              </h3>
              <button onClick={() => setIsAiModalOpen(false)} className="text-text-muted hover:text-text-main">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              Enter a trading strategy description in natural language or provide an article link. The AI engine parses rules into Single/Composite schemas and saves them for reusable backtesting.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-text-muted mb-1 block">Strategy Prompt:</label>
                <textarea
                  rows={4}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g. Combine Fast MA Crossover (short 10, long 50) with RSI oversold below 30, Stop Loss 2%, Take Profit 4% with AND logic..."
                  className="w-full bg-bg-deep border border-border-subtle rounded-xl p-3 text-xs text-text-main outline-none focus:border-brand-400"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-text-muted mb-1 block">Article / Script URL (Optional):</label>
                <input
                  type="url"
                  value={aiSourceUrl}
                  onChange={(e) => setAiSourceUrl(e.target.value)}
                  placeholder="https://example.com/crypto-trading-strategy"
                  className="w-full bg-bg-deep border border-border-subtle rounded-xl p-2.5 text-xs text-text-main outline-none focus:border-brand-400"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="px-4 py-2 bg-bg-deep text-text-muted hover:text-text-main rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateAiStrategy}
                disabled={aiLoading || !aiPrompt.trim()}
                className="px-5 py-2 bg-gradient-to-r from-accent-purple to-brand-500 text-bg-deep font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                <Sparkles size={14} />
                <span>{aiLoading ? 'Processing AI...' : 'Generate Strategy'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smart News Crawler Modal */}
      {isCrawlerModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-bg-panel border border-accent-blue/30 rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-border-subtle pb-3">
              <h3 className="font-bold text-base text-text-main flex items-center gap-2">
                <Globe className="text-accent-blue w-5 h-5" />
                Smart HTML News Crawler & Tag Learner
              </h3>
              <button onClick={() => setIsCrawlerModalOpen(false)} className="text-text-muted hover:text-text-main">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              Enter any crypto news or trading article URL. The system automatically inspects HTML selectors, caches schemas to SQLite, and performs FinBERT sentiment analysis.
            </p>

            <div className="flex gap-2">
              <input
                type="url"
                value={crawlerUrl}
                onChange={(e) => setCrawlerUrl(e.target.value)}
                placeholder="https://cointelegraph.com/news/bitcoin-surge..."
                className="flex-1 bg-bg-deep border border-border-subtle rounded-xl p-2.5 text-xs text-text-main outline-none focus:border-brand-400"
              />
              <button
                onClick={handleCrawlNews}
                disabled={crawlerLoading || !crawlerUrl.trim()}
                className="px-4 py-2.5 bg-accent-blue hover:bg-accent-blue/80 text-bg-deep font-bold rounded-xl text-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw size={14} className={crawlerLoading ? 'animate-spin' : ''} />
                <span>{crawlerLoading ? 'Crawling...' : 'Crawl URL'}</span>
              </button>
            </div>

            {crawlerResult && (
              <div className="bg-bg-deep p-4 rounded-xl border border-border-subtle space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-text-main truncate max-w-[300px]">{crawlerResult.title}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    crawlerResult.sentiment_label === 'positive' ? 'bg-bullish/20 text-bullish-bright' :
                    crawlerResult.sentiment_label === 'negative' ? 'bg-bearish/20 text-bearish-bright' :
                    'bg-slate-700 text-slate-300'
                  }`}>
                    {crawlerResult.sentiment_label} ({crawlerResult.sentiment_score})
                  </span>
                </div>
                <p className="text-text-muted line-clamp-3 leading-relaxed">
                  {crawlerResult.content}
                </p>
                <div className="pt-2 border-t border-border-subtle flex justify-between text-[11px] text-text-muted font-mono">
                  <span>Domain: {crawlerResult.domain}</span>
                  <span className="text-brand-400 font-semibold">Learned Tag Schema Saved</span>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsCrawlerModalOpen(false)}
                className="px-4 py-2 bg-bg-deep text-text-muted hover:text-text-main rounded-xl text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-xl border flex items-center justify-between gap-4 shadow-2xl z-50 animate-in slide-in-from-bottom-5 fade-in duration-300 backdrop-blur-xl ${
          toast.type === 'success' 
            ? 'bg-bullish/15 border-bullish/40 text-bullish-bright' 
            : 'bg-bearish/15 border-bearish/40 text-bearish-bright'
        }`}>
          <div className="flex items-center gap-3">
            {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            <span className="font-semibold text-sm">{toast.message}</span>
          </div>
          <button onClick={() => setToast(null)} className="opacity-70 hover:opacity-100 transition-opacity">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
