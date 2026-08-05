import React, { useState, useRef } from 'react';
import { DashboardLayout } from '../components/Layout/DashboardLayout';
import { TradingChart, type TradingChartHandle } from '../components/Charts/TradingChart';
import { TradeDetailTable, type TradeRecord } from '../components/TradeDetailTable';
import { Play, Trophy, AlertCircle, X } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const [globalSymbol, setGlobalSymbol] = useState("BTC/USDT");
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const chart15mRef = useRef<TradingChartHandle>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  const [compositeLogic, setCompositeLogic] = useState("AND");
  const [strategyWeights, setStrategyWeights] = useState<Record<string, number>>({});

  const handleWeightChange = (id: string, weight: number) => {
    setStrategyWeights(prev => ({ ...prev, [id]: weight }));
  };

  const toggleStrategy = (id: string) => {
    setSelectedStrategies(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleRunBacktest = async () => {
    if (selectedStrategies.length === 0) {
      setToast({ message: "Please select at least one strategy from the sidebar.", type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    
    setLoading(true);
    try {
      const payload = {
        strategies: selectedStrategies.map(id => ({ 
          id, 
          params: compositeLogic === "WEIGHTED" ? { weight: strategyWeights[id] || 0.5 } : {} 
        })),
        logic: compositeLogic,
        symbol: globalSymbol,
        timeframe: "15m", // We run the backtest on the 15m timeframe for more signals
        limit: 2000
      };
      
      const res = await fetch("http://localhost:8000/api/v1/backtest/run-with-trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Backtest request failed");
      }
      
      const data = await res.json();
      if (data.metrics) {
        setMetrics(data.metrics);
      }
      if (data.trades) {
        setTrades(data.trades);
      }
      if (data.markers && chart15mRef.current) {
        chart15mRef.current.setMarkers(data.markers);
      }
      
      setToast({ message: 'Backtest completed successfully!', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (e: any) {
      console.error(e);
      setToast({ message: e.message || 'Backtest failed', type: 'error' });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleTradeClick = (trade: TradeRecord) => {
    if (chart15mRef.current) {
      const entryTime = new Date(trade.entry_time).getTime() / 1000;
      const exitTime = new Date(trade.exit_time).getTime() / 1000;
      chart15mRef.current.highlightTrade(entryTime, exitTime);
    }
  };

  return (
    <DashboardLayout selectedStrategies={selectedStrategies} toggleStrategy={toggleStrategy}>
      <div className="flex flex-col gap-4 h-full">
        <div className="flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Multi-Timeframe Analysis</h1>
            <select
              value={globalSymbol}
              onChange={(e) => setGlobalSymbol(e.target.value)}
              className="bg-bg-panel/40 border border-border-subtle text-text-main text-sm rounded-xl focus:ring-brand-500 focus:border-brand-500 block p-2 outline-none backdrop-blur-md"
            >
              <option value="BTC/USDT">BTC/USDT</option>
              <option value="ETH/USDT">ETH/USDT</option>
              <option value="SOL/USDT">SOL/USDT</option>
              <option value="BNB/USDT">BNB/USDT</option>
              <option value="XRP/USDT">XRP/USDT</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleRunBacktest}
              disabled={loading}
              className={`flex items-center gap-2 px-6 py-3 bg-gradient-to-tr from-brand-500 to-brand-600 text-bg-deep font-semibold rounded-full transition-all duration-300 cursor-pointer shadow-sm ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.03] hover:shadow-md'}`}
            >
              <Play size={18} fill="currentColor" />
              {loading ? 'Running Engine...' : 'Run Backtest'}
            </button>
          </div>
        </div>
        
        {selectedStrategies.length > 1 && (
          <div className="shrink-0 bg-bg-panel/60 p-4 rounded-xl border border-brand-500/30 backdrop-blur-md">
            <div className="flex items-center gap-4 mb-4">
              <span className="text-sm font-bold text-slate-300">Composite Logic:</span>
              <select
                value={compositeLogic}
                onChange={(e) => setCompositeLogic(e.target.value)}
                className="bg-bg-panel/40 border border-border-subtle text-text-main text-sm rounded-xl focus:ring-brand-500 focus:border-brand-500 block p-2 outline-none"
              >
                <option value="AND">AND (All must agree)</option>
                <option value="OR">OR (Any can signal)</option>
                <option value="WEIGHTED">WEIGHTED (Score based on weights)</option>
              </select>
            </div>
            
            {compositeLogic === 'WEIGHTED' && (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {selectedStrategies.map(id => (
                  <div key={id} className="bg-bg-deep/50 p-4 rounded-xl border border-border-subtle">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-semibold text-text-main truncate max-w-[150px]">{id}</span>
                      <span className="text-xs text-brand-500 font-mono">{(strategyWeights[id] || 0.5).toFixed(2)}</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.1" 
                      max="1.0" 
                      step="0.1" 
                      value={strategyWeights[id] || 0.5} 
                      onChange={(e) => handleWeightChange(id, parseFloat(e.target.value))}
                      className="w-full h-1 bg-border-subtle rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {metrics && (
          <div className="shrink-0 grid grid-cols-4 gap-4 bg-bg-panel/60 p-5 rounded-xl border border-brand-500/30 backdrop-blur-md shadow-lg shadow-brand-500/5 animate-in fade-in slide-in-from-top-4 duration-500">
            <div>
              <div className="text-sm font-medium text-text-muted uppercase tracking-wider">Total Return</div>
              <div className={`text-3xl font-bold mt-1 font-mono ${(metrics.total_return || 0) >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                {((metrics.total_return || 0) * 100).toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-text-muted uppercase tracking-wider">Winrate</div>
              <div className="text-3xl font-bold mt-1 text-text-main font-mono">
                {((metrics.winrate || 0) * 100).toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-text-muted uppercase tracking-wider">Max Drawdown</div>
              <div className="text-3xl font-bold mt-1 text-bearish font-mono">
                {((metrics.max_drawdown || 0) * 100).toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-text-muted uppercase tracking-wider">Total Trades</div>
              <div className="text-3xl font-bold mt-1 text-brand-500 font-mono">
                {metrics.total_trades || 0}
              </div>
            </div>
          </div>
        )}
        
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 h-[500px]">
              <TradingChart ref={chart15mRef} symbol={globalSymbol} initialTimeframe="15m" />
            </div>
            <div className="xl:col-span-1 h-[500px]">
              <TradeDetailTable trades={trades} onRowClick={handleTradeClick} />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="h-[350px]">
              <TradingChart symbol={globalSymbol} initialTimeframe="1h" />
            </div>
            <div className="h-[350px]">
              <TradingChart symbol={globalSymbol} initialTimeframe="4h" />
            </div>
            <div className="h-[350px]">
              <TradingChart symbol={globalSymbol} initialTimeframe="1d" />
            </div>
          </div>
        </div>
      </div>
      
      {toast && (
        <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-xl border flex items-center justify-between gap-4 shadow-xl z-50 animate-in slide-in-from-bottom-5 fade-in duration-300 backdrop-blur-xl ${
          toast.type === 'success' 
            ? 'bg-bullish/10 border-bullish/30 text-bullish' 
            : 'bg-bearish/10 border-bearish/30 text-bearish'
        }`}>
          <div className="flex items-center gap-3">
            {toast.type === 'success' ? <Trophy size={20} className="text-bullish" /> : <AlertCircle size={20} className="text-bearish" />}
            <span className="font-semibold text-[15px]">{toast.message}</span>
          </div>
          <button onClick={() => setToast(null)} className="opacity-70 hover:opacity-100 transition-opacity cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}
    </DashboardLayout>
  );
};
