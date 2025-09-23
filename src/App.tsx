import React, { useState, useEffect } from 'react';
import './App.css';

// Types (matching iOS app models)
interface User {
  id: string;
  email: string;
  displayName: string;
  role: string;
  isActive: boolean;
}

interface LoginResponse {
  token: string;
  user: User;
}

// API Service (matching iOS APIService)
const API_BASE = process.env.REACT_APP_API_BASE_URL || 'https://api.instorm.io';

class ApiService {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('userToken', token);
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('userToken');
    }
    return this.token;
  }

  private getHeaders() {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Login failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const token = data.token || data.access_token;
    
    if (!token) {
      throw new Error('No token received from server');
    }
    
    this.setToken(token);
    
    return {
      token: token,
      user: {
        id: data.user?.id || '1',
        email: data.user?.email || email,
        displayName: data.user?.displayName || email.split('@')[0],
        role: data.user?.role || 'SALESPERSON',
        isActive: data.user?.isActive !== false
      }
    };
  }
}

const apiService = new ApiService();

// Auth Manager (matching iOS AuthManager)
class AuthManager {
  private user: User | null = null;
  private listeners: Array<() => void> = [];

  constructor() {
    this.loadUserFromStorage();
  }

  private loadUserFromStorage() {
    const token = localStorage.getItem('userToken');
    if (token) {
      try {
        const userData = JSON.parse(atob(token.split('.')[1]));
        this.user = {
          id: userData.id || '1',
          email: userData.email || 'user@example.com',
          displayName: userData.displayName || 'User',
          role: userData.role || 'SALESPERSON',
          isActive: true
        };
      } catch (error) {
        console.error('Failed to parse user data from token');
        this.user = null;
      }
    }
  }

  get isAuthenticated(): boolean {
    return this.user !== null;
  }

  get currentUser(): User | null {
    return this.user;
  }

  async login(email: string, password: string): Promise<void> {
    const response = await apiService.login(email, password);
    this.user = response.user;
    this.notifyListeners();
  }

  logout() {
    this.user = null;
    localStorage.removeItem('userToken');
    this.notifyListeners();
  }

  addListener(listener: () => void) {
    this.listeners.push(listener);
  }

  removeListener(listener: () => void) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }
}

// Login View (matching iOS LoginView)
const LoginView: React.FC<{ authManager: AuthManager }> = ({ authManager }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await authManager.login(email, password);
    } catch (err) {
      setError('Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <h2>🎯 Sales Scorecard</h2>
        <p className="login-subtitle">Sign in to access your sales dashboard</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email:</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="your.email@company.com"
            />
          </div>
          <div className="form-group">
            <label>Password:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" disabled={loading} className="login-button">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

// Main App Component (matching iOS App structure)
const App: React.FC = () => {
  const [authManager] = useState(() => new AuthManager());
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const listener = () => forceUpdate({});
    authManager.addListener(listener);
    return () => authManager.removeListener(listener);
  }, [authManager]);

  return (
    <div className="App">
      {authManager.isAuthenticated ? (
        <div className="tab-view">
          <div className="tab-content">
            <div className="view-content">
              <h3>🎯 Sales Scorecard PWA</h3>
              <p>Welcome! You are logged in as: {authManager.currentUser?.displayName}</p>
              <p>Role: {authManager.currentUser?.role}</p>
              <button onClick={() => authManager.logout()} className="login-button">
                Logout
              </button>
            </div>
          </div>
        </div>
      ) : (
        <LoginView authManager={authManager} />
      )}
    </div>
  );
};

export default App;