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

interface Evaluation {
  id: string;
  userId: string;
  evaluatorId: string;
  score: number;
  feedback: string;
  createdAt: string;
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

  async getEvaluations(): Promise<Evaluation[]> {
    const response = await fetch(`${API_BASE}/api/evaluations`, {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch evaluations');
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

// Components (matching iOS app structure)

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

// Role-Based View (matching iOS RoleBasedView)
const RoleBasedView: React.FC<{ authManager: AuthManager }> = ({ authManager }) => {
  const user = authManager.currentUser;
  
  if (!user) return null;

  switch (user.role) {
    case 'ADMIN':
      return <AdminTabView />;
    case 'SALES_DIRECTOR':
      return <DirectorTabView />;
    case 'REGIONAL_SALES_MANAGER':
      return <ManagerTabView />;
    case 'SALES_LEAD':
      return <LeadTabView />;
    case 'SALESPERSON':
      return <SalespersonTabView />;
    default:
      return <DefaultTabView />;
  }
};

// Tab Views (matching iOS tab structure)

// Admin Tab View
const AdminTabView: React.FC = () => {
  const [activeTab, setActiveTab] = useState('evaluations');

  return (
    <div className="tab-view">
      <div className="tab-navigation">
        <button 
          className={activeTab === 'evaluations' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('evaluations')}
        >
          📝 New Evaluation
        </button>
        <button 
          className={activeTab === 'history' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('history')}
        >
          🕒 History
        </button>
        <button 
          className={activeTab === 'analytics' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('analytics')}
        >
          📊 Analytics
        </button>
        <button 
          className={activeTab === 'export' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('export')}
        >
          📤 Export
        </button>
        <button 
          className={activeTab === 'admin' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('admin')}
        >
          ⚙️ Admin
        </button>
      </div>
      <div className="tab-content">
        {activeTab === 'evaluations' && <NewEvaluationView />}
        {activeTab === 'history' && <EvaluationsHistoryView />}
        {activeTab === 'analytics' && <AnalyticsView />}
        {activeTab === 'export' && <ExportView />}
        {activeTab === 'admin' && <AdminSettingsView />}
      </div>
    </div>
  );
};

// Sales Director Tab View
const DirectorTabView: React.FC = () => {
  const [activeTab, setActiveTab] = useState('evaluations');

  return (
    <div className="tab-view">
      <div className="tab-navigation">
        <button 
          className={activeTab === 'evaluations' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('evaluations')}
        >
          📝 New Evaluation
        </button>
        <button 
          className={activeTab === 'analytics' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('analytics')}
        >
          📊 Analytics
        </button>
        <button 
          className={activeTab === 'history' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('history')}
        >
          🕒 History
        </button>
        <button 
          className={activeTab === 'export' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('export')}
        >
          📤 Export
        </button>
        <button 
          className={activeTab === 'teams' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('teams')}
        >
          👥 Teams
        </button>
      </div>
      <div className="tab-content">
        {activeTab === 'evaluations' && <NewEvaluationView />}
        {activeTab === 'analytics' && <AnalyticsView />}
        {activeTab === 'history' && <EvaluationsHistoryView />}
        {activeTab === 'export' && <ExportView />}
        {activeTab === 'teams' && <TeamManagementView />}
      </div>
    </div>
  );
};

// Sales Manager Tab View
const ManagerTabView: React.FC = () => {
  const [activeTab, setActiveTab] = useState('evaluations');

  return (
    <div className="tab-view">
      <div className="tab-navigation">
        <button 
          className={activeTab === 'evaluations' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('evaluations')}
        >
          📝 New Evaluation
        </button>
        <button 
          className={activeTab === 'history' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('history')}
        >
          🕒 History
        </button>
        <button 
          className={activeTab === 'analytics' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('analytics')}
        >
          📊 Analytics
        </button>
        <button 
          className={activeTab === 'teams' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('teams')}
        >
          👥 Team
        </button>
      </div>
      <div className="tab-content">
        {activeTab === 'evaluations' && <NewEvaluationView />}
        {activeTab === 'history' && <EvaluationsHistoryView />}
        {activeTab === 'analytics' && <AnalyticsView />}
        {activeTab === 'teams' && <TeamManagementView />}
      </div>
    </div>
  );
};

// Sales Lead Tab View
const LeadTabView: React.FC = () => {
  const [activeTab, setActiveTab] = useState('evaluations');

  return (
    <div className="tab-view">
      <div className="tab-navigation">
        <button 
          className={activeTab === 'evaluations' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('evaluations')}
        >
          📝 New Evaluation
        </button>
        <button 
          className={activeTab === 'history' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('history')}
        >
          🕒 History
        </button>
        <button 
          className={activeTab === 'analytics' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('analytics')}
        >
          📊 Analytics
        </button>
      </div>
      <div className="tab-content">
        {activeTab === 'evaluations' && <NewEvaluationView />}
        {activeTab === 'history' && <EvaluationsHistoryView />}
        {activeTab === 'analytics' && <AnalyticsView />}
      </div>
    </div>
  );
};

// Salesperson Tab View
const SalespersonTabView: React.FC = () => {
  const [activeTab, setActiveTab] = useState('evaluations');

  return (
    <div className="tab-view">
      <div className="tab-navigation">
        <button 
          className={activeTab === 'evaluations' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('evaluations')}
        >
          🕒 My Evaluations
        </button>
        <button 
          className={activeTab === 'analytics' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('analytics')}
        >
          📊 My Performance
        </button>
        <button 
          className={activeTab === 'profile' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('profile')}
        >
          👤 Profile
        </button>
      </div>
      <div className="tab-content">
        {activeTab === 'evaluations' && <EvaluationsHistoryView />}
        {activeTab === 'analytics' && <AnalyticsView />}
        {activeTab === 'profile' && <DashboardView />}
      </div>
    </div>
  );
};

// Default Tab View
const DefaultTabView: React.FC = () => {
  const [activeTab, setActiveTab] = useState('evaluations');

  return (
    <div className="tab-view">
      <div className="tab-navigation">
        <button 
          className={activeTab === 'evaluations' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('evaluations')}
        >
          📝 New Evaluation
        </button>
        <button 
          className={activeTab === 'history' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('history')}
        >
          🕒 History
        </button>
      </div>
      <div className="tab-content">
        {activeTab === 'evaluations' && <NewEvaluationView />}
        {activeTab === 'history' && <EvaluationsHistoryView />}
      </div>
    </div>
  );
};

// View Components (matching iOS Views)

const NewEvaluationView: React.FC = () => (
  <div className="view-content">
    <h3>📝 New Evaluation</h3>
    <p>Create a new sales evaluation form will be implemented here.</p>
  </div>
);

const EvaluationsHistoryView: React.FC = () => (
  <div className="view-content">
    <h3>🕒 Evaluations History</h3>
    <p>View past evaluations - implementation coming soon.</p>
  </div>
);

const AnalyticsView: React.FC = () => (
  <div className="view-content">
    <h3>📊 Analytics</h3>
    <p>Performance analytics and charts will be displayed here.</p>
  </div>
);

const ExportView: React.FC = () => (
  <div className="view-content">
    <h3>📤 Export Data</h3>
    <p>Export evaluation data to various formats.</p>
  </div>
);

const AdminSettingsView: React.FC = () => (
  <div className="view-content">
    <h3>⚙️ Admin Settings</h3>
    <p>Administrative settings and user management.</p>
  </div>
);

const TeamManagementView: React.FC = () => (
  <div className="view-content">
    <h3>👥 Team Management</h3>
    <p>Manage team members and assignments.</p>
  </div>
);

const DashboardView: React.FC = () => (
  <div className="view-content">
    <h3>👤 Profile Dashboard</h3>
    <p>Personal profile and performance overview.</p>
  </div>
);

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
        <RoleBasedView authManager={authManager} />
      ) : (
        <LoginView authManager={authManager} />
      )}
    </div>
  );
};

export default App;