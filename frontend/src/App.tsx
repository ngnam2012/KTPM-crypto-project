import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { BacktestPage } from './pages/BacktestPage';
import { StrategyStudioPage } from './pages/StrategyStudioPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { NewsPage } from './pages/NewsPage';
import { SearchPage } from './pages/SearchPage';
import { AuthProvider, useAuth } from './shared/context/AuthContext';
import { AuthModal } from './components/Auth/AuthModal';
import { UserDropdown } from './components/Auth/UserDropdown';
import { 
  Trophy, 
  LayoutDashboard, 
  Newspaper, 
  Bot, 
  FlaskConical, 
  Sparkles, 
  Menu, 
  X, 
  Clock, 
  Activity,
  LogIn
} from 'lucide-react';

import { getDeviceTimezoneOffset } from './shared/lib/timezone';

const LiveClock = () => {
  const [timeStr, setTimeStr] = useState('');
  const [tzOffset, setTzOffset] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
      setTzOffset(getDeviceTimezoneOffset());
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-bg-surface border border-border-subtle text-xs font-mono text-text-muted shadow-inner shrink-0">
      <Clock className="w-3.5 h-3.5 text-brand-500 animate-spin shrink-0" style={{ animationDuration: '10s' }} />
      <span className="text-text-main font-semibold whitespace-nowrap">{timeStr || '--:--:--'}</span>
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-500 font-bold border border-brand-500/20 whitespace-nowrap shrink-0">
        {tzOffset || 'UTC'}
      </span>
    </div>
  );
};

const Navigation = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isAuthenticated, openAuthModal } = useAuth();
  
  const navLinks = [
    { path: '/', label: 'Dashboard', fullLabel: 'Market Dashboard', icon: LayoutDashboard },
    { path: '/backtest', label: 'Backtest', fullLabel: 'Backtest Workbench', icon: FlaskConical },
    { path: '/strategy-studio', label: 'AI Studio', fullLabel: 'AI Strategy Studio', icon: Sparkles },
    { path: '/search', label: 'AI Search', fullLabel: 'AI Search Engine', icon: Bot },
    { path: '/leaderboard', label: 'Leaderboard', fullLabel: 'Leaderboard', icon: Trophy },
    { path: '/news', label: 'News & Sentiment', fullLabel: 'News & Sentiment', icon: Newspaper },
  ];

  return (
    <nav className="bg-bg-panel/90 backdrop-blur-xl border-b border-border-subtle sticky top-0 z-50 transition-colors">
      <div className="max-w-[1750px] mx-auto px-3 sm:px-4 md:px-6 py-2.5 flex items-center justify-between gap-2 lg:gap-4">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center font-black text-bg-deep shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform shrink-0">
            <Activity className="w-4 h-4 md:w-5 md:h-5 text-bg-deep" />
          </div>
          <div className="shrink-0">
            <div className="text-base md:text-lg font-extrabold text-text-main tracking-tight group-hover:text-brand-400 transition-colors whitespace-nowrap">
              Crypto Strategy Lab
            </div>
            <div className="text-[9px] md:text-[10px] font-medium text-text-dim tracking-wider uppercase hidden 2xl:block">
              Quantitative Architecture & Backtest Suite
            </div>
          </div>
        </Link>
        
        {/* Desktop Nav */}
        <div className="hidden xl:flex items-center gap-1 2xl:gap-1.5 shrink-0">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            return (
              <Link 
                key={link.path}
                to={link.path} 
                className={`flex items-center gap-1.5 lg:gap-2 px-2.5 2xl:px-3.5 py-2 rounded-xl transition-all duration-200 font-medium text-xs whitespace-nowrap shrink-0 ${
                  isActive 
                    ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30 shadow-[0_0_15px_rgba(250,204,21,0.12)] font-bold' 
                    : 'text-text-muted hover:text-text-main hover:bg-bg-surface'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="hidden 2xl:inline">{link.fullLabel}</span>
                <span className="2xl:hidden">{link.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Right Info: Live Device Clock, Auth User Menu & Mobile Toggle */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <LiveClock />
          <UserDropdown />
          <button 
            className="xl:hidden p-2 text-text-muted hover:text-text-main hover:bg-bg-surface rounded-xl transition-colors shrink-0"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>
      
      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="xl:hidden px-4 pb-4 border-t border-border-subtle bg-bg-panel/95 backdrop-blur-xl flex flex-col gap-1.5">
          <div className="py-2 flex justify-between items-center sm:hidden">
            <LiveClock />
          </div>
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            return (
              <Link 
                key={link.path}
                to={link.path} 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium ${
                  isActive 
                    ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30 font-bold' 
                    : 'text-text-muted hover:text-text-main hover:bg-bg-surface'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{link.label}</span>
              </Link>
            );
          })}

          {!isAuthenticated && (
            <div className="pt-2 mt-2 border-t border-border-subtle flex gap-2">
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  openAuthModal('login');
                }}
                className="flex-1 py-2 rounded-xl bg-bg-surface text-xs font-bold text-text-main border border-border-subtle flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4 text-brand-400" />
                <span>Sign In</span>
              </button>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  openAuthModal('register');
                }}
                className="flex-1 py-2 rounded-xl bg-brand-500 text-xs font-bold text-bg-deep flex items-center justify-center gap-2"
              >
                <span>Register</span>
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-bg-deep text-text-main font-sans selection:bg-brand-500/30 flex flex-col">
          <Navigation />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/backtest" element={<BacktestPage />} />
              <Route path="/strategy-studio" element={<StrategyStudioPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/news" element={<NewsPage />} />
            </Routes>
          </main>
          {/* Global Auth Modal */}
          <AuthModal />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
