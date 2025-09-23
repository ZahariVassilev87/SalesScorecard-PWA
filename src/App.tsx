import React, { useState, useEffect } from 'react';
import './App.css';

// Types
interface User {
  id: string;
  email: string;
  displayName: string;
  role: string;
  isActive: boolean;
}

interface Team {
  id: string;
  name: string;
  region?: {
    name: string;
  };
  userTeams: Array<{
    user: User;
  }>;
}

interface LoginResponse {
  token: string;
  user: User;
}

// API Service
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

  async getUsers(): Promise<User[]> {
    const response = await fetch(`${API_BASE}/public-admin/users`, {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }

    return response.json();
  }

  async getTeams(): Promise<Team[]> {
    const response = await fetch(`${API_BASE}/public-admin/teams`, {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch teams');
    }

    return response.json();
  }

  async removeUserFromTeam(userId: string, teamId: string): Promise<any> {
    const response = await fetch(`${API_BASE}/public-admin/remove-user-from-team`, {
      method: 'DELETE',
      headers: this.getHeaders(),
      body: JSON.stringify({ userId, teamId })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to remove user: ${response.status} ${errorText}`);
    }

    return response.json();
  }
}

const apiService = new ApiService();

// PWA Service
class PWAService {
  private deferredPrompt: any = null;

  constructor() {
    this.setupInstallPrompt();
    this.registerServiceWorker();
  }

  private setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      console.log('PWA: Install prompt ready');
    });

    window.addEventListener('appinstalled', () => {
      console.log('PWA: App installed successfully');
      this.deferredPrompt = null;
    });
  }

  private async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('PWA: Service Worker registered', registration);
      } catch (error) {
        console.error('PWA: Service Worker registration failed', error);
      }
    }
  }

  async installApp(): Promise<boolean> {
    if (!this.deferredPrompt) {
      return false;
    }

    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('PWA: User accepted install prompt');
      return true;
    } else {
      console.log('PWA: User dismissed install prompt');
      return false;
    }
  }

  isInstallable(): boolean {
    return this.deferredPrompt !== null;
  }

  isInstalled(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone === true;
  }
}

const pwaService = new PWAService();

// Components
const LoginForm: React.FC<{ onLogin: (token: string) => void }> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiService.login(email, password);
      onLogin(response.token);
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

const MyTeam: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadMyTeams = async () => {
    setLoading(true);
    setError('');
    try {
      const teamsData = await apiService.getTeams();
      setTeams(teamsData);
    } catch (err) {
      setError('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMyTeams();
  }, []);

  if (loading) {
    return <div className="loading">Loading your team...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="my-team">
      <div className="section-header">
        <h3>👥 My Team</h3>
        <div className="header-actions">
          <button onClick={loadMyTeams} className="refresh-button">
            🔄 Refresh
          </button>
        </div>
      </div>

      {teams.length === 0 ? (
        <div className="no-teams">
          <p>You're not assigned to any teams yet.</p>
          <p>Contact your manager to get added to a team.</p>
        </div>
      ) : (
        teams.map(team => (
          <div key={team.id} className="team-section">
            <div className="team-header">
              <div className="team-info">
                <h4>🏢 {team.name}</h4>
                {team.region?.name && (
                  <p className="team-region">📍 {team.region.name}</p>
                )}
              </div>
            </div>
            
            {team.userTeams.length === 0 ? (
              <p className="no-members">No team members yet.</p>
            ) : (
              <div className="team-members-grid">
                {team.userTeams.map(userTeam => (
                  <div key={userTeam.user.id} className="team-member-card">
                    <div className="member-avatar">
                      {userTeam.user.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="member-details">
                      <h5>{userTeam.user.displayName}</h5>
                      <p className="member-role">{userTeam.user.role.replace('_', ' ')}</p>
                      <p className="member-email">{userTeam.user.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

const Dashboard: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadUserProfile = async () => {
    setLoading(true);
    setError('');
    try {
      // Get current user info from token
      const token = localStorage.getItem('userToken');
      if (token) {
        // Decode token to get user info (simplified)
        const userData = JSON.parse(atob(token.split('.')[1]));
        setUser({
          id: userData.id || '1',
          email: userData.email || 'user@example.com',
          displayName: userData.displayName || 'User',
          role: userData.role || 'SALESPERSON',
          isActive: true
        });
      }
    } catch (err) {
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserProfile();
  }, []);

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="dashboard">
      <div className="welcome-section">
        <h3>Welcome back, {user?.displayName || 'User'}!</h3>
        <p className="welcome-subtitle">Here's your sales overview</p>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <div className="card-icon">📊</div>
          <h4>Sales Performance</h4>
          <p className="card-value">$0</p>
          <p className="card-label">This Month</p>
        </div>

        <div className="dashboard-card">
          <div className="card-icon">🎯</div>
          <h4>Goals</h4>
          <p className="card-value">0/0</p>
          <p className="card-label">Targets Met</p>
        </div>

        <div className="dashboard-card">
          <div className="card-icon">👥</div>
          <h4>Team</h4>
          <p className="card-value">0</p>
          <p className="card-label">Team Members</p>
        </div>

        <div className="dashboard-card">
          <div className="card-icon">📈</div>
          <h4>Growth</h4>
          <p className="card-value">0%</p>
          <p className="card-label">vs Last Month</p>
        </div>
      </div>

      <div className="quick-actions">
        <h4>Quick Actions</h4>
        <div className="actions-grid">
          <button className="action-card">
            <span className="action-icon">📝</span>
            <span>New Evaluation</span>
          </button>
          <button className="action-card">
            <span className="action-icon">📊</span>
            <span>View Reports</span>
          </button>
          <button className="action-card">
            <span className="action-icon">👥</span>
            <span>Team Chat</span>
          </button>
          <button className="action-card">
            <span className="action-icon">⚙️</span>
            <span>Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const SalesApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    // Check if app is installable and not already installed
    if (pwaService.isInstallable() && !pwaService.isInstalled()) {
      setShowInstallPrompt(true);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('userToken');
    window.location.reload();
  };

  const handleInstall = async () => {
    const installed = await pwaService.installApp();
    if (installed) {
      setShowInstallPrompt(false);
    }
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="sales-app">
      {showInstallPrompt && (
        <div className="install-prompt">
          <div className="install-content">
            <h4>📱 Install Sales Scorecard</h4>
            <p>Install this app on your device for a better experience!</p>
            <div className="install-actions">
              <button onClick={handleInstall} className="install-button">
                Install App
              </button>
              <button onClick={() => setShowInstallPrompt(false)} className="dismiss-button">
                Not Now
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="app-header">
        <div className="header-left">
          <button 
            className="mobile-menu-toggle"
            onClick={toggleMobileMenu}
            aria-label="Toggle mobile menu"
          >
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
          </button>
          <h1>🎯 Sales Scorecard</h1>
        </div>
        <button onClick={handleLogout} className="logout-button">
          🚪 Sign Out
        </button>
      </header>

      <nav className={`app-nav ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <button
          className={activeTab === 'dashboard' ? 'nav-button active' : 'nav-button'}
          onClick={() => {
            setActiveTab('dashboard');
            closeMobileMenu();
          }}
        >
          📊 Dashboard
        </button>
        <button
          className={activeTab === 'team' ? 'nav-button active' : 'nav-button'}
          onClick={() => {
            setActiveTab('team');
            closeMobileMenu();
          }}
        >
          👥 My Team
        </button>
      </nav>

      {isMobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={closeMobileMenu}></div>
      )}

      <main className="app-content">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'team' && <MyTeam />}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('userToken');
    if (token) {
      setIsLoggedIn(true);
    }
  }, []);

  const handleLogin = (token: string) => {
    setIsLoggedIn(true);
  };

  return (
    <div className="App">
      {isLoggedIn ? (
        <SalesApp />
      ) : (
        <LoginForm onLogin={handleLogin} />
      )}
    </div>
  );
};

export default App;
