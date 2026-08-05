import React from 'react';
import { Bell, User } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="h-16 border-b border-border-subtle bg-bg-panel/40 backdrop-blur-xl flex items-center justify-between px-6 shrink-0 sticky top-0 z-40">
      <h2 className="text-xl font-semibold text-text-main tracking-tight">Market Overview</h2>
      
      <div className="flex items-center gap-6">
        <button className="p-2 text-text-muted hover:text-brand-500 hover:bg-brand-500/10 rounded-full transition-all duration-300 hover:shadow-sm">
          <Bell size={20} />
        </button>
        <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-brand-500 to-brand-600 flex items-center justify-center text-sm font-medium cursor-pointer shadow-sm hover:scale-105 transition-transform duration-300 text-bg-deep">
          <User size={18} />
        </div>
      </div>
    </header>
  );
};
