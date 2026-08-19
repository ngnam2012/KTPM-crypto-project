import React, { useEffect, useState } from 'react';
import { RefreshCw, Trophy, TrendingUp, AlertTriangle, ArrowUpRight, ArrowDownRight, Award, Activity } from 'lucide-react';
import { useEventsWebSocket } from '../shared/hooks/useEventsWebSocket';
import { getDeviceTimezoneOffset, formatLocalDateTime } from '../shared/lib/timezone';

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
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>('overall_score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
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
      default: return 'border-l-4 border-transparent hover:bg-bg-surface/50';
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
            Top-performing quantitative strategies evaluated by composite objective function (0.4 Return + 0.3 Winrate + 0.2 MDD + 0.1 Sharpe).
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
                <tr key={entry.id} className={`transition-colors ${getRowStyle(entry.rank)}`}>
                  <td className="p-3.5 text-center font-bold">
                    {entry.rank === 1 && <Award className="w-5 h-5 text-brand-400 mx-auto" />}
                    {entry.rank === 2 && <Award className="w-5 h-5 text-slate-300 mx-auto" />}
                    {entry.rank === 3 && <Award className="w-5 h-5 text-amber-500 mx-auto" />}
                    {entry.rank > 3 && <span className="text-text-dim">{entry.rank}</span>}
                  </td>
                  <td className="p-3.5 font-sans">
                    <div className="font-bold text-text-main">{entry.strategy_name}</div>
                    <div className="text-[10px] text-text-muted truncate max-w-[200px]" title={JSON.stringify(entry.strategy_config.logic ? entry.strategy_config.logic : entry.strategy_config, null, 2)}>
                      {entry.strategy_config?.logic ? `Composite (${entry.strategy_config.logic})` : 'Single Strategy'}
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
    </div>
  );
};
