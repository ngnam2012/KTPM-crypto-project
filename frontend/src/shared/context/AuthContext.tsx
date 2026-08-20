import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { apiClient, getAuthToken, setAuthToken } from '../api/apiClient';

export interface UserStats {
  saved_strategies: number;
  total_backtests: number;
  account_status: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  full_name?: string;
  role: string;
  is_active?: boolean;
  created_at?: string;
  stats?: UserStats;
}

interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  authModalMode: 'login' | 'register';
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, email: string, password: string, fullName?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  openAuthModal: (mode?: 'login' | 'register') => void;
  closeAuthModal: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getAuthToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  const refreshUser = useCallback(async () => {
    const currentToken = getAuthToken();
    if (!currentToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const userData = await apiClient.get<User & { stats?: UserStats }>('/api/v1/auth/me');
      setUser(userData);
    } catch (error) {
      console.warn('Session expired or invalid token:', error);
      setAuthToken(null);
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check auth status on mount
  useEffect(() => {
    refreshUser();

    // Listen to unauthorized event dispatched by apiClient
    const handleUnauthorized = () => {
      setToken(null);
      setUser(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [refreshUser]);

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await apiClient.post<AuthResponse>('/api/v1/auth/login', {
        username,
        password,
      });

      setAuthToken(response.access_token);
      setToken(response.access_token);
      setUser(response.user);
      setIsAuthModalOpen(false);

      // Refresh to fetch full stats
      await refreshUser();
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Login failed. Please check your credentials.',
      };
    }
  };

  const register = async (
    username: string,
    email: string,
    password: string,
    fullName?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await apiClient.post<AuthResponse>('/api/v1/auth/register', {
        username,
        email,
        password,
        full_name: fullName,
      });

      setAuthToken(response.access_token);
      setToken(response.access_token);
      setUser(response.user);
      setIsAuthModalOpen(false);

      // Refresh to fetch full stats
      await refreshUser();
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Registration failed. Please check your information.',
      };
    }
  };

  const logout = () => {
    setAuthToken(null);
    setToken(null);
    setUser(null);
  };

  const openAuthModal = (mode: 'login' | 'register' = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        isAuthModalOpen,
        authModalMode,
        login,
        register,
        logout,
        openAuthModal,
        closeAuthModal,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
