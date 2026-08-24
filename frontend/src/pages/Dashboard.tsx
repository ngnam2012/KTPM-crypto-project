import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { TradingChart } from '../components/Charts/TradingChart';
import { 
  Activity, 
  FlaskConical, 
  Bot, 
  Trophy, 
  ExternalLink, 
  Radio 
} from 'lucide-react';
import { getDeviceTimezoneOffset } from '../shared/lib/timezone';

export const Dashboard: React.FC = () => {
  const [globalSymbol, setGlobalSymbol] = useState("BTC/USDT");
  const [presetMode, setPresetMode] = useState<'scalp' | 'standard' | 'macro'>('scalp');

  const [tf1, setTf1] = useState("1m");
  const [tf2, setTf2] = useState("5m");
  const [tf3, setTf3] = useState("15m");
  const [tf4, setTf4] = useState("1h");

  const handlePresetChange = (mode: 'scalp' | 'standard' | 'macro') => {
    setPresetMode(mode);
    if (mode === 'scalp') {
      setTf1("1m");
      setTf2("5m");
      setTf3("15m");
      setTf4("1h");
    } else if (mode === 'standard') {
      setTf1("5m");
      setTf2("15m");
      setTf3("1h");
      setTf4("4h");
    } else {
      setTf1("15m");
      setTf2("1h");
      setTf3("4h");
      setTf4("1d");
    }
  };

  const symbols = [
    { label: "Bitcoin", value: "BTC/USDT", ticker: "BTC" },
    { label: "Ethereum", value: "ETH/USDT", ticker: "ETH" },
    { label: "Solana", value: "SOL/USDT", ticker: "SOL" },
    { label: "Binance Coin", value: "BNB/USDT", ticker: "BNB" },
    { label: "Ripple", value: "XRP/USDT", ticker: "XRP" },
  ];

  return (
    <div className="p-3 sm:p-4 lg:p-5 max-w-[1800px] mx-auto space-y-3 lg:space-y-4 text-text-main">
      {/* Top Header & Control Toolbar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 bg-bg-panel/80 p-3 sm:p-4 rounded-2xl border border-border-subtle backdrop-blur-xl shadow-lg">
        {/* Title & Live Status */}
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-brand-500/10 text-brand-400 rounded-xl border border-brand-500/20 shrink-0">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-text-main whitespace-nowrap">
                Multi-Timeframe Monitor
              </h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-bullish/15 text-bullish-bright border border-bullish/30 flex items-center gap-1 font-mono">
                <Radio size={10} className="animate-pulse" /> LIVE ({getDeviceTimezoneOffset()})
              </span>
            </div>
            <p className="text-[11px] text-text-muted hidden md:block">
              Simultaneous 4-timeframe live streaming with MA(20) and volume metrics.
            </p>
          </div>
        </div>

        {/* Global Symbol, Timeframe Preset & Quick Action */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Symbol Selectors */}
          <div className="flex items-center gap-1 bg-bg-deep border border-border-subtle rounded-xl p-1 shrink-0">
            {symbols.map(s => (
              <button
                key={s.value}
                onClick={() => setGlobalSymbol(s.value)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  globalSymbol === s.value
                    ? 'bg-brand-500 text-bg-deep shadow-sm'
                    : 'text-text-muted hover:text-text-main hover:bg-bg-surface'
                }`}
              >
                {s.ticker}
              </button>
            ))}
          </div>

          {/* Timeframe Preset Mode */}
          <div className="flex items-center gap-1 bg-bg-deep border border-border-subtle rounded-xl p-1 shrink-0 text-xs font-bold">
            <button
              onClick={() => handlePresetChange('scalp')}
              className={`px-2 py-1 rounded-lg transition-all ${
                presetMode === 'scalp' ? 'bg-brand-500/20 text-brand-400 border border-brand-500/40' : 'text-text-muted hover:text-text-main'
              }`}
              title="1m, 5m, 15m, 1h"
            >
              Scalp (1m-1h)
            </button>
            <button
              onClick={() => handlePresetChange('standard')}
              className={`px-2 py-1 rounded-lg transition-all ${
                presetMode === 'standard' ? 'bg-brand-500/20 text-brand-400 border border-brand-500/40' : 'text-text-muted hover:text-text-main'
              }`}
              title="5m, 15m, 1h, 4h"
            >
              Standard (5m-4h)
            </button>
            <button
              onClick={() => handlePresetChange('macro')}
              className={`px-2 py-1 rounded-lg transition-all ${
                presetMode === 'macro' ? 'bg-brand-500/20 text-brand-400 border border-brand-500/40' : 'text-text-muted hover:text-text-main'
              }`}
              title="15m, 1h, 4h, 1d"
            >
              Macro (15m-1d)
            </button>
          </div>

          {/* Launch Backtest CTA */}
          <Link
            to="/backtest"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-bg-deep font-bold rounded-xl text-xs transition-all duration-300 shadow-md shadow-brand-500/20 hover:scale-[1.02] shrink-0 ml-auto lg:ml-0"
          >
            <FlaskConical size={14} />
            <span>Launch Backtest</span>
          </Link>
        </div>
      </div>

      {/* 4 Multi-Timeframe Charts 2x2 Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
        {/* Chart 1 */}
        <div className="bg-bg-panel/60 border border-border-subtle rounded-2xl p-2 sm:p-3 backdrop-blur-md shadow-md h-[340px] lg:h-[calc(43vh-20px)] min-h-[290px] max-h-[460px] flex flex-col overflow-hidden">
          <div className="w-full h-full flex-1 min-h-0 relative">
            <TradingChart key={`${globalSymbol}-${tf1}`} symbol={globalSymbol} initialTimeframe={tf1} />
          </div>
        </div>

        {/* Chart 2 */}
        <div className="bg-bg-panel/60 border border-border-subtle rounded-2xl p-2 sm:p-3 backdrop-blur-md shadow-md h-[340px] lg:h-[calc(43vh-20px)] min-h-[290px] max-h-[460px] flex flex-col overflow-hidden">
          <div className="w-full h-full flex-1 min-h-0 relative">
            <TradingChart key={`${globalSymbol}-${tf2}`} symbol={globalSymbol} initialTimeframe={tf2} />
          </div>
        </div>

        {/* Chart 3 */}
        <div className="bg-bg-panel/60 border border-border-subtle rounded-2xl p-2 sm:p-3 backdrop-blur-md shadow-md h-[340px] lg:h-[calc(43vh-20px)] min-h-[290px] max-h-[460px] flex flex-col overflow-hidden">
          <div className="w-full h-full flex-1 min-h-0 relative">
            <TradingChart key={`${globalSymbol}-${tf3}`} symbol={globalSymbol} initialTimeframe={tf3} />
          </div>
        </div>

        {/* Chart 4 */}
        <div className="bg-bg-panel/60 border border-border-subtle rounded-2xl p-2 sm:p-3 backdrop-blur-md shadow-md h-[340px] lg:h-[calc(43vh-20px)] min-h-[290px] max-h-[460px] flex flex-col overflow-hidden">
          <div className="w-full h-full flex-1 min-h-0 relative">
            <TradingChart key={`${globalSymbol}-${tf4}`} symbol={globalSymbol} initialTimeframe={tf4} />
          </div>
        </div>
      </div>

      {/* Feature Highlights Footer Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
        <Link 
          to="/backtest"
          className="bg-bg-panel/40 hover:bg-bg-panel/80 border border-border-subtle hover:border-brand-500/40 p-3 rounded-xl transition-all duration-300 group shadow-sm flex items-center justify-between"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-brand-500/10 text-brand-400 rounded-lg shrink-0">
              <FlaskConical size={16} />
            </div>
            <div>
              <div className="text-xs font-bold text-text-main group-hover:text-brand-400 transition-colors">
                Backtest Workbench
              </div>
              <div className="text-[10px] text-text-muted">
                12-column trade logs, 5bps slippage, SL/TP accounting
              </div>
            </div>
          </div>
          <ExternalLink size={13} className="text-text-muted group-hover:text-brand-400 transition-colors shrink-0 ml-2" />
        </Link>

        <Link 
          to="/search"
          className="bg-bg-panel/40 hover:bg-bg-panel/80 border border-border-subtle hover:border-accent-purple/40 p-3 rounded-xl transition-all duration-300 group shadow-sm flex items-center justify-between"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-accent-purple/10 text-accent-purple rounded-lg shrink-0">
              <Bot size={16} />
            </div>
            <div>
              <div className="text-xs font-bold text-text-main group-hover:text-accent-purple transition-colors">
                AI Search Engine
              </div>
              <div className="text-[10px] text-text-muted">
                Genetic Algorithm & Monte Carlo parameter optimization
              </div>
            </div>
          </div>
          <ExternalLink size={13} className="text-text-muted group-hover:text-accent-purple transition-colors shrink-0 ml-2" />
        </Link>

        <Link 
          to="/leaderboard"
          className="bg-bg-panel/40 hover:bg-bg-panel/80 border border-border-subtle hover:border-brand-500/40 p-3 rounded-xl transition-all duration-300 group shadow-sm flex items-center justify-between"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-brand-500/10 text-brand-400 rounded-lg shrink-0">
              <Trophy size={16} />
            </div>
            <div>
              <div className="text-xs font-bold text-text-main group-hover:text-brand-400 transition-colors">
                Strategy Leaderboard
              </div>
              <div className="text-[10px] text-text-muted">
                Real-time Top-K ranking synchronized via Redis Streams
              </div>
            </div>
          </div>
          <ExternalLink size={13} className="text-text-muted group-hover:text-brand-400 transition-colors shrink-0 ml-2" />
        </Link>
      </div>
    </div>
  );
};

