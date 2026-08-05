import React, { useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Clock } from 'lucide-react';

export interface TradeRecord {
  id?: string;
  type: 'LONG' | 'SHORT';
  entry_time: string;
  entry_price: number;
  exit_time: string;
  exit_price: number;
  profit_pct: number;
  duration_mins?: number;
}

interface TradeDetailTableProps {
  trades: TradeRecord[];
  onRowClick?: (trade: TradeRecord) => void;
}

type SortField = 'entry_time' | 'profit_pct' | 'type';
type SortDirection = 'asc' | 'desc';

export const TradeDetailTable: React.FC<TradeDetailTableProps> = ({ trades, onRowClick }) => {
  const [sortField, setSortField] = useState<SortField>('entry_time');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedTrades = [...trades].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'entry_time') {
      comparison = new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime();
    } else if (sortField === 'profit_pct') {
      comparison = a.profit_pct - b.profit_pct;
    } else if (sortField === 'type') {
      comparison = a.type.localeCompare(b.type);
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-text-muted/50" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-brand-500" /> : <ArrowDown className="w-3 h-3 text-brand-500" />;
  };

  const formatTime = (timeStr: string) => {
    const isUTC = !timeStr.includes('Z') && !timeStr.includes('+');
    const d = new Date(isUTC ? timeStr + 'Z' : timeStr);
    return d.toLocaleString(undefined, { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }) + " (Local)";
  };

  if (!trades || trades.length === 0) {
    return (
      <div className="bg-bg-panel/40 backdrop-blur-md border border-border-subtle rounded-2xl p-10 text-center text-text-muted">
        <Clock className="w-12 h-12 mx-auto mb-4 opacity-20" />
        <p>No trades executed in this backtest.</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-panel/40 backdrop-blur-md border border-border-subtle rounded-2xl overflow-hidden flex flex-col h-full">
      <div className="p-5 border-b border-border-subtle bg-bg-panel/50 shrink-0">
        <h3 className="font-semibold text-lg text-text-main tracking-tight">Trade History <span className="text-text-muted text-sm font-normal ml-2 font-mono">({trades.length} trades)</span></h3>
      </div>
      <div className="overflow-y-auto flex-1 relative">
        <table className="w-full text-left text-sm text-text-muted relative">
          <thead className="bg-bg-panel/95 backdrop-blur-xl text-xs uppercase font-semibold text-text-main tracking-wider sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-6 py-4 whitespace-nowrap">#</th>
              <th className="px-6 py-4 whitespace-nowrap cursor-pointer hover:text-brand-500 transition-colors" onClick={() => handleSort('type')}>
                <div className="flex items-center gap-1">Type <SortIcon field="type" /></div>
              </th>
              <th className="px-6 py-4 whitespace-nowrap cursor-pointer hover:text-brand-500 transition-colors" onClick={() => handleSort('entry_time')}>
                <div className="flex items-center gap-1">Entry <SortIcon field="entry_time" /></div>
              </th>
              <th className="px-6 py-4 whitespace-nowrap text-right">Entry Price</th>
              <th className="px-6 py-4 whitespace-nowrap">Exit</th>
              <th className="px-6 py-4 whitespace-nowrap text-right">Exit Price</th>
              <th className="px-6 py-4 whitespace-nowrap cursor-pointer hover:text-brand-500 transition-colors text-right" onClick={() => handleSort('profit_pct')}>
                <div className="flex items-center justify-end gap-1"><SortIcon field="profit_pct" /> Profit %</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedTrades.map((trade, idx) => {
              const isProfit = trade.profit_pct > 0;
              const isLoss = trade.profit_pct < 0;
              
              return (
                <tr 
                  key={trade.id || idx} 
                  className="hover:bg-brand-500/5 transition-all duration-300 group cursor-pointer"
                  onClick={() => onRowClick && onRowClick(trade)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-text-muted font-mono border-b border-border-subtle/30">{idx + 1}</td>
                  <td className="px-6 py-4 whitespace-nowrap border-b border-border-subtle/30">
                    <span className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${
                      trade.type === 'LONG' ? 'bg-bullish/10 text-bullish border border-bullish/20' : 'bg-bearish/10 text-bearish border border-bearish/20'
                    }`}>
                      {trade.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-mono text-text-main border-b border-border-subtle/30">{formatTime(trade.entry_time)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-text-main border-b border-border-subtle/30">${trade.entry_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4 whitespace-nowrap font-mono text-text-main border-b border-border-subtle/30">{formatTime(trade.exit_time)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-text-main border-b border-border-subtle/30">${trade.exit_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className={`px-6 py-4 whitespace-nowrap text-right font-mono font-bold border-b border-border-subtle/30 ${
                    isProfit ? 'text-bullish' : isLoss ? 'text-bearish' : 'text-text-muted'
                  }`}>
                    {isProfit ? '+' : ''}{trade.profit_pct.toFixed(2)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
