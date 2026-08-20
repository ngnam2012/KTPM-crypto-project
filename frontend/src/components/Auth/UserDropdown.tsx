import React, { useState, useRef, useEffect } from 'react';
import { 
  User as UserIcon, 
  LogOut, 
  ChevronDown, 
  Shield, 
  Sparkles, 
  FlaskConical, 
  BookmarkCheck, 
  Activity,
  LogIn,
  UserPlus
} from 'lucide-react';
import { useAuth } from '../../shared/context/AuthContext';
import { Link } from 'react-router-dom';

export const UserDropdown: React.FC = () => {
  const { user, isAuthenticated, logout, openAuthModal } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button
          onClick={() => openAuthModal('login')}
          className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-bg-surface hover:bg-bg-hover text-text-main border border-border-subtle hover:border-brand-400/40 text-xs font-semibold transition-all"
        >
          <LogIn className="w-3.5 h-3.5 text-brand-400" />
          <span>Sign In</span>
        </button>
        <button
          onClick={() => openAuthModal('register')}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-bg-deep font-bold text-xs shadow-md shadow-brand-500/20 hover:scale-105 transition-all"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Register</span>
        </button>
      </div>
    );
  }

  const initialLetter = (user.username || user.email || 'U')[0].toUpperCase();

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      {/* User Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-xl bg-bg-surface hover:bg-bg-hover border transition-all ${
          isOpen ? 'border-brand-400/60 shadow-lg shadow-brand-500/10' : 'border-border-subtle'
        }`}
      >
        <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-brand-500 to-accent-blue flex items-center justify-center font-black text-xs text-bg-deep shadow-sm">
          {initialLetter}
        </div>
        <div className="text-left hidden md:block">
          <div className="text-xs font-bold text-text-main leading-tight flex items-center gap-1">
            <span>{user.username}</span>
            {user.role === 'admin' && (
              <span className="text-[9px] px-1 py-0.2 rounded bg-accent-purple/20 text-accent-purple font-bold">
                ADMIN
              </span>
            )}
          </div>
          <div className="text-[10px] text-brand-400 font-medium leading-none">
            {user.role === 'admin' ? 'System Admin' : 'Active Trader'}
          </div>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 ${isOpen ? 'rotate-180 text-brand-400' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-bg-panel/95 border border-border-subtle rounded-2xl shadow-2xl shadow-black/80 backdrop-blur-2xl py-2 z-50 animate-in fade-in zoom-in-95">
          {/* User Info Header */}
          <div className="px-4 py-3 border-b border-border-subtle">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-400 to-brand-600 flex items-center justify-center font-extrabold text-sm text-bg-deep shadow-md">
                {initialLetter}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-text-main truncate">
                  {user.full_name || user.username}
                </div>
                <div className="text-xs text-text-muted truncate">
                  {user.email}
                </div>
                <div className="inline-flex items-center gap-1 mt-1 text-[10px] text-brand-400 font-semibold">
                  <Shield className="w-3 h-3" />
                  <span>Role: {user.role.toUpperCase()}</span>
                </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border-subtle/60">
              <div className="p-2 rounded-xl bg-bg-surface/80 border border-border-subtle/50 text-center">
                <div className="text-[10px] text-text-dim uppercase font-semibold">Saved Models</div>
                <div className="text-sm font-extrabold text-brand-400 font-mono">
                  {user.stats?.saved_strategies ?? 0}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-bg-surface/80 border border-border-subtle/50 text-center">
                <div className="text-[10px] text-text-dim uppercase font-semibold">Backtests</div>
                <div className="text-sm font-extrabold text-accent-blue font-mono">
                  {user.stats?.total_backtests ?? 0}
                </div>
              </div>
            </div>
          </div>

          {/* Nav Links inside dropdown */}
          <div className="p-1.5 border-b border-border-subtle">
            <Link
              to="/strategy-studio"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-text-muted hover:text-text-main hover:bg-bg-surface transition-colors"
            >
              <Sparkles className="w-4 h-4 text-brand-400" />
              <span>AI Strategy Studio</span>
            </Link>
            <Link
              to="/backtest"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-text-muted hover:text-text-main hover:bg-bg-surface transition-colors"
            >
              <FlaskConical className="w-4 h-4 text-accent-cyan" />
              <span>Backtest Workbench</span>
            </Link>
            <Link
              to="/leaderboard"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-text-muted hover:text-text-main hover:bg-bg-surface transition-colors"
            >
              <BookmarkCheck className="w-4 h-4 text-accent-purple" />
              <span>Strategy Leaderboard</span>
            </Link>
          </div>

          {/* Logout Button */}
          <div className="p-1.5">
            <button
              onClick={() => {
                setIsOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-bearish-bright hover:bg-bearish/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
