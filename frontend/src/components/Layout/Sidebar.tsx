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
    <aside className="w-72 border-r border-border-subtle bg-bg-panel/40 backdrop-blur-2xl h-full flex flex-col shrink-0 z-20 relative">
      <div className="p-6 border-b border-border-subtle">
        <h1 className="text-2xl font-bold flex items-center gap-2 tracking-tight">
          <Activity className="text-brand-500" />
          <span>CryptoLab</span>
        </h1>
      </div>
      
      <div className="p-4 border-b border-border-subtle">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Strategies</h3>
        <div className="space-y-2">
          {strategies.map(strat => {
            const isSelected = selectedStrategies.includes(strat.id);
            return (
              <div 
                key={strat.id} 
                className={`p-4 rounded-xl border cursor-pointer transition-all duration-300 flex items-start gap-3 ${isSelected ? 'bg-brand-500/10 border-brand-500/30 shadow-sm scale-[1.02]' : 'bg-bg-deep/50 border-border-subtle hover:border-brand-500/30 hover:bg-brand-500/5 hover:scale-[1.01]'}`}
                onClick={() => toggleStrategy(strat.id)}
              >
                <div className="mt-0.5 text-brand-500">
                  {isSelected ? <CheckSquare size={16} /> : <Square size={16} className="text-text-muted" />}
                </div>
                <div className="overflow-hidden">
                  <div className="text-sm font-medium text-text-main truncate">{strat.name}</div>
                  <div className="text-xs text-text-muted mt-1 truncate" title={strat.description}>{strat.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-brand-500/10 text-brand-500 font-medium border border-brand-500/20 transition-all duration-300 hover:shadow-sm hover:scale-[1.02]">
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </a>
      </nav>
    </aside>
  );
};
