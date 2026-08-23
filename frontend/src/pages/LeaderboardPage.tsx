import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  RefreshCw, 
  Trophy, 
  TrendingUp, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight, 
  Award, 
  Activity,
  X,
  ExternalLink,
  Maximize2
} from 'lucide-react';
import { useEventsWebSocket } from '../shared/hooks/useEventsWebSocket';
import { getDeviceTimezoneOffset, formatLocalDateTime } from '../shared/lib/timezone';
import { TradingChart, type TradingChartHandle } from '../components/Charts/TradingChart';
import { TradeDetailTable, type TradeRecord } from '../components/TradeDetailTable';

interface LeaderboardEntry {
  id: string;
  rank: number;
  strategy_name: string;
  strategy_config: any;
  metrics: {
    total_return: number;
    winrate: number;
    max_drawdown: number;
    profit_factor: number;
    sharpe_ratio: number;
    total_trades: number;
  };
  overall_score: number;
  timestamp: string;
}

export const LeaderboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>('overall_score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Selected Entry & Chart Inspection Modal State
  const [selectedEntry, setSelectedEntry] = useState<LeaderboardEntry | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalSymbol, setModalSymbol] = useState<string>("BTC/USDT");
  const [modalTimeframe, setModalTimeframe] = useState<string>("15m");
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [modalTrades, setModalTrades] = useState<TradeRecord[]>([]);
  const [modalMetrics, setModalMetrics] = useState<any>(null);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);

  const chartRef = useRef<TradingChartHandle>(null);
  const { isConnected, lastEvent } = useEventsWebSocket();

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/v1/leaderboard?top_k=50&sort_by=${sortBy}&order=${sortOrder}`);
      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard data');
      }
      const data = await response.json();
      setEntries(data.leaderboard);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [sortBy, sortOrder]);

  useEffect(() => {
    if (lastEvent?.event === 'leaderboard_updated') {
      fetchLeaderboard();
    }
  }, [lastEvent]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const getSortIcon = (column: string) => {
    if (sortBy !== column) return null;
    return sortOrder === 'asc' ? <ArrowUpRight className="inline w-3.5 h-3.5" /> : <ArrowDownRight className="inline w-3.5 h-3.5" />;
  };

  const formatPercent = (val: number) => `${(val * 100).toFixed(2)}%`;
  const formatNumber = (val: number) => Number(val).toFixed(2);

  // Format local device time
  const formatLocalTime = (timeStr: string) => {
    if (!timeStr) return '-';
    return `${formatLocalDateTime(timeStr)} ${getDeviceTimezoneOffset()}`;
  };

  const getRowStyle = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-brand-500/10 border-l-4 border-brand-400';
      case 2: return 'bg-slate-400/10 border-l-4 border-slate-400';
      case 3: return 'bg-amber-600/10 border-l-4 border-amber-600';
      default: return 'border-l-4 border-transparent hover:bg-bg-surface/60';
    }
  };

  const resolveStrategyConfigs = (entry: LeaderboardEntry) => {
    const cfg = entry.strategy_config || {};
    if (cfg.strategies && Array.isArray(cfg.strategies) && cfg.strategies.length > 0) {
      return cfg.strategies;
    }
    if (cfg.strategy_ids && Array.isArray(cfg.strategy_ids)) {
      return cfg.strategy_ids.map((id: string) => ({
        id,
        params: cfg.params?.[id] || {}
      }));
    }
    if (cfg.id) {
      return [{ id: cfg.id, params: cfg.params || {} }];
    }
    
    // Fallback based on name
    const name = (entry.strategy_name || '').toLowerCase();
    let stratId = 'ma_crossover';
    if (name.includes('rsi') || name.includes('relative strength')) stratId = 'rsi';
    else if (name.includes('bollinger')) stratId = 'bollinger_bands';
    else if (name.includes('support') || name.includes('resistance') || name.includes('sr')) stratId = 'support_resistance';
    else if (name.includes('smc') || name.includes('smart money') || name.includes('liquidity')) stratId = 'smc';
    else if (name.includes('sentiment') || name.includes('news')) stratId = 'news_sentiment';
    
    return [{ id: stratId, params: cfg.params?.[stratId] || {} }];
  };

  const runEntryBacktest = async (entry: LeaderboardEntry, symbol: string, timeframe: string) => {
    setModalLoading(true);
    setModalTrades([]);
    setModalMetrics(null);
    setSelectedTradeId(null);
    if (chartRef.current?.clearAll) {
      chartRef.current.clearAll();
    }

    try {
      const strategies = resolveStrategyConfigs(entry);
      const payload = {
        strategies,
        logic: entry.strategy_config?.logic || "AND",
        symbol,
        timeframe,
        limit: 500,
        initial_capital: 100,
        fee_pct: 0.05,
        slippage_bps: 5.0
      };

      const res = await fetch("http://localhost:8000/api/v1/backtest/run-with-trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error("Failed to load strategy backtest chart data.");
      }

      const data = await res.json();
      setModalMetrics(data.metrics || entry.metrics);
      setModalTrades(data.trades || []);

      if (data.ohlcv && chartRef.current?.setCandles) {
        chartRef.current.setCandles(data.ohlcv);
      }
      if (data.markers && chartRef.current) {
        chartRef.current.setMarkers(data.markers);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setModalLoading(false);
    }
  };

  const handleRowClick = (entry: LeaderboardEntry) => {
    setSelectedEntry(entry);
    setIsModalOpen(true);
    runEntryBacktest(entry, modalSymbol, modalTimeframe);
  };

  const handleTradeClick = (trade: TradeRecord) => {
    setSelectedTradeId(trade.id || null);
    if (chartRef.current) {
      let entryTime = trade.entry_timestamp;
      let exitTime = trade.exit_timestamp;
      if (!entryTime) {
        const isEntryUTC = !trade.entry_time.includes('Z') && !trade.entry_time.includes('+');
        entryTime = Math.floor(new Date(isEntryUTC ? trade.entry_time + 'Z' : trade.entry_time).getTime() / 1000);
      }
      if (!exitTime) {
        const isExitUTC = !trade.exit_time.includes('Z') && !trade.exit_time.includes('+');
        exitTime = Math.floor(new Date(isExitUTC ? trade.exit_time + 'Z' : trade.exit_time).getTime() / 1000);
      }
      if (entryTime && exitTime) {
        chartRef.current.highlightTrade(entryTime, exitTime);
      }
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 text-text-main">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="text-brand-400 w-7 h-7" />
            Strategy Leaderboard
            {isConnected && (
              <span className="ml-2 flex items-center gap-1 px-2.5 py-0.5 bg-bullish/15 text-bullish-bright text-xs rounded-full border border-bullish/30 font-mono">
                <Activity className="w-3 h-3 animate-pulse" /> LIVE STREAM
              </span>
            )}
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Top-performing quantitative strategies evaluated by composite objective function. <span className="text-brand-400 font-medium">Click any row below to inspect its interactive signal chart & verify on recent market data.</span>
          </p>
        </div>
        <button 
          onClick={() => { setLoading(true); fetchLeaderboard(); }}
          className="flex items-center gap-2 px-4 py-2 bg-bg-surface hover:bg-bg-hover rounded-xl transition-colors border border-border-subtle text-xs font-semibold text-text-muted hover:text-text-main cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-bearish/10 border border-bearish/30 text-bearish-bright p-4 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      <div className="bg-bg-panel/80 border border-border-subtle rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-bg-surface/80 border-b border-border-subtle text-[11px] uppercase font-bold text-text-muted tracking-wider">
                <th className="p-3.5 w-16 text-center">Rank</th>
                <th className="p-3.5 cursor-pointer hover:text-brand-400" onClick={() => handleSort('strategy_name')}>
                  Strategy Name {getSortIcon('strategy_name')}
                </th>
                <th className="p-3.5 cursor-pointer hover:text-brand-400 text-right" onClick={() => handleSort('overall_score')}>
                  Composite Score {getSortIcon('overall_score')}
                </th>
                <th className="p-3.5 cursor-pointer hover:text-brand-400 text-right" onClick={() => handleSort('total_return')}>
                  Total Return {getSortIcon('total_return')}
                </th>
                <th className="p-3.5 cursor-pointer hover:text-brand-400 text-right" onClick={() => handleSort('winrate')}>
                  Win Rate {getSortIcon('winrate')}
                </th>
                <th className="p-3.5 cursor-pointer hover:text-brand-400 text-right" onClick={() => handleSort('max_drawdown')}>
                  Max Drawdown {getSortIcon('max_drawdown')}
                </th>
                <th className="p-3.5 cursor-pointer hover:text-brand-400 text-right" onClick={() => handleSort('profit_factor')}>
                  Profit Factor {getSortIcon('profit_factor')}
                </th>
                <th className="p-3.5 cursor-pointer hover:text-brand-400 text-right" onClick={() => handleSort('sharpe_ratio')}>
                  Sharpe Ratio {getSortIcon('sharpe_ratio')}
                </th>
                <th className="p-3.5 text-right">Recorded ({getDeviceTimezoneOffset()})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/40 font-mono">
              {entries.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-text-muted text-xs">
                    No strategies recorded yet. Run a backtest or start the search engine to populate the leaderboard.
                  </td>
                </tr>
              )}
              {entries.map((entry) => (
                <tr 
                  key={entry.id} 
                  onClick={() => handleRowClick(entry)}
                  title="Click to view interactive execution chart & parameters"
                  className={`transition-all cursor-pointer select-none group ${getRowStyle(entry.rank)}`}
                >
                  <td className="p-3.5 text-center font-bold">
                    {entry.rank === 1 && <Award className="w-5 h-5 text-brand-400 mx-auto" />}
                    {entry.rank === 2 && <Award className="w-5 h-5 text-slate-300 mx-auto" />}
                    {entry.rank === 3 && <Award className="w-5 h-5 text-amber-500 mx-auto" />}
                    {entry.rank > 3 && <span className="text-text-dim">#{entry.rank}</span>}
                  </td>
                  <td className="p-3.5 font-sans">
                    <div className="font-bold text-text-main group-hover:text-brand-400 transition-colors flex items-center gap-1.5">
                      <span>{entry.strategy_name}</span>
                      <Maximize2 size={12} className="opacity-0 group-hover:opacity-70 text-brand-400 transition-opacity shrink-0" />
                    </div>
                    <div className="text-[10px] text-text-muted flex items-center gap-1.5 mt-0.5" title={JSON.stringify(entry.strategy_config, null, 2)}>
                      {entry.strategy_config?.logic ? (
                        <span className={`px-1.5 py-0.2 rounded font-mono font-bold text-[9px] border ${
                          entry.strategy_config.logic === 'WEIGHTED'
                            ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                            : entry.strategy_config.logic === 'AND'
                            ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                            : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                        }`}>
                          {entry.strategy_config.logic}
                        </span>
                      ) : (
                        <span className="text-text-dim">Single</span>
                      )}
                      {entry.strategy_config?.weights && (
                        <span className="font-mono text-text-dim truncate max-w-[200px]">
                          [{entry.strategy_config.weights.map((w: number) => `${Math.round(w * 100)}%`).join(' : ')}]
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3.5 text-right font-bold text-accent-blue font-mono text-sm">
                    {formatNumber(entry.overall_score)}
                  </td>
                  <td className={`p-3.5 text-right font-bold ${entry.metrics.total_return >= 0 ? 'text-bullish-bright' : 'text-bearish-bright'}`}>
                    <div className="flex justify-end items-center gap-1">
                      {entry.metrics.total_return >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      {formatPercent(entry.metrics.total_return)}
                    </div>
                  </td>
                  <td className="p-3.5 text-right font-semibold text-text-main">
                    {formatPercent(entry.metrics.winrate)}
                  </td>
                  <td className="p-3.5 text-right font-semibold text-bearish-bright">
                    {formatPercent(entry.metrics.max_drawdown)}
                  </td>
                  <td className="p-3.5 text-right font-semibold text-text-main">
                    {formatNumber(entry.metrics.profit_factor || 0)}
                  </td>
                  <td className="p-3.5 text-right font-semibold text-accent-purple">
                    {formatNumber(entry.metrics.sharpe_ratio || 0)}
                  </td>
                  <td className="p-3.5 text-right text-[11px] text-text-muted">
                    {formatLocalTime(entry.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive Strategy Chart Inspection Modal */}
      {isModalOpen && selectedEntry && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-bg-panel border border-brand-500/30 rounded-3xl max-w-6xl w-full max-h-[94vh] shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-border-subtle bg-bg-panel/90 flex flex-wrap justify-between items-center gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400 font-bold">
                  {selectedEntry.rank <= 3 ? <Award className="w-6 h-6" /> : `#${selectedEntry.rank}`}
                </div>
                <div>
                  <h3 className="font-bold text-base text-text-main flex items-center gap-2 flex-wrap">
                    <span>{selectedEntry.strategy_name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent-blue/15 text-accent-blue border border-accent-blue/30 font-mono">
                      Rank #{selectedEntry.rank} • Score: {formatNumber(selectedEntry.overall_score)}
                    </span>
                  </h3>
                  <p className="text-xs text-text-muted">
                    Official Benchmark recorded on {formatLocalTime(selectedEntry.timestamp)}
                  </p>
                </div>
              </div>
              
              {/* Controls: Symbol Pills, Timeframe Pills, Open in Backtest & Close */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Pair Selector Pills */}
                <div className="flex items-center gap-1 bg-bg-deep p-1 rounded-xl border border-border-subtle">
                  <span className="text-[11px] text-text-muted font-mono font-semibold px-1.5">Pair:</span>
                  {(['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT'] as const).map((sym) => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => {
                        setModalSymbol(sym);
                        runEntryBacktest(selectedEntry, sym, modalTimeframe);
                      }}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        modalSymbol === sym
                          ? 'bg-accent-blue text-bg-deep font-bold shadow-sm'
                          : 'text-text-muted hover:text-text-main hover:bg-bg-surface'
                      }`}
                    >
                      {sym.split('/')[0]}
                    </button>
                  ))}
                </div>

                {/* Timeframe Selector Pills */}
                <div className="flex items-center gap-1 bg-bg-deep p-1 rounded-xl border border-border-subtle">
                  <span className="text-[11px] text-text-muted font-mono font-semibold px-1.5">TF:</span>
                  {(['5m', '15m', '1h', '4h', '1d'] as const).map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => {
                        setModalTimeframe(tf);
                        runEntryBacktest(selectedEntry, modalSymbol, tf);
                      }}
                      className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg transition-all cursor-pointer ${
                        modalTimeframe === tf
                          ? 'bg-brand-500 text-bg-deep font-bold shadow-sm'
                          : 'text-text-muted hover:text-text-main hover:bg-bg-surface'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => navigate('/backtest')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 border border-brand-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title="Open full parameters in Backtest Workbench"
                >
                  <ExternalLink size={14} />
                  <span>Open in Workbench</span>
                </button>

                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-text-muted hover:text-text-main hover:bg-bg-surface rounded-xl transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Dual Comparison Cards: Recorded Benchmark vs Live Market Re-Test */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Card 1: Official Leaderboard Benchmark */}
                <div className="bg-gradient-to-br from-amber-500/15 via-bg-deep to-bg-panel border border-amber-500/30 rounded-2xl p-4 shadow-lg">
                  <div className="flex items-center justify-between border-b border-amber-500/20 pb-2.5 mb-3">
                    <div className="flex items-center gap-2">
                      <Trophy className="text-brand-400 w-4 h-4" />
                      <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">
                        1. Official Benchmark (Recorded)
                      </span>
                    </div>
                    <span className="text-[11px] text-text-muted font-mono">
                      Recorded: {formatLocalTime(selectedEntry.timestamp)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="bg-bg-deep/90 p-2.5 rounded-xl border border-amber-500/20 shadow-inner">
                      <span className="text-[10px] text-text-muted uppercase font-semibold">Benchmark Return</span>
                      <div className={`text-base font-bold font-mono ${selectedEntry.metrics.total_return >= 0 ? 'text-bullish-bright' : 'text-bearish-bright'}`}>
                        {formatPercent(selectedEntry.metrics.total_return)}
                      </div>
                    </div>

                    <div className="bg-bg-deep/90 p-2.5 rounded-xl border border-amber-500/20 shadow-inner">
                      <span className="text-[10px] text-text-muted uppercase font-semibold">Benchmark Win Rate</span>
                      <div className="text-base font-bold font-mono text-bullish-bright">
                        {formatPercent(selectedEntry.metrics.winrate)}
                      </div>
                    </div>

                    <div className="bg-bg-deep/90 p-2.5 rounded-xl border border-amber-500/20 shadow-inner">
                      <span className="text-[10px] text-text-muted uppercase font-semibold">Benchmark MDD</span>
                      <div className="text-base font-bold font-mono text-bearish-bright">
                        {formatPercent(selectedEntry.metrics.max_drawdown)}
                      </div>
                    </div>

                    <div className="bg-bg-deep/90 p-2.5 rounded-xl border border-amber-500/20 shadow-inner">
                      <span className="text-[10px] text-text-muted uppercase font-semibold">Profit Factor</span>
                      <div className="text-base font-bold font-mono text-text-main">
                        {formatNumber(selectedEntry.metrics.profit_factor || 0)}
                      </div>
                    </div>

                    <div className="bg-bg-deep/90 p-2.5 rounded-xl border border-amber-500/20 shadow-inner">
                      <span className="text-[10px] text-text-muted uppercase font-semibold">Sharpe Ratio</span>
                      <div className="text-base font-bold font-mono text-accent-purple">
                        {formatNumber(selectedEntry.metrics.sharpe_ratio || 0)}
                      </div>
                    </div>

                    <div className="bg-bg-deep/90 p-2.5 rounded-xl border border-amber-500/20 shadow-inner">
                      <span className="text-[10px] text-text-muted uppercase font-semibold">Trades Count</span>
                      <div className="text-base font-bold font-mono text-brand-400">
                        {selectedEntry.metrics.total_trades || 0} trades
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 2: Live Market Test (Current Candles) */}
                <div className="bg-gradient-to-br from-cyan-500/15 via-bg-deep to-bg-panel border border-cyan-500/30 rounded-2xl p-4 shadow-lg">
                  <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2.5 mb-3">
                    <div className="flex items-center gap-2">
                      <Activity className="text-cyan-400 w-4 h-4 animate-pulse" />
                      <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                        2. Live Market Re-Test ({modalSymbol} • {modalTimeframe})
                      </span>
                    </div>
                    <span className="text-[11px] text-cyan-400/90 font-mono font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                      Latest 500 Candles
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="bg-bg-deep/90 p-2.5 rounded-xl border border-cyan-500/20 shadow-inner">
                      <span className="text-[10px] text-text-muted uppercase font-semibold">Live Return</span>
                      <div className={`text-base font-bold font-mono ${(modalMetrics?.total_return ?? 0) >= 0 ? 'text-bullish-bright' : 'text-bearish-bright'}`}>
                        {modalMetrics ? formatPercent(modalMetrics.total_return) : '...'}
                      </div>
                    </div>

                    <div className="bg-bg-deep/90 p-2.5 rounded-xl border border-cyan-500/20 shadow-inner">
                      <span className="text-[10px] text-text-muted uppercase font-semibold">Live Win Rate</span>
                      <div className="text-base font-bold font-mono text-bullish-bright">
                        {modalMetrics ? formatPercent(modalMetrics.winrate) : '...'}
                      </div>
                    </div>

                    <div className="bg-bg-deep/90 p-2.5 rounded-xl border border-cyan-500/20 shadow-inner">
                      <span className="text-[10px] text-text-muted uppercase font-semibold">Live MDD</span>
                      <div className="text-base font-bold font-mono text-bearish-bright">
                        {modalMetrics ? formatPercent(modalMetrics.max_drawdown) : '...'}
                      </div>
                    </div>

                    <div className="bg-bg-deep/90 p-2.5 rounded-xl border border-cyan-500/20 shadow-inner">
                      <span className="text-[10px] text-text-muted uppercase font-semibold">Live Profit Factor</span>
                      <div className="text-base font-bold font-mono text-text-main">
                        {modalMetrics ? formatNumber(modalMetrics.profit_factor || 0) : '...'}
                      </div>
                    </div>

                    <div className="bg-bg-deep/90 p-2.5 rounded-xl border border-cyan-500/20 shadow-inner">
                      <span className="text-[10px] text-text-muted uppercase font-semibold">Live Sharpe</span>
                      <div className="text-base font-bold font-mono text-accent-purple">
                        {modalMetrics ? formatNumber(modalMetrics.sharpe_ratio || 0) : '...'}
                      </div>
                    </div>

                    <div className="bg-bg-deep/90 p-2.5 rounded-xl border border-cyan-500/20 shadow-inner">
                      <span className="text-[10px] text-text-muted uppercase font-semibold">Live Executed Trades</span>
                      <div className="text-base font-bold font-mono text-cyan-400">
                        {modalMetrics ? `${modalMetrics.total_trades || 0} trades` : '...'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chart Visualizer */}
              <div className="bg-bg-deep/90 border border-border-subtle rounded-2xl p-3 relative h-[380px]">
                <div className="flex justify-between items-center mb-2 px-1">
                  <div className="flex items-center gap-2">
                    <Activity size={14} className="text-brand-400" />
                    <span className="text-xs font-bold text-text-main">
                      Live Signal Visualizer ({modalSymbol} - {modalTimeframe})
                    </span>
                  </div>
                  <span className="text-[10px] text-text-muted font-mono">
                    Visualizing signal triggers on recent historical candles
                  </span>
                </div>
                {modalLoading && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-20 rounded-2xl">
                    <div className="flex items-center gap-2 px-4 py-2 bg-bg-panel border border-brand-500/40 rounded-xl text-xs text-brand-400 font-bold shadow-lg">
                      <RefreshCw className="animate-spin w-4 h-4" />
                      <span>Evaluating strategy signals on {modalSymbol}...</span>
                    </div>
                  </div>
                )}
                <div className="h-[330px]">
                  <TradingChart 
                    ref={chartRef} 
                    symbol={modalSymbol} 
                    initialTimeframe={modalTimeframe} 
                    enableLiveStream={false} 
                  />
                </div>
              </div>

              {/* Detailed Trades Log */}
              <div>
                <TradeDetailTable 
                  trades={modalTrades}
                  onRowClick={handleTradeClick}
                  selectedTradeId={selectedTradeId}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
