import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
      const token = tokenStorage.getToken();
      if (token && securityUtils.isValidToken(token) && !securityUtils.isTokenExpired(token)) {
        try {
          const userData = apiService.getCurrentUser();
          if (userData) {
            setUser(userData);
          } else {
            apiService.logout();
          }
        } catch (error) {
          console.error('Failed to get current user:', error);
          apiService.logout();
        }
      } else if (token) {
        // Token exists but is invalid/expired, clear it
        tokenStorage.removeToken();
        userStorage.removeUser();
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await apiService.login(email, password);
      setUser(response.user);
      userStorage.setUser(response.user);
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    apiService.logout();
    setUser(null);
    userStorage.removeUser();
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    isLoading,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
