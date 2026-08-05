import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { NewsPage } from './pages/NewsPage';
import { SearchPage } from './pages/SearchPage';
import { Trophy, LayoutDashboard, Newspaper, Bot, Menu, X } from 'lucide-react';

const Navigation = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const navLinks = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard, color: 'blue' },
    { path: '/search', label: 'AI Search', icon: Bot, color: 'purple' },
    { path: '/leaderboard', label: 'Leaderboard', icon: Trophy, color: 'yellow' },
    { path: '/news', label: 'News Feed', icon: Newspaper, color: 'blue' },
  ];

  return (
    <nav className="bg-bg-panel/80 backdrop-blur-md border-b border-border-subtle p-4 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="text-xl font-bold text-text-main">Crypto Strategy Lab</div>
        
        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            return (
              <Link 
                key={link.path}
                to={link.path} 
                className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300 font-medium text-sm ${isActive ? 'bg-brand-500/10 text-brand-500 shadow-[0_0_15px_rgba(0,122,255,0.2)]' : 'text-text-muted hover:text-text-main hover:bg-bg-panel hover:scale-[1.02]'}`}
              >
                <Icon className="w-4 h-4" />
                {link.label}
              </Link>
            );
          })}
        </div>
        
        {/* Mobile Nav Toggle */}
        <button 
          className="md:hidden p-2 text-text-muted hover:text-text-main hover:bg-bg-panel rounded-xl transition-colors"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>
      
      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden mt-4 pt-4 border-t border-border-subtle flex flex-col gap-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            return (
              <Link 
                key={link.path}
                to={link.path} 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-medium ${isActive ? 'bg-brand-500/10 text-brand-500 shadow-[0_0_15px_rgba(0,122,255,0.2)]' : 'text-text-muted hover:text-text-main hover:bg-bg-panel hover:scale-[1.01]'}`}
              >
                <Icon className="w-5 h-5" />
                {link.label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
};

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-bg-deep text-text-main font-sans selection:bg-brand-500/30 flex flex-col">
        <Navigation />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/news" element={<NewsPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
