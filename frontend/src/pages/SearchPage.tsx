import React, { useState, useEffect } from 'react';
import { Bot, Play, Square, Pause, Settings, RefreshCw, Trophy, AlertCircle } from 'lucide-react';

export const SearchPage: React.FC = () => {
  const [isSearching, setIsSearching] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
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

  // Check initial status on mount to recover state if running in background
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
              tested: data.tested ?? data.evaluated ?? data.progress ?? 0,
              bestScore: data.bestScore ?? data.current_best ?? data.best_score ?? 0,
              timeElapsed: data.timeElapsed ?? data.time_elapsed ?? 0,
              total: data.total ?? config.numCandidates
            });
            if (data.total) {
              setConfig(c => ({...c, numCandidates: data.total}));
            }
          } else if (data.status === 'completed') {
            fetchResults();
          }
        }
      } catch (err) {
        console.error("Failed to check initial status:", err);
      }
    };
    checkInitialState();
  }, []);

  // Polling real search status from backend
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isSearching && !isPaused) {
      interval = setInterval(async () => {
        try {
          const res = await fetch('http://localhost:8000/api/v1/search/status');
          if (!res.ok) throw new Error("Failed to fetch search status");
          const data = await res.json();
          
          setProgress({
            tested: data.tested ?? data.evaluated ?? data.progress ?? 0,
            bestScore: data.bestScore ?? data.current_best ?? data.best_score ?? 0,
            timeElapsed: data.timeElapsed ?? data.time_elapsed ?? 0,
            total: data.total ?? config.numCandidates
          });

          // Check if search has completed
          if (data.status === 'completed' || data.status === 'stopped' || data.is_completed) {
            setIsSearching(false);
            setIsPaused(false);
            fetchResults();
          }
        } catch (err: any) {
          console.error("Error polling search status:", err);
        }
      }, 1000);
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
    if (isPaused) {
      setIsPaused(false);
    } else {
      try {
        setError(null);
        // Start search on the backend
        const res = await fetch('http://localhost:8000/api/v1/search/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            n_candidates: Number(config.numCandidates) || 100,
            time_limit: Number(config.timeLimit) || 300,
            batch_size: Number(config.batchSize) || 50
          })
        });
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.detail || "Failed to start search");
        }

        setIsSearching(true);
        setProgress({ tested: 0, bestScore: 0, timeElapsed: 0, total: Number(config.numCandidates) || 100 });
        setResults([]);
      } catch (err: any) {
        setError(err.message);
      }
    }
  };

  const handlePause = () => {
    setIsPaused(true);
  };

  const handleStop = async () => {
    setIsSearching(false);
    setIsPaused(false);
    try {
      await fetch('http://localhost:8000/api/v1/search/stop', { method: 'POST' });
    } catch (err) {
      console.error("Failed to stop search on backend:", err);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const formatStrategyName = (ids: string[], logic: string) => {
    if (!ids || !ids.length) return '';
    const formatId = (id: string) => {
      const nameMap: Record<string, string> = {
        'ma_crossover': 'MA Crossover',
        'support_resistance': 'Support/Resistance',
        'rsi': 'RSI',
        'bollinger_bands': 'Bollinger Bands',
        'news_sentiment': 'News Sentiment'
      };
      if (nameMap[id]) return nameMap[id];
      return id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    };
    
    return ids.map(formatId).join(logic === 'AND' ? ' + ' : ' OR ');
  };

  const progressPercent = Math.min(100, Math.round((progress.tested / progress.total) * 100)) || 0;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 text-text-main">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 tracking-tight">
            <Bot className="text-brand-500 w-8 h-8" />
            AI Strategy Search
          </h1>
          <p className="text-text-muted mt-2">Automated discovery of optimal trading configurations.</p>
        </div>
      </div>
      
      {error && (
        <div className="bg-bearish/10 border border-bearish/30 text-bearish p-4 rounded-xl flex items-center gap-3 shadow-[0_0_15px_rgba(255,69,58,0.15)]">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Controls Panel */}
        <div className="bg-bg-panel/40 backdrop-blur-xl border border-border-subtle rounded-2xl p-6 space-y-6 shadow-lg shadow-black/20">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-4 tracking-tight">
            <Settings className="text-text-muted w-5 h-5" />
            Search Configuration
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">Max Candidates to Test</label>
              <input 
                type="number" 
                disabled={isSearching}
                value={config.numCandidates}
                onChange={e => setConfig({...config, numCandidates: e.target.value === '' ? '' : parseInt(e.target.value) || 0})}
                className="w-full bg-bg-deep/50 border border-border-subtle rounded-xl p-3 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all disabled:opacity-50 font-mono text-text-main shadow-inner"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">Time Limit (seconds)</label>
              <input 
                type="number" 
                disabled={isSearching}
                value={config.timeLimit}
                onChange={e => setConfig({...config, timeLimit: e.target.value === '' ? '' : parseInt(e.target.value) || 0})}
                className="w-full bg-bg-deep/50 border border-border-subtle rounded-xl p-3 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all disabled:opacity-50 font-mono text-text-main shadow-inner"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">Batch Size</label>
              <input 
                type="number" 
                disabled={isSearching}
                value={config.batchSize}
                onChange={e => setConfig({...config, batchSize: e.target.value === '' ? '' : parseInt(e.target.value) || 0})}
                className="w-full bg-bg-deep/50 border border-border-subtle rounded-xl p-3 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all disabled:opacity-50 font-mono text-text-main shadow-inner"
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            {!isSearching || isPaused ? (
              <button 
                onClick={handleStart}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-tr from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-500 text-bg-deep p-3 rounded-xl font-bold transition-all duration-300 shadow-[0_0_15px_rgba(0,122,255,0.3)] hover:scale-[1.02]"
              >
                <Play className="w-5 h-5 fill-current" />
                {isPaused ? 'RESUME' : 'START SEARCH'}
              </button>
            ) : (
              <button 
                onClick={handlePause}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-tr from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-bg-deep p-3 rounded-xl font-bold transition-all duration-300 shadow-[0_0_15px_rgba(245,158,11,0.3)] hover:scale-[1.02]"
              >
                <Pause className="w-5 h-5 fill-current" />
                PAUSE
              </button>
            )}
            
            <button 
              onClick={handleStop}
              disabled={!isSearching}
              className="px-4 flex items-center justify-center gap-2 bg-bg-deep/80 hover:bg-bearish hover:text-white text-text-muted p-3 rounded-xl font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed border border-border-subtle hover:border-bearish hover:shadow-[0_0_15px_rgba(255,69,58,0.4)]"
            >
              <Square className="w-5 h-5 fill-current" />
            </button>
          </div>
        </div>

        {/* Progress Dashboard */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-bg-panel/40 backdrop-blur-xl border border-border-subtle rounded-2xl p-6 md:p-8 shadow-lg shadow-black/20">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-6 tracking-tight">
              <RefreshCw className={`text-brand-500 w-5 h-5 ${isSearching && !isPaused ? 'animate-spin' : ''}`} />
              Search Progress
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-bg-deep/50 border border-border-subtle rounded-xl p-5 text-center">
                <div className="text-4xl font-black text-text-main font-mono">{progress.tested}<span className="text-xl text-text-muted">/{progress.total}</span></div>
                <div className="text-xs text-text-muted font-bold uppercase mt-2 tracking-wider">Tested</div>
              </div>
              <div className="bg-bg-deep/50 border border-border-subtle rounded-xl p-5 text-center">
                <div className="text-4xl font-black text-bullish font-mono">{Number(progress.bestScore).toFixed(2)}</div>
                <div className="text-xs text-text-muted font-bold uppercase mt-2 tracking-wider">Best Score</div>
              </div>
              <div className="bg-bg-deep/50 border border-border-subtle rounded-xl p-5 text-center">
                <div className="text-4xl font-black text-brand-500 font-mono">{formatTime(progress.timeElapsed)}</div>
                <div className="text-xs text-text-muted font-bold uppercase mt-2 tracking-wider">Time Elapsed</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm font-medium">
                <span className="text-text-muted">Completion</span>
                <span className="text-brand-500 font-mono text-lg font-bold">{progressPercent}%</span>
              </div>
              <div className="h-4 w-full bg-bg-deep/80 rounded-full overflow-hidden border border-border-subtle p-0.5">
                <div 
                  className="h-full bg-gradient-to-r from-brand-600 to-brand-500 rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(0,122,255,0.5)]"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Results Table */}
          <div className="bg-bg-panel/40 backdrop-blur-xl border border-border-subtle rounded-2xl overflow-hidden shadow-lg shadow-black/20">
            <div className="p-6 border-b border-border-subtle bg-bg-panel/50 flex justify-between items-center">
              <h3 className="font-semibold text-lg text-text-main flex items-center gap-2 tracking-tight">
                <Trophy className="w-5 h-5 text-amber-500" />
                Top Discoveries
              </h3>
            </div>
            
            {results.length === 0 ? (
              <div className="p-10 text-center text-text-muted font-medium">
                {isSearching ? "Searching for optimal strategies..." : "Start the search engine to begin discovery."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-text-muted">
                  <thead className="bg-bg-panel/80 text-xs uppercase font-semibold text-text-main tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Rank</th>
                      <th className="px-6 py-4">Strategy Name</th>
                      <th className="px-6 py-4 text-right">Score</th>
                      <th className="px-6 py-4 text-right">Win Rate</th>
                      <th className="px-6 py-4 text-right">Return</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {results.map((res, idx) => {
                      const name = res.candidate?.strategy_ids ? formatStrategyName(res.candidate.strategy_ids, res.candidate.logic) : (res.name || res.strategy_name || `Strategy ${idx + 1}`);
                      const score = res.overall_score || 0;
                      const winrate = (res.metrics?.winrate || 0) * 100;
                      const totalReturn = (res.metrics?.total_return || 0) * 100;
                      
                      return (
                      <tr key={res.id || idx} className="hover:bg-brand-500/5 transition-all duration-300 group cursor-pointer hover:scale-[1.002]">
                        <td className="px-6 py-4 font-bold text-text-muted font-mono">#{idx + 1}</td>
                        <td className="px-6 py-4 font-semibold text-text-main group-hover:text-brand-500 transition-colors">{name}</td>
                        <td className="px-6 py-4 text-right font-mono text-bullish font-bold">{Number(score).toFixed(2)}</td>
                        <td className="px-6 py-4 text-right font-mono">{Number(winrate).toFixed(1)}%</td>
                        <td className="px-6 py-4 text-right font-mono text-text-main font-semibold">{Number(totalReturn).toFixed(2)}%</td>
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
