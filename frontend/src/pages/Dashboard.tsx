import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { TradingChart } from '../components/Charts/TradingChart';
import { 
  Activity, 
  FlaskConical, 
  Bot, 
  Trophy, 
  ExternalLink, 
  Radio, 
  Layers, 
  Zap
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
    <div className="p-4 md:p-6 max-w-[1750px] mx-auto space-y-6 text-text-main flex flex-col min-h-screen">
      {/* Top Header & Ticker Bar */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-bg-panel/80 p-5 rounded-2xl border border-border-subtle backdrop-blur-xl shadow-lg shrink-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-500/10 text-brand-400 rounded-xl border border-brand-500/20 shrink-0">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-text-main flex items-center gap-2 flex-wrap">
                Real-Time Multi-Timeframe Monitor
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-bullish/15 text-bullish-bright border border-bullish/30 flex items-center gap-1 font-mono">
                  <Radio size={12} className="animate-pulse" /> LIVE STREAM ({getDeviceTimezoneOffset()})
                </span>
              </h1>
              <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                Simultaneously monitor 4 independent timeframes with live MA(20), Volume, and technical LONG / SHORT / EXIT signals.
              </p>
            </div>
          </div>
        </div>

        {/* Global Symbol, Timeframe Preset & Quick Action */}
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto shrink-0">
          {/* Symbol Selectors */}
          <div className="flex items-center gap-1 bg-bg-deep border border-border-subtle rounded-xl p-1 shrink-0">
            {symbols.map(s => (
              <button
                key={s.value}
                onClick={() => setGlobalSymbol(s.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  globalSymbol === s.value
                    ? 'bg-brand-500 text-bg-deep shadow-sm'
                    : 'text-text-muted hover:text-text-main hover:bg-bg-surface'
                }`}
              >
                <span>{s.ticker}</span>
              </button>
            ))}
          </div>

          {/* Timeframe Preset Mode */}
          <div className="flex items-center gap-1 bg-bg-deep border border-border-subtle rounded-xl p-1 shrink-0 text-xs font-bold">
            <button
              onClick={() => handlePresetChange('scalp')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                presetMode === 'scalp' ? 'bg-brand-500/20 text-brand-400 border border-brand-500/40' : 'text-text-muted hover:text-text-main'
              }`}
              title="1m, 5m, 15m, 1h"
            >
              Scalp (1m - 1h)
            </button>
            <button
              onClick={() => handlePresetChange('standard')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                presetMode === 'standard' ? 'bg-brand-500/20 text-brand-400 border border-brand-500/40' : 'text-text-muted hover:text-text-main'
              }`}
              title="5m, 15m, 1h, 4h"
            >
              Standard (5m - 4h)
            </button>
            <button
              onClick={() => handlePresetChange('macro')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                presetMode === 'macro' ? 'bg-brand-500/20 text-brand-400 border border-brand-500/40' : 'text-text-muted hover:text-text-main'
              }`}
              title="15m, 1h, 4h, 1d"
            >
              Macro (15m - 1d)
            </button>
          </div>

          <Link
            to="/backtest"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-bg-deep font-bold rounded-xl text-xs transition-all duration-300 shadow-md shadow-brand-500/20 hover:scale-[1.02] shrink-0"
          >
            <FlaskConical size={15} />
            <span>Launch Backtest</span>
          </Link>
        </div>
      </div>

      {/* Feature Highlights Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        <Link 
          to="/backtest"
          className="bg-bg-panel/60 hover:bg-bg-panel border border-border-subtle hover:border-brand-500/40 p-4 rounded-2xl transition-all duration-300 group shadow-md"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-brand-400 font-bold text-sm">
              <FlaskConical size={18} />
              <span>Backtest Workbench</span>
            </div>
            <ExternalLink size={14} className="text-text-muted group-hover:text-brand-400 transition-colors" />
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Institutional backtest suite with 12-column trade execution log, 5bps slippage simulation, Stop Loss / Take Profit rules, and custom date range filters.
          </p>
        </Link>

        <Link 
          to="/search"
          className="bg-bg-panel/60 hover:bg-bg-panel border border-border-subtle hover:border-accent-purple/40 p-4 rounded-2xl transition-all duration-300 group shadow-md"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-accent-purple font-bold text-sm">
              <Bot size={18} />
              <span>AI Search Engine</span>
            </div>
            <ExternalLink size={14} className="text-text-muted group-hover:text-accent-purple transition-colors" />
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Discover optimal parameter combinations using Genetic Algorithms and continuous background search loops.
          </p>
        </Link>

        <Link 
          to="/leaderboard"
          className="bg-bg-panel/60 hover:bg-bg-panel border border-border-subtle hover:border-brand-500/40 p-4 rounded-2xl transition-all duration-300 group shadow-md"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-brand-400 font-bold text-sm">
              <Trophy size={18} />
              <span>Strategy Leaderboard</span>
            </div>
            <ExternalLink size={14} className="text-text-muted group-hover:text-brand-400 transition-colors" />
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Top-performing quantitative strategies evaluated by weighted composite score and synchronized in real-time via Redis Streams.
          </p>
        </Link>
      </div>

      {/* 4 Multi-Timeframe Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
        {/* Chart 1 */}
        <div className="bg-bg-panel/60 border border-border-subtle rounded-2xl p-3.5 backdrop-blur-md shadow-md h-[460px] flex flex-col">
          <div className="flex-1 w-full h-full min-h-[380px]">
            <TradingChart key={`${globalSymbol}-${tf1}`} symbol={globalSymbol} initialTimeframe={tf1} autoSignals={true} />
          </div>
        </div>

        {/* Chart 2 */}
        <div className="bg-bg-panel/60 border border-border-subtle rounded-2xl p-3.5 backdrop-blur-md shadow-md h-[460px] flex flex-col">
          <div className="flex-1 w-full h-full min-h-[380px]">
            <TradingChart key={`${globalSymbol}-${tf2}`} symbol={globalSymbol} initialTimeframe={tf2} autoSignals={true} />
          </div>
        </div>

        {/* Chart 3 */}
        <div className="bg-bg-panel/60 border border-border-subtle rounded-2xl p-3.5 backdrop-blur-md shadow-md h-[460px] flex flex-col">
          <div className="flex-1 w-full h-full min-h-[380px]">
            <TradingChart key={`${globalSymbol}-${tf3}`} symbol={globalSymbol} initialTimeframe={tf3} autoSignals={true} />
          </div>
        </div>

        {/* Chart 4 */}
        <div className="bg-bg-panel/60 border border-border-subtle rounded-2xl p-3.5 backdrop-blur-md shadow-md h-[460px] flex flex-col">
          <div className="flex-1 w-full h-full min-h-[380px]">
            <TradingChart key={`${globalSymbol}-${tf4}`} symbol={globalSymbol} initialTimeframe={tf4} autoSignals={true} />
          </div>
        </div>
      </div>
    </div>
  );
};
