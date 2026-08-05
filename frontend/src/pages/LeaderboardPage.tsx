import React, { useEffect, useState } from 'react';
import { RefreshCw, Trophy, TrendingUp, AlertTriangle, ArrowUpRight, ArrowDownRight, Award, Activity } from 'lucide-react';
import { useEventsWebSocket } from '../shared/hooks/useEventsWebSocket';

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

  // Listen for real-time leaderboard updates
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
      setSortOrder('desc'); // Default to descending for new columns
    }
  };

  const getSortIcon = (column: string) => {
    if (sortBy !== column) return null;
    return sortOrder === 'asc' ? <ArrowUpRight className="inline w-4 h-4" /> : <ArrowDownRight className="inline w-4 h-4" />;
  };

  const formatPercent = (val: number) => `${(val * 100).toFixed(2)}%`;
  const formatNumber = (val: number) => val.toFixed(2);

  const getRowStyle = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-yellow-500/10 border-l-4 border-yellow-500';
      case 2: return 'bg-gray-300/10 border-l-4 border-gray-400';
      case 3: return 'bg-amber-700/10 border-l-4 border-amber-600';
      default: return 'border-l-4 border-transparent hover:bg-slate-800/50';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-200">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="text-yellow-500 w-8 h-8" />
            Strategy Leaderboard
            {isConnected && (
              <span className="ml-2 flex items-center gap-1 px-2 py-1 bg-emerald-500/10 text-emerald-500 text-xs rounded-full border border-emerald-500/20">
                <Activity className="w-3 h-3 animate-pulse" /> LIVE
              </span>
            )}
          </h1>
          <p className="text-slate-400 mt-1">Top performing trading strategies across all backtests</p>
        </div>
        <button 
          onClick={() => { setLoading(true); fetchLeaderboard(); }}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-sm font-semibold text-slate-400">
                <th className="p-4 w-16 text-center">Rank</th>
                <th className="p-4 cursor-pointer hover:text-white" onClick={() => handleSort('strategy_name')}>
                  Strategy {getSortIcon('strategy_name')}
                </th>
                <th className="p-4 cursor-pointer hover:text-white text-right" onClick={() => handleSort('overall_score')}>
                  Score {getSortIcon('overall_score')}
                </th>
                <th className="p-4 cursor-pointer hover:text-white text-right" onClick={() => handleSort('total_return')}>
                  Return {getSortIcon('total_return')}
                </th>
                <th className="p-4 cursor-pointer hover:text-white text-right" onClick={() => handleSort('winrate')}>
                  Win Rate {getSortIcon('winrate')}
                </th>
                <th className="p-4 cursor-pointer hover:text-white text-right" onClick={() => handleSort('max_drawdown')}>
                  MDD {getSortIcon('max_drawdown')}
                </th>
                <th className="p-4 cursor-pointer hover:text-white text-right" onClick={() => handleSort('profit_factor')}>
                  Profit Factor {getSortIcon('profit_factor')}
                </th>
                <th className="p-4 cursor-pointer hover:text-white text-right" onClick={() => handleSort('sharpe_ratio')}>
                  Sharpe {getSortIcon('sharpe_ratio')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {entries.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No strategies found. Run a backtest or search to populate the leaderboard.
                  </td>
                </tr>
              )}
              {entries.map((entry) => (
                <tr key={entry.id} className={`transition-colors ${getRowStyle(entry.rank)}`}>
                  <td className="p-4 text-center font-bold">
                    {entry.rank === 1 && <Award className="w-6 h-6 text-yellow-500 mx-auto" />}
                    {entry.rank === 2 && <Award className="w-6 h-6 text-gray-400 mx-auto" />}
                    {entry.rank === 3 && <Award className="w-6 h-6 text-amber-600 mx-auto" />}
                    {entry.rank > 3 && <span className="text-slate-500">{entry.rank}</span>}
                  </td>
                  <td className="p-4">
                    <div className="font-medium text-slate-200">{entry.strategy_name}</div>
                    <div className="text-xs text-slate-500 truncate max-w-[200px]" title={JSON.stringify(entry.strategy_config.logic ? entry.strategy_config.logic : entry.strategy_config, null, 2)}>
                      {entry.strategy_config.logic ? `Composite (${entry.strategy_config.logic})` : 'Single Strategy'}
                    </div>
                  </td>
                  <td className="p-4 text-right font-bold text-blue-400">
                    {formatNumber(entry.overall_score)}
                  </td>
                  <td className={`p-4 text-right font-medium ${entry.metrics.total_return >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    <div className="flex justify-end items-center gap-1">
                      {entry.metrics.total_return >= 0 ? <TrendingUp className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {formatPercent(entry.metrics.total_return)}
                    </div>
                  </td>
                  <td className="p-4 text-right font-medium text-slate-300">
                    {formatPercent(entry.metrics.winrate)}
                  </td>
                  <td className="p-4 text-right font-medium text-red-400/80">
                    {formatPercent(entry.metrics.max_drawdown)}
                  </td>
                  <td className="p-4 text-right font-medium text-emerald-400/80">
                    {formatNumber(entry.metrics.profit_factor || 0)}
                  </td>
                  <td className="p-4 text-right font-medium text-blue-400/80">
                    {formatNumber(entry.metrics.sharpe_ratio || 0)}
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
