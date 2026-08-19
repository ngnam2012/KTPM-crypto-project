import React, { useEffect, useState } from 'react';
import { Activity, LayoutDashboard, CheckSquare, Square } from 'lucide-react';

interface StrategyInfo {
  id: string;
  name: string;
  description: string;
}

interface SidebarProps {
  selectedStrategies?: string[];
  toggleStrategy?: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ selectedStrategies = [], toggleStrategy = () => {} }) => {
  const [strategies, setStrategies] = useState<StrategyInfo[]>([]);

  useEffect(() => {
    fetch('http://localhost:8000/api/v1/strategies')
      .then(res => res.json())
      .then(data => {
        if (data && data.strategies) setStrategies(data.strategies);
      })
      .catch(err => console.error(err));
  }, []);

  return (
    <aside className="w-72 border-r border-border-subtle bg-bg-panel/80 backdrop-blur-2xl h-full flex flex-col shrink-0 z-20 relative">
      <div className="p-6 border-b border-border-subtle">
        <h1 className="text-xl font-bold flex items-center gap-2 tracking-tight text-text-main">
          <Activity className="text-brand-400" />
          <span>Crypto Strategy Lab</span>
        </h1>
      </div>
      
      <div className="p-4 border-b border-border-subtle">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Available Strategies</h3>
        <div className="space-y-2">
          {strategies.map(strat => {
            const isSelected = selectedStrategies.includes(strat.id);
            return (
              <div 
                key={strat.id} 
                className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 flex items-start gap-3 ${isSelected ? 'bg-brand-500/15 border-brand-500/40 shadow-sm' : 'bg-bg-deep border-border-subtle hover:border-brand-500/30'}`}
                onClick={() => toggleStrategy(strat.id)}
              >
                <div className="mt-0.5 text-brand-400">
                  {isSelected ? <CheckSquare size={16} /> : <Square size={16} className="text-text-muted" />}
                </div>
                <div className="overflow-hidden">
                  <div className="text-xs font-semibold text-text-main truncate">{strat.name}</div>
                  <div className="text-[11px] text-text-muted mt-0.5 truncate" title={strat.description}>{strat.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        <a href="/" className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-brand-500/10 text-brand-400 font-medium border border-brand-500/20 transition-all text-xs">
          <LayoutDashboard size={18} />
          <span>Market Dashboard</span>
        </a>
      </nav>
    </aside>
  );
};
