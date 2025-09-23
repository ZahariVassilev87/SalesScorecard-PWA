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
    localStorage.setItem('adminToken', token);
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('adminToken');
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
        role: data.user?.role || 'ADMIN',
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
        <h2>🔐 Admin Login</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email:</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@example.com"
            />
          </div>
          <div className="form-group">
            <label>Password:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter password"
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" disabled={loading} className="login-button">
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

const TeamMembers: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadTeams = async () => {
    setLoading(true);
    setError('');
    try {
      const [teamsData, usersData] = await Promise.all([
        apiService.getTeams(),
        apiService.getUsers()
      ]);
      setTeams(teamsData);
      setUsers(usersData);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveUser = async (userId: string, teamId: string, userName: string, teamName: string) => {
    if (!window.confirm(`Are you sure you want to remove ${userName} from team "${teamName}"?`)) {
      return;
    }

    try {
      await apiService.removeUserFromTeam(userId, teamId);
      alert('✅ User removed successfully!');
      loadTeams();
    } catch (err) {
      alert('❌ Failed to remove user: ' + (err as Error).message);
    }
  };

  useEffect(() => {
    loadTeams();
  }, []);

  if (loading) {
    return <div className="loading">Loading team data...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="team-members">
      <div className="section-header">
        <h3>🏢 Team Management</h3>
        <div className="header-actions">
          <button onClick={loadTeams} className="refresh-button">
            🔄 Refresh
          </button>
        </div>
      </div>

      {teams.length === 0 ? (
        <p>No teams found. Create your first team to get started.</p>
      ) : (
        teams.map(team => (
          <div key={team.id} className="team-section">
            <div className="team-header">
              <div className="team-info">
                <h4>🏢 {team.name} ({team.region?.name || 'No region'})</h4>
              </div>
            </div>
            
            {team.userTeams.length === 0 ? (
              <p className="no-members">No members assigned to this team.</p>
            ) : (
              <ul className="team-members-list">
                {team.userTeams.map(userTeam => (
                  <li key={userTeam.user.id} className="team-member">
                    <span className="member-info">
                      👤 {userTeam.user.displayName} ({userTeam.user.email}) - {userTeam.user.role}
                    </span>
                    <button
                      onClick={() => handleRemoveUser(
                        userTeam.user.id,
                        team.id,
                        userTeam.user.displayName,
                        team.name
                      )}
                      className="remove-button"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))
      )}
    </div>
  );
};

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const usersData = await apiService.getUsers();
      setUsers(usersData);
    } catch (err) {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  if (loading) {
    return <div className="loading">Loading users...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="user-management">
      <div className="section-header">
        <h3>👤 User Management</h3>
        <div className="header-actions">
          <button onClick={loadUsers} className="refresh-button">
            🔄 Refresh
          </button>
        </div>
      </div>

      {users.length === 0 ? (
        <p>No users found.</p>
      ) : (
        <div className="users-table">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>{user.displayName}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`role-badge role-${user.role.toLowerCase()}`}>
                      {user.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${user.isActive ? 'active' : 'inactive'}`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState('teams');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    // Check if app is installable and not already installed
    if (pwaService.isInstallable() && !pwaService.isInstalled()) {
      setShowInstallPrompt(true);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
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
    <div className="admin-panel">
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

      <header className="admin-header">
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
          <h1>🎯 Sales Scorecard PWA</h1>
        </div>
        <button onClick={handleLogout} className="logout-button">
          🚪 Logout
        </button>
      </header>

      <nav className={`admin-nav ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <button
          className={activeTab === 'teams' ? 'nav-button active' : 'nav-button'}
          onClick={() => {
            setActiveTab('teams');
            closeMobileMenu();
          }}
        >
          👥 Team Management
        </button>
        <button
          className={activeTab === 'users' ? 'nav-button active' : 'nav-button'}
          onClick={() => {
            setActiveTab('users');
            closeMobileMenu();
          }}
        >
          👤 User Management
        </button>
      </nav>

      {isMobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={closeMobileMenu}></div>
      )}

      <main className="admin-content">
        {activeTab === 'teams' && <TeamMembers />}
        {activeTab === 'users' && <UserManagement />}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('adminToken');
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
        <AdminPanel />
      ) : (
        <LoginForm onLogin={handleLogin} />
      )}
    </div>
  );
};

export default App;
