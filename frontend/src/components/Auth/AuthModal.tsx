import React, { useState, useEffect } from 'react';
import { 
  X, 
  Lock, 
  User as UserIcon, 
  Mail, 
  ArrowRight, 
  Sparkles, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle2, 
  ShieldCheck,
  Zap
} from 'lucide-react';
import { useAuth } from '../../shared/context/AuthContext';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, authModalMode, closeAuthModal, openAuthModal, login, register } = useAuth();
  
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens or mode changes
  useEffect(() => {
    if (isAuthModalOpen) {
      setError(null);
      setSuccessMsg(null);
      setPassword('');
      setConfirmPassword('');
    }
  }, [isAuthModalOpen, authModalMode]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAuthModalOpen) {
        closeAuthModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthModalOpen, closeAuthModal]);

  if (!isAuthModalOpen) return null;

  const isLogin = authModalMode === 'login';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!username.trim()) {
      setError('Please enter a username or email.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    if (!isLogin) {
      if (!email.trim() || !email.includes('@')) {
        setError('Please enter a valid email address.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (isLogin) {
        const result = await login(username.trim(), password);
        if (!result.success) {
          setError(result.error || 'Authentication failed.');
        }
      } else {
        const result = await register(
          username.trim(), 
          email.trim(), 
          password, 
          fullName.trim() || undefined
        );
        if (result.success) {
          setSuccessMsg('Account created successfully! Logging you in...');
        } else {
          setError(result.error || 'Registration failed.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFillDemo = () => {
    setUsername('quant_trader');
    setEmail('quant@cryptolab.io');
    setPassword('crypto123');
    setConfirmPassword('crypto123');
    setFullName('Alex Rivera');
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Dark Blur Backdrop */}
      <div 
        className="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity duration-300 animate-in fade-in"
        onClick={closeAuthModal}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-md bg-bg-panel/95 border border-border-subtle rounded-2xl shadow-2xl shadow-black/80 overflow-hidden backdrop-blur-2xl transition-all duration-300 animate-in zoom-in-95">
        
        {/* Top Gradient Banner */}
        <div className="h-2 w-full bg-gradient-to-r from-brand-400 via-accent-blue to-accent-purple" />

        {/* Modal Header */}
        <div className="p-6 pb-4 flex items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-[11px] font-semibold tracking-wide uppercase mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Crypto Strategy Lab</span>
            </div>
            <h2 className="text-xl font-extrabold text-text-main tracking-tight flex items-center gap-2">
              {isLogin ? 'Welcome Back' : 'Create Trader Account'}
              <Sparkles className="w-4 h-4 text-brand-400" />
            </h2>
            <p className="text-xs text-text-muted mt-1">
              {isLogin 
                ? 'Sign in to access your saved strategies & private backtests.' 
                : 'Join the quantitative laboratory & build winning alpha models.'}
            </p>
          </div>
          <button
            onClick={closeAuthModal}
            className="p-1.5 rounded-xl text-text-muted hover:text-text-main hover:bg-bg-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 flex border-b border-border-subtle">
          <button
            type="button"
            onClick={() => openAuthModal('login')}
            className={`flex-1 pb-3 text-xs font-bold transition-all border-b-2 text-center ${
              isLogin 
                ? 'border-brand-400 text-brand-400' 
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => openAuthModal('register')}
            className={`flex-1 pb-3 text-xs font-bold transition-all border-b-2 text-center ${
              !isLogin 
                ? 'border-brand-400 text-brand-400' 
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            Register
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error Banner */}
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-bearish/10 border border-bearish/30 text-bearish-bright text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="font-medium leading-relaxed">{error}</div>
            </div>
          )}

          {/* Success Banner */}
          {successMsg && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-bullish/10 border border-bullish/30 text-bullish-bright text-xs animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <div className="font-medium">{successMsg}</div>
            </div>
          )}

          {/* Full Name (Register Only) */}
          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5">Full Name (Optional)</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. Satoshi Nakamoto"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-bg-surface border border-border-subtle focus:border-brand-400 rounded-xl px-3.5 py-2.5 pl-9 text-xs text-text-main placeholder:text-text-dim outline-none transition-colors"
                />
                <UserIcon className="w-4 h-4 text-text-dim absolute left-3 top-3" />
              </div>
            </div>
          )}

          {/* Username / Email */}
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">
              {isLogin ? 'Username or Email' : 'Username'}
            </label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder={isLogin ? 'trader_pro or trader@cryptolab.io' : 'trader_pro'}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-bg-surface border border-border-subtle focus:border-brand-400 rounded-xl px-3.5 py-2.5 pl-9 text-xs text-text-main placeholder:text-text-dim outline-none transition-colors"
              />
              <UserIcon className="w-4 h-4 text-text-dim absolute left-3 top-3" />
            </div>
          </div>

          {/* Email (Register Only) */}
          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-bg-surface border border-border-subtle focus:border-brand-400 rounded-xl px-3.5 py-2.5 pl-9 text-xs text-text-main placeholder:text-text-dim outline-none transition-colors"
                />
                <Mail className="w-4 h-4 text-text-dim absolute left-3 top-3" />
              </div>
            </div>
          )}

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-bg-surface border border-border-subtle focus:border-brand-400 rounded-xl px-3.5 py-2.5 pl-9 pr-9 text-xs text-text-main placeholder:text-text-dim outline-none transition-colors"
              />
              <Lock className="w-4 h-4 text-text-dim absolute left-3 top-3" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-text-dim hover:text-text-main transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password (Register Only) */}
          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5">Confirm Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-bg-surface border border-border-subtle focus:border-brand-400 rounded-xl px-3.5 py-2.5 pl-9 text-xs text-text-main placeholder:text-text-dim outline-none transition-colors"
                />
                <Lock className="w-4 h-4 text-text-dim absolute left-3 top-3" />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-bg-deep font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-bg-deep border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>{isLogin ? 'Sign In to Laboratory' : 'Create Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Quick Demo Helper */}
          <div className="pt-3 border-t border-border-subtle flex items-center justify-between text-[11px] text-text-dim">
            <span>Need a test account?</span>
            <button
              type="button"
              onClick={handleFillDemo}
              className="inline-flex items-center gap-1 text-brand-400 hover:text-brand-300 font-semibold transition-colors"
            >
              <Zap className="w-3 h-3" />
              <span>Fill Demo Data</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
