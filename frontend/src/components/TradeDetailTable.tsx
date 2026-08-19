import React, { useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Clock, Filter, DollarSign, Download, CheckCircle2, XCircle } from 'lucide-react';
import { getDeviceTimezoneOffset, formatLocalDateTime } from '../shared/lib/timezone';

export interface TradeRecord {
  id?: string;
  symbol?: string;
  type: 'LONG' | 'SHORT';
  entry_time: string;
  entry_price: number;
  exit_time: string;
  exit_price: number;
  volume_usd?: number;
  stop_loss?: number | null;
  take_profit?: number | null;
  fee?: number;
  slippage?: number;
  profit_usd?: number;
  profit_pct: number;
  duration_mins?: number;
}

interface TradeDetailTableProps {
  trades: TradeRecord[];
  onRowClick?: (trade: TradeRecord) => void;
  selectedTradeId?: string | null;
}

type SortField = 'entry_time' | 'profit_pct' | 'profit_usd' | 'type' | 'volume_usd' | 'entry_price' | 'exit_price' | 'fee';
type SortDirection = 'asc' | 'desc';
type FilterType = 'ALL' | 'WINS' | 'LOSSES' | 'LONG' | 'SHORT';

export const TradeDetailTable: React.FC<TradeDetailTableProps> = ({ 
  trades, 
  onRowClick,
  selectedTradeId 
}) => {
  const [sortField, setSortField] = useState<SortField>('entry_time');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterType, setFilterType] = useState<FilterType>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Filter trades
  const filteredTrades = trades.filter(trade => {
    if (filterType === 'WINS' && trade.profit_pct <= 0) return false;
    if (filterType === 'LOSSES' && trade.profit_pct > 0) return false;
    if (filterType === 'LONG' && trade.type !== 'LONG') return false;
    if (filterType === 'SHORT' && trade.type !== 'SHORT') return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const sym = (trade.symbol || '').toLowerCase();
      const typ = trade.type.toLowerCase();
      if (!sym.includes(q) && !typ.includes(q) && !trade.entry_time.includes(q)) return false;
    }
    return true;
  });

  const sortedTrades = [...filteredTrades].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'entry_time') {
      comparison = new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime();
    } else if (sortField === 'profit_pct') {
      comparison = a.profit_pct - b.profit_pct;
    } else if (sortField === 'profit_usd') {
      comparison = (a.profit_usd || 0) - (b.profit_usd || 0);
    } else if (sortField === 'type') {
      comparison = a.type.localeCompare(b.type);
    } else if (sortField === 'entry_price') {
      comparison = a.entry_price - b.entry_price;
    } else if (sortField === 'exit_price') {
      comparison = a.exit_price - b.exit_price;
    } else if (sortField === 'volume_usd') {
      comparison = (a.volume_usd || 0) - (b.volume_usd || 0);
    } else if (sortField === 'fee') {
      comparison = (a.fee || 0) - (b.fee || 0);
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-text-muted/40" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-brand-400" /> : <ArrowDown className="w-3 h-3 text-brand-400" />;
  };

  // Format device local time
  const formatLocalTime = (timeStr: string) => {
    return formatLocalDateTime(timeStr, true);
  };

  const exportCSV = () => {
    if (!trades.length) return;
    const tz = getDeviceTimezoneOffset();
    const headers = [
      "ID", 
      "Pair", 
      "Direction", 
      `Entry Time (${tz})`, 
      "Entry Price", 
      "Stop Loss", 
      "Take Profit", 
      `Exit Time (${tz})`, 
      "Exit Price", 
      "Capital (USD)", 
      "Fee (USD)", 
      "Slippage (USD)", 
      "Net Profit (USD)", 
      "Net Profit (%)"
    ];
    const rows = trades.map((t, idx) => [
      t.id || idx + 1,
      t.symbol || 'BTC/USDT',
      t.type,
      formatLocalTime(t.entry_time),
      t.entry_price,
      t.stop_loss || '',
      t.take_profit || '',
      formatLocalTime(t.exit_time),
      t.exit_price,
      t.volume_usd || 100,
      t.fee || 0,
      t.slippage || 0,
      t.profit_usd || 0,
      t.profit_pct
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `trade_records_${tz.toLowerCase()}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!trades || trades.length === 0) {
    return (
      <div className="bg-bg-panel/60 backdrop-blur-md border border-border-subtle rounded-2xl p-10 text-center text-text-muted flex flex-col items-center justify-center min-h-[280px]">
        <Clock className="w-12 h-12 mb-3 opacity-20 text-brand-400" />
        <h4 className="text-base font-semibold text-text-main">No Trades Executed</h4>
        <p className="text-xs text-text-muted mt-1 max-w-sm">
          Run a backtest with selected strategies above to inspect the comprehensive 12-column execution log with {getDeviceTimezoneOffset()} timestamps.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-bg-panel/70 backdrop-blur-md border border-border-subtle rounded-2xl overflow-hidden flex flex-col h-full shadow-lg">
      {/* Header controls & filters */}
      <div className="p-4 border-b border-border-subtle bg-bg-panel/90 shrink-0 flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-sm text-text-main flex items-center gap-2">
            Detailed Trade Execution Log
            <span className="px-2 py-0.5 text-[11px] bg-brand-500/10 text-brand-400 rounded-full border border-brand-500/20 font-mono">
              {filteredTrades.length} / {trades.length} trades
            </span>
            <span className="text-[10px] text-text-dim font-mono">Timezone: {getDeviceTimezoneOffset()}</span>
          </h3>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Filters */}
          <div className="flex bg-bg-deep p-1 rounded-xl border border-border-subtle text-xs font-semibold">
            {(['ALL', 'WINS', 'LOSSES', 'LONG', 'SHORT'] as FilterType[]).map(tab => (
              <button
                key={tab}
                onClick={() => setFilterType(tab)}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filterType === tab 
                    ? 'bg-brand-500 text-bg-deep font-bold shadow-sm' 
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <button
            onClick={exportCSV}
            title={`Export CSV (${getDeviceTimezoneOffset()})`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-surface hover:bg-bg-hover border border-border-subtle text-xs rounded-xl transition-colors text-text-muted hover:text-text-main font-medium"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 12-column Table */}
      <div className="overflow-x-auto overflow-y-auto flex-1 relative max-h-[600px]">
        <table className="w-full text-left text-xs text-text-muted border-collapse">
          <thead className="bg-bg-surface/90 backdrop-blur-xl text-[11px] uppercase font-bold text-text-muted tracking-wider sticky top-0 z-10 border-b border-border-subtle shadow-sm">
            <tr>
              <th className="px-3.5 py-3 whitespace-nowrap">#</th>
              <th className="px-3.5 py-3 whitespace-nowrap">Pair</th>
              <th className="px-3.5 py-3 whitespace-nowrap cursor-pointer hover:text-brand-400" onClick={() => handleSort('type')}>
                <div className="flex items-center gap-1">Direction <SortIcon field="type" /></div>
              </th>
              <th className="px-3.5 py-3 whitespace-nowrap cursor-pointer hover:text-brand-400" onClick={() => handleSort('entry_time')}>
                <div className="flex items-center gap-1">Entry ({getDeviceTimezoneOffset()}) <SortIcon field="entry_time" /></div>
              </th>
              <th className="px-3.5 py-3 whitespace-nowrap text-right cursor-pointer hover:text-brand-400" onClick={() => handleSort('entry_price')}>
                <div className="flex items-center justify-end gap-1"><SortIcon field="entry_price" /> Entry Price</div>
              </th>
              <th className="px-3.5 py-3 whitespace-nowrap text-right cursor-pointer hover:text-brand-400" onClick={() => handleSort('volume_usd')}>
                <div className="flex items-center justify-end gap-1"><SortIcon field="volume_usd" /> Capital ($)</div>
              </th>
              <th className="px-3.5 py-3 whitespace-nowrap text-right">Stop Loss</th>
              <th className="px-3.5 py-3 whitespace-nowrap text-right">Take Profit</th>
              <th className="px-3.5 py-3 whitespace-nowrap">Exit ({getDeviceTimezoneOffset()})</th>
              <th className="px-3.5 py-3 whitespace-nowrap text-right cursor-pointer hover:text-brand-400" onClick={() => handleSort('exit_price')}>
                <div className="flex items-center justify-end gap-1"><SortIcon field="exit_price" /> Exit Price</div>
              </th>
              <th className="px-3.5 py-3 whitespace-nowrap text-right cursor-pointer hover:text-brand-400" onClick={() => handleSort('fee')}>
                <div className="flex items-center justify-end gap-1"><SortIcon field="fee" /> Fee</div>
              </th>
              <th className="px-3.5 py-3 whitespace-nowrap text-right">Slippage (5bps)</th>
              <th className="px-3.5 py-3 whitespace-nowrap text-right cursor-pointer hover:text-brand-400" onClick={() => handleSort('profit_pct')}>
                <div className="flex items-center justify-end gap-1"><SortIcon field="profit_pct" /> Net Profit</div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle/40 font-mono">
            {sortedTrades.map((trade, idx) => {
              const isProfit = trade.profit_pct > 0;
              const isLoss = trade.profit_pct < 0;
              const isSelected = selectedTradeId === trade.id || selectedTradeId === String(idx + 1);

              return (
                <tr 
                  key={trade.id || idx} 
                  onClick={() => onRowClick && onRowClick(trade)}
                  className={`transition-colors cursor-pointer ${
                    isSelected 
                      ? 'bg-brand-500/15 border-l-4 border-brand-400' 
                      : idx % 2 === 0 ? 'bg-bg-panel/40 hover:bg-bg-surface/60' : 'bg-transparent hover:bg-bg-surface/60'
                  }`}
                >
                  <td className="px-3.5 py-2.5 whitespace-nowrap font-mono text-text-dim text-[11px]">
                    #{idx + 1}
                  </td>
                  <td className="px-3.5 py-2.5 whitespace-nowrap font-sans font-bold text-text-main">
                    {trade.symbol || 'BTC/USDT'}
                  </td>
                  <td className="px-3.5 py-2.5 whitespace-nowrap font-sans">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                      trade.type === 'LONG' 
                        ? 'bg-bullish/15 text-bullish-bright border border-bullish/30' 
                        : 'bg-bearish/15 text-bearish-bright border border-bearish/30'
                    }`}>
                      {trade.type}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 whitespace-nowrap text-text-main text-[11px]">
                    {formatLocalTime(trade.entry_time)}
                  </td>
                  <td className="px-3.5 py-2.5 whitespace-nowrap text-right text-text-main font-semibold">
                    ${trade.entry_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-3.5 py-2.5 whitespace-nowrap text-right text-text-main">
                    ${(trade.volume_usd || 100).toFixed(2)}
                  </td>
                  <td className="px-3.5 py-2.5 whitespace-nowrap text-right text-bearish-bright">
                    {trade.stop_loss ? `$${trade.stop_loss.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-3.5 py-2.5 whitespace-nowrap text-right text-bullish-bright">
                    {trade.take_profit ? `$${trade.take_profit.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-3.5 py-2.5 whitespace-nowrap text-text-main text-[11px]">
                    {formatLocalTime(trade.exit_time)}
                  </td>
                  <td className="px-3.5 py-2.5 whitespace-nowrap text-right text-text-main font-semibold">
                    ${trade.exit_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-3.5 py-2.5 whitespace-nowrap text-right text-text-muted">
                    ${(trade.fee || 0.10).toFixed(3)}
                  </td>
                  <td className="px-3.5 py-2.5 whitespace-nowrap text-right text-text-muted">
                    ${(trade.slippage || 0.05).toFixed(3)}
                  </td>
                  <td className={`px-3.5 py-2.5 whitespace-nowrap text-right font-bold ${
                    isProfit ? 'text-bullish-bright' : isLoss ? 'text-bearish-bright' : 'text-text-muted'
                  }`}>
                    <div className="flex flex-col items-end leading-tight">
                      <span>{isProfit ? '+' : ''}${(trade.profit_usd || ((trade.volume_usd || 100) * trade.profit_pct / 100)).toFixed(2)}</span>
                      <span className="text-[10px] opacity-80">({isProfit ? '+' : ''}{trade.profit_pct.toFixed(2)}%)</span>
                    </div>
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
