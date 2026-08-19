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
  Sparkles, 
  TrendingUp, 
  ShieldCheck,
  Zap
} from 'lucide-react';
import { getDeviceTimezoneOffset } from '../shared/lib/timezone';

export const Dashboard: React.FC = () => {
  const [globalSymbol, setGlobalSymbol] = useState("BTC/USDT");

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
                Simultaneously monitor 4 independent timeframes (15m, 1h, 4h, 1d) with ultra-low latency Binance WebSocket multiplexer.
              </p>
            </div>
          </div>
        </div>

        {/* Global Symbol & Quick Action */}
        <div className="flex items-center gap-3 w-full xl:w-auto shrink-0">
          <div className="flex items-center gap-1.5 bg-bg-deep border border-border-subtle rounded-xl p-1.5 flex-1 lg:flex-none">
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

          <Link
            to="/backtest"
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-bg-deep font-bold rounded-xl text-xs transition-all duration-300 shadow-md shadow-brand-500/20 hover:scale-[1.02]"
          >
            <FlaskConical size={16} />
            <span>Launch Backtest Lab</span>
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
        {/* Chart 1: 15m */}
        <div className="bg-bg-panel/60 border border-border-subtle rounded-2xl p-4 backdrop-blur-md shadow-md h-[450px] flex flex-col">
          <div className="flex justify-between items-center mb-2 shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-text-main">{globalSymbol}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-brand-500/10 text-brand-400 font-mono">15m (Scalp / Intraday)</span>
            </div>
            <span className="text-[11px] text-text-muted font-mono flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-bullish-bright animate-ping"></span> Realtime Feed
            </span>
          </div>
          <div className="flex-1 w-full h-full min-h-[380px]">
            <TradingChart symbol={globalSymbol} initialTimeframe="15m" />
          </div>
        </div>

        {/* Chart 2: 1h */}
        <div className="bg-bg-panel/60 border border-border-subtle rounded-2xl p-4 backdrop-blur-md shadow-md h-[450px] flex flex-col">
          <div className="flex justify-between items-center mb-2 shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-text-main">{globalSymbol}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-accent-purple/10 text-accent-purple font-mono">1h (Hourly Standard)</span>
            </div>
            <span className="text-[11px] text-text-muted font-mono flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-bullish-bright animate-ping"></span> Realtime Feed
            </span>
          </div>
          <div className="flex-1 w-full h-full min-h-[380px]">
            <TradingChart symbol={globalSymbol} initialTimeframe="1h" />
          </div>
        </div>

        {/* Chart 3: 4h */}
        <div className="bg-bg-panel/60 border border-border-subtle rounded-2xl p-4 backdrop-blur-md shadow-md h-[450px] flex flex-col">
          <div className="flex justify-between items-center mb-2 shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-text-main">{globalSymbol}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-accent-blue/10 text-accent-blue font-mono">4h (Swing Trend)</span>
            </div>
            <span className="text-[11px] text-text-muted font-mono flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-bullish-bright animate-ping"></span> Realtime Feed
            </span>
          </div>
          <div className="flex-1 w-full h-full min-h-[380px]">
            <TradingChart symbol={globalSymbol} initialTimeframe="4h" />
          </div>
        </div>

        {/* Chart 4: 1d */}
        <div className="bg-bg-panel/60 border border-border-subtle rounded-2xl p-4 backdrop-blur-md shadow-md h-[450px] flex flex-col">
          <div className="flex justify-between items-center mb-2 shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-text-main">{globalSymbol}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-accent-cyan/10 text-accent-cyan font-mono">1d (Macro Daily)</span>
            </div>
            <span className="text-[11px] text-text-muted font-mono flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-bullish-bright animate-ping"></span> Realtime Feed
            </span>
          </div>
          <div className="flex-1 w-full h-full min-h-[380px]">
            <TradingChart symbol={globalSymbol} initialTimeframe="1d" />
          </div>
        </div>
      </div>
    </div>
  );
};
