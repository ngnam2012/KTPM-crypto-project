import React, { useState, useEffect } from 'react';
import { Bot, Play, Square, Pause, Settings, RefreshCw, Trophy, AlertCircle, CheckSquare, Square as SquareIcon, Sliders, Layers, RotateCcw } from 'lucide-react';

const AVAILABLE_STRATEGIES = [
  { id: 'ma_crossover', name: 'Moving Average (MA)', desc: 'Trend following MA short/long crossovers', color: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400' },
  { id: 'rsi', name: 'RSI Momentum', desc: 'Overbought / oversold mean reversion', color: 'border-violet-500/40 bg-violet-500/10 text-violet-400' },
  { id: 'bollinger_bands', name: 'Bollinger Bands', desc: 'Volatility envelopes & dynamic breakout/rebound', color: 'border-amber-500/40 bg-amber-500/10 text-amber-400' },
  { id: 'support_resistance', name: 'Support / Resistance', desc: 'Horizontal price action levels & pivots', color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' },
  { id: 'news_sentiment', name: 'News Sentiment (NLP)', desc: 'Real-time FinBERT AI sentiment & social impact', color: 'border-rose-500/40 bg-rose-500/10 text-rose-400' },
  { id: 'smc', name: 'Smart Money Concepts', desc: 'Liquidity sweep & institutional order blocks', color: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-400' },
];

export const SearchPage: React.FC = () => {
  const [isSearching, setIsSearching] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  const [selectedStrategyIds, setSelectedStrategyIds] = useState<string[]>([
    'ma_crossover', 'rsi', 'bollinger_bands', 'support_resistance', 'news_sentiment'
  ]);
  const [selectedLogic, setSelectedLogic] = useState<'ALL' | 'AND' | 'OR' | 'WEIGHTED'>('ALL');

  const [config, setConfig] = useState<{
    numCandidates: number | string;
    timeLimit: number | string;
    batchSize: number | string;
  }>({
    numCandidates: 100,
    timeLimit: 300,
    batchSize: 50
  });

  const [progress, setProgress] = useState({
    tested: 0,
    bestScore: 0,
    timeElapsed: 0,
    total: 100
  });

  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const toggleStrategy = (id: string) => {
    if (isSearching) return;
    setSelectedStrategyIds(prev => 
      prev.includes(id) 
        ? (prev.length > 1 ? prev.filter(s => s !== id) : prev) // keep at least 1
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (isSearching) return;
    if (selectedStrategyIds.length === AVAILABLE_STRATEGIES.length) {
      setSelectedStrategyIds(['ma_crossover', 'rsi']);
    } else {
      setSelectedStrategyIds(AVAILABLE_STRATEGIES.map(s => s.id));
    }
  };

  useEffect(() => {
    const checkInitialState = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/v1/search/status');
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'running') {
            setIsSearching(true);
            setIsPaused(false);
            setProgress({
              tested: data.evaluated ?? data.tested ?? 0,
              bestScore: data.best_score ?? data.bestScore ?? 0,
              timeElapsed: data.time_elapsed ?? data.timeElapsed ?? 0,
              total: data.total || config.numCandidates
            });
            if (data.total) {
              setConfig(c => ({...c, numCandidates: data.total}));
            }
          } else if (data.status === 'paused') {
            setIsSearching(true);
            setIsPaused(true);
            setProgress({
              tested: data.evaluated ?? data.tested ?? 0,
              bestScore: data.best_score ?? data.bestScore ?? 0,
              timeElapsed: data.time_elapsed ?? data.timeElapsed ?? 0,
              total: data.total || config.numCandidates
            });
          } else {
            // idle, stopped, or completed
            setIsSearching(false);
            setIsPaused(false);
            if (data.results_count > 0 || data.status === 'completed' || data.status === 'stopped') {
              fetchResults();
            }
          }
        }
      } catch (err) {
        console.error("Failed to check initial status:", err);
      }
    };
    checkInitialState();
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isSearching && !isPaused) {
      interval = setInterval(async () => {
        try {
          const res = await fetch('http://localhost:8000/api/v1/search/status');
          if (!res.ok) throw new Error("Failed to fetch search status");
          const data = await res.json();
          
          setProgress({
            tested: data.evaluated ?? data.tested ?? 0,
            bestScore: data.best_score ?? data.bestScore ?? 0,
            timeElapsed: data.time_elapsed ?? data.timeElapsed ?? 0,
            total: data.total ?? config.numCandidates
          });

          // Fetch intermediate results periodically
          if (data.results_count > 0 && data.status === 'running') {
            fetchResults();
          }

          if (data.status === 'completed' || data.status === 'stopped' || data.is_completed) {
            setIsSearching(false);
            setIsPaused(false);
            fetchResults();
          } else if (data.status === 'paused') {
            setIsPaused(true);
          }
        } catch (err: any) {
          console.error("Error polling search status:", err);
        }
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isSearching, isPaused]);

  const fetchResults = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/search/results');
      if (!res.ok) throw new Error("Failed to fetch search results");
      const data = await res.json();
      setResults(data.results || data || []);
    } catch (err: any) {
      console.error("Error fetching results:", err);
      setError(err.message);
    }
  };

  const handleStart = async () => {
    try {
      setError(null);
      const logics = selectedLogic === 'ALL' ? ['AND', 'OR', 'WEIGHTED'] : [selectedLogic];
      const res = await fetch('http://localhost:8000/api/v1/search/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          n_candidates: Number(config.numCandidates) || 100,
          time_limit: Number(config.timeLimit) || 300,
          batch_size: Number(config.batchSize) || 50,
          allowed_strategy_ids: selectedStrategyIds,
          allowed_logics: logics
        })
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to start search");
      }

      setIsSearching(true);
      setIsPaused(false);
      setProgress({ tested: 0, bestScore: 0, timeElapsed: 0, total: Number(config.numCandidates) || 100 });
      setResults([]);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePause = async () => {
    try {
      await fetch('http://localhost:8000/api/v1/search/pause', { method: 'POST' });
      setIsPaused(true);
    } catch (err) {
      console.error("Failed to pause search:", err);
    }
  };

  const handleResume = async () => {
    try {
      await fetch('http://localhost:8000/api/v1/search/resume', { method: 'POST' });
      setIsPaused(false);
      setIsSearching(true);
    } catch (err) {
      console.error("Failed to resume search:", err);
    }
  };

  const handleStop = async () => {
    setIsSearching(false);
    setIsPaused(false);
    try {
      await fetch('http://localhost:8000/api/v1/search/stop', { method: 'POST' });
      await fetchResults();
    } catch (err) {
      console.error("Failed to stop search on backend:", err);
    }
  };

  const handleReset = async () => {
    setIsSearching(false);
    setIsPaused(false);
    try {
      await fetch('http://localhost:8000/api/v1/search/reset', { method: 'POST' });
      setProgress({ tested: 0, bestScore: 0, timeElapsed: 0, total: Number(config.numCandidates) || 100 });
      setResults([]);
      setError(null);
    } catch (err) {
      console.error("Failed to reset search on backend:", err);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const formatStrategyName = (res: any) => {
    if (res.candidate?.label) return res.candidate.label;
    if (res.strategy_name) return res.strategy_name;
    if (res.candidate?.strategy_ids) {
      const ids: string[] = res.candidate.strategy_ids;
      const logic: string = res.candidate.logic || 'AND';
      const nameMap: Record<string, string> = {
        'ma_crossover': 'MA',
        'support_resistance': 'SR',
        'rsi': 'RSI',
        'bollinger_bands': 'BB',
        'smc': 'SMC',
        'news_sentiment': 'Sentiment'
      };
      const names = ids.map(id => nameMap[id] || id);
      return `${names.join(logic === 'WEIGHTED' ? ' + ' : ` ${logic} `)} [${logic}]`;
    }
    return res.name || 'Custom Strategy';
  };

  const progressPercent = Math.min(100, Math.round((progress.tested / (progress.total || 1)) * 100)) || 0;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 text-text-main">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 tracking-tight">
            <Bot className="text-brand-400 w-8 h-8" />
            AI Strategy Search Engine
          </h1>
          <p className="text-text-muted mt-2">Automated exploration of optimal quantitative parameters, hybrid combinations & NLP sentiment.</p>
        </div>
      </div>
      
      {error && (
        <div className="bg-bearish/10 border border-bearish/30 text-bearish-bright p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Strategy Search Space Selector (Step 9 Demo) */}
      <div className="bg-bg-panel/90 border border-border-subtle rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle/60 pb-4">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-brand-400" />
            <div>
              <h2 className="text-base font-bold text-text-main flex items-center gap-2">
                Strategy Search Space Pool
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-brand-500/15 border border-brand-500/30 text-brand-400 font-mono">
                  {selectedStrategyIds.length}/{AVAILABLE_STRATEGIES.length} active
                </span>
              </h2>
              <p className="text-xs text-text-muted mt-0.5">Toggle indicator strategies to include in candidate combination generation.</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={toggleSelectAll}
            disabled={isSearching}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-bg-deep hover:bg-bg-surface text-text-muted hover:text-text-main border border-border-subtle transition-all cursor-pointer disabled:opacity-50"
          >
            {selectedStrategyIds.length === AVAILABLE_STRATEGIES.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {AVAILABLE_STRATEGIES.map(strat => {
            const isSelected = selectedStrategyIds.includes(strat.id);
            return (
              <div 
                key={strat.id}
                onClick={() => toggleStrategy(strat.id)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                  isSelected 
                    ? 'bg-bg-deep/80 border-brand-500/50 shadow-sm shadow-brand-500/10' 
                    : 'bg-bg-deep/30 border-border-subtle/50 opacity-60 hover:opacity-100 hover:border-border-subtle'
                } ${isSearching ? 'pointer-events-none opacity-50' : ''}`}
              >
                <div className="mt-0.5">
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5 text-brand-400" />
                  ) : (
                    <SquareIcon className="w-5 h-5 text-text-dim" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-xs text-text-main truncate block">{strat.name}</span>
                  <p className="text-[11px] text-text-muted mt-1 leading-relaxed">{strat.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Combination Logic Selector */}
        <div className="pt-3 border-t border-border-subtle/40 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand-400" />
            <span className="text-xs font-bold text-text-muted">Combination Logic:</span>
          </div>
          <div className="flex gap-1.5 bg-bg-deep p-1 rounded-xl border border-border-subtle">
            {(['ALL', 'AND', 'OR', 'WEIGHTED'] as const).map(logic => (
              <button
                key={logic}
                type="button"
                disabled={isSearching}
                onClick={() => setSelectedLogic(logic)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  selectedLogic === logic
                    ? 'bg-brand-500 text-bg-deep shadow-md font-mono'
                    : 'text-text-muted hover:text-text-main hover:bg-bg-surface font-mono'
                }`}
              >
                {logic === 'ALL' ? 'Random (All)' : logic}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Controls Panel */}
        <div className="bg-bg-panel/80 backdrop-blur-xl border border-border-subtle rounded-2xl p-6 space-y-6 shadow-lg">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4 tracking-tight">
            <Settings className="text-text-muted w-5 h-5" />
            Search Configuration
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-2">Candidates to Evaluate</label>
              <input 
                type="number" 
                disabled={isSearching}
                value={config.numCandidates}
                onChange={e => setConfig({...config, numCandidates: e.target.value === '' ? '' : parseInt(e.target.value) || 0})}
                className="w-full bg-bg-deep border border-border-subtle rounded-xl p-3 focus:border-brand-400 outline-none transition-all disabled:opacity-50 font-mono text-text-main text-xs"
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-2">Time Limit (seconds)</label>
              <input 
                type="number" 
                disabled={isSearching}
                value={config.timeLimit}
                onChange={e => setConfig({...config, timeLimit: e.target.value === '' ? '' : parseInt(e.target.value) || 0})}
                className="w-full bg-bg-deep border border-border-subtle rounded-xl p-3 focus:border-brand-400 outline-none transition-all disabled:opacity-50 font-mono text-text-main text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-2">Batch Size</label>
              <input 
                type="number" 
                disabled={isSearching}
                value={config.batchSize}
                onChange={e => setConfig({...config, batchSize: e.target.value === '' ? '' : parseInt(e.target.value) || 0})}
                className="w-full bg-bg-deep border border-border-subtle rounded-xl p-3 focus:border-brand-400 outline-none transition-all disabled:opacity-50 font-mono text-text-main text-xs"
              />
            </div>
          </div>

          <div className="pt-4 flex flex-wrap gap-2.5">
            {!isSearching ? (
              <>
                <button 
                  onClick={handleStart}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-bg-deep p-3 rounded-xl font-bold text-xs transition-all duration-200 shadow-md shadow-brand-500/20 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  START SEARCH
                </button>
                <button 
                  onClick={handleReset}
                  title="Reset to 0 (Xóa kết quả về ban đầu)"
                  className="px-3.5 flex items-center justify-center gap-1.5 bg-bg-deep hover:bg-bg-surface text-text-muted hover:text-text-main p-3 rounded-xl font-bold text-xs transition-all duration-200 border border-border-subtle cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  RESET
                </button>
              </>
            ) : isPaused ? (
              <>
                <button 
                  onClick={handleResume}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-bg-deep p-3 rounded-xl font-bold text-xs transition-all duration-200 shadow-md shadow-brand-500/20 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  RESUME SEARCH
                </button>
                <button 
                  onClick={handleStop}
                  title="Dừng hẳn và lưu kết quả này"
                  className="px-4 flex items-center justify-center gap-1.5 bg-bearish/20 hover:bg-bearish text-bearish-bright hover:text-white p-3 rounded-xl font-bold text-xs transition-all duration-200 border border-bearish/40 cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  STOP
                </button>
                <button 
                  onClick={handleReset}
                  title="Dừng và xóa về 0"
                  className="px-3 flex items-center justify-center bg-bg-deep hover:bg-bg-surface text-text-muted hover:text-text-main p-3 rounded-xl font-bold text-xs transition-all duration-200 border border-border-subtle cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={handlePause}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-bg-deep p-3 rounded-xl font-bold text-xs transition-all duration-200 shadow-md cursor-pointer"
                >
                  <Pause className="w-4 h-4 fill-current" />
                  PAUSE
                </button>
                <button 
                  onClick={handleStop}
                  title="Dừng hẳn và lưu kết quả này"
                  className="px-4 flex items-center justify-center gap-1.5 bg-bg-deep hover:bg-bearish hover:text-white text-text-muted p-3 rounded-xl font-bold text-xs transition-all duration-200 border border-border-subtle hover:border-bearish cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  STOP
                </button>
                <button 
                  onClick={handleReset}
                  title="Dừng và xóa về 0"
                  className="px-3 flex items-center justify-center bg-bg-deep hover:bg-bg-surface text-text-muted hover:text-text-main p-3 rounded-xl font-bold text-xs transition-all duration-200 border border-border-subtle cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Progress Dashboard */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-bg-panel/80 backdrop-blur-xl border border-border-subtle rounded-2xl p-6 md:p-8 shadow-lg">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-6 tracking-tight">
              <RefreshCw className={`text-brand-400 w-5 h-5 ${isSearching && !isPaused ? 'animate-spin' : ''}`} />
              Search Progress
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-bg-deep border border-border-subtle rounded-xl p-5 text-center">
                <div className="text-3xl font-black text-text-main font-mono">{progress.tested}<span className="text-lg text-text-muted">/{progress.total}</span></div>
                <div className="text-xs text-text-muted font-bold uppercase mt-2 tracking-wider">Evaluated</div>
              </div>
              <div className="bg-bg-deep border border-border-subtle rounded-xl p-5 text-center">
                <div className="text-3xl font-black text-bullish-bright font-mono">{Number(progress.bestScore).toFixed(3)}</div>
                <div className="text-xs text-text-muted font-bold uppercase mt-2 tracking-wider">Top Fitness Score</div>
              </div>
              <div className="bg-bg-deep border border-border-subtle rounded-xl p-5 text-center">
                <div className="text-3xl font-black text-brand-400 font-mono">{formatTime(progress.timeElapsed)}</div>
                <div className="text-xs text-text-muted font-bold uppercase mt-2 tracking-wider">Time Elapsed</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-text-muted">Progress</span>
                <span className="text-brand-400 font-mono text-sm font-bold">{progressPercent}%</span>
              </div>
              <div className="h-3 w-full bg-bg-deep rounded-full overflow-hidden border border-border-subtle p-0.5">
                <div 
                  className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(250,204,21,0.4)]"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Results Table */}
          <div className="bg-bg-panel/80 backdrop-blur-xl border border-border-subtle rounded-2xl overflow-hidden shadow-lg">
            <div className="p-5 border-b border-border-subtle bg-bg-surface/50 flex justify-between items-center">
              <h3 className="font-semibold text-base text-text-main flex items-center gap-2 tracking-tight">
                <Trophy className="w-5 h-5 text-brand-400" />
                Top Discovered Strategy Candidates
              </h3>
            </div>
            
            {results.length === 0 ? (
              <div className="p-10 text-center text-text-muted text-xs font-medium">
                {isSearching ? "Searching for optimal strategy parameters..." : "Start the search engine to begin strategy discovery."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-text-muted">
                  <thead className="bg-bg-surface/80 text-[11px] uppercase font-bold text-text-muted tracking-wider border-b border-border-subtle">
                    <tr>
                      <th className="px-5 py-3.5">Rank</th>
                      <th className="px-5 py-3.5">Strategy Combination & Parameters</th>
                      <th className="px-5 py-3.5 text-right">Fitness Score</th>
                      <th className="px-5 py-3.5 text-right">Win Rate</th>
                      <th className="px-5 py-3.5 text-right">Total Return</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/50 font-mono">
                    {results.map((res, idx) => {
                      const label = formatStrategyName(res);
                      const score = res.overall_score || 0;
                      const winrate = (res.metrics?.winrate || 0) * 100;
                      const totalReturn = (res.metrics?.total_return || 0) * 100;
                      const logic = res.candidate?.logic;
                      
                      return (
                      <tr key={res.id || idx} className="hover:bg-bg-surface/50 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-text-dim font-mono">#{idx + 1}</td>
                        <td className="px-5 py-3.5 font-sans">
                          <div className="font-bold text-text-main text-xs flex flex-wrap items-center gap-1.5">
                            <span>{label}</span>
                            {logic && (
                              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                                logic === 'WEIGHTED' 
                                  ? 'bg-purple-500/15 border-purple-500/30 text-purple-300' 
                                  : logic === 'AND' 
                                  ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300' 
                                  : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                              }`}>
                                {logic}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-text-muted font-mono mt-0.5">
                            Trades: {res.metrics?.total_trades || 0} | Sharpe: {res.metrics?.sharpe_ratio?.toFixed(2) || '0.00'} | MDD: {((res.metrics?.max_drawdown || 0) * 100).toFixed(1)}%
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-bullish-bright font-bold">{Number(score).toFixed(3)}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-text-main font-semibold">{Number(winrate).toFixed(1)}%</td>
                        <td className={`px-5 py-3.5 text-right font-mono font-bold ${totalReturn >= 0 ? 'text-bullish-bright' : 'text-bearish-bright'}`}>
                          {totalReturn >= 0 ? '+' : ''}{Number(totalReturn).toFixed(2)}%
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
