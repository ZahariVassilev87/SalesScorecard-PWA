import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { User, apiService } from '../services/api';
import { userStorage, tokenStorage, securityUtils } from '../utils/secureStorage';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = () => {
      console.log('🔍 [MOBILE DEBUG] AuthContext initAuth starting...');
      const token = tokenStorage.getToken() || localStorage.getItem('token') || sessionStorage.getItem('token');
      console.log('🔍 [MOBILE DEBUG] Token found:', !!token);
      
      if (token) {
        try {
          const userData = apiService.getCurrentUser();
          console.log('🔍 [MOBILE DEBUG] User data from getCurrentUser:', userData);
          
          if (userData) {
            setUser(userData);
            console.log('✅ [MOBILE DEBUG] User set from existing data');
          } else {
            // Try to get user from localStorage/sessionStorage
            const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
            if (storedUser) {
              try {
                const parsedUser = JSON.parse(storedUser);
                setUser(parsedUser);
                console.log('✅ [MOBILE DEBUG] User set from stored data');
              } catch (parseError) {
                console.error('❌ [MOBILE DEBUG] Failed to parse stored user:', parseError);
                apiService.logout();
              }
            } else {
              console.log('⚠️ [MOBILE DEBUG] No user data found, logging out');
              apiService.logout();
            }
          }
        } catch (error) {
          console.error('❌ [MOBILE DEBUG] Failed to get current user:', error);
          apiService.logout();
        }
      } else {
        console.log('🔍 [MOBILE DEBUG] No token found, user not authenticated');
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await apiService.login(email, password);
      
      // Set user state first
      setUser(response.user);
      
      // Try localStorage first, fallback to sessionStorage for mobile
      try {
        localStorage.setItem('user', JSON.stringify(response.user));
      } catch (error) {
        try {
          sessionStorage.setItem('user', JSON.stringify(response.user));
        } catch (sessionError) {
          console.error('Failed to save user to storage:', sessionError);
        }
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    apiService.logout();
    setUser(null);
    try {
      localStorage.removeItem('user');
      sessionStorage.removeItem('user');
    } catch (error) {
      console.error('Failed to clear user data:', error);
    }
  }, []);

  const value: AuthContextType = useMemo(() => ({
    user,
    login,
    logout,
    isLoading,
    isAuthenticated: !!user,
  }), [user, login, logout, isLoading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
