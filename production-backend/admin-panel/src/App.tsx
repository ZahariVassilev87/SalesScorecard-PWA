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

interface Region {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface Team {
  id: string;
  name: string;
  region?: {
    name: string;
  };
  manager?: User;
  managerId?: string;
  userTeams: Array<{
    user: User;
  }>;
}

interface Company {
  id: string;
  name: string;
  isActive: boolean;
}

interface CompanyFeatureFlags {
  enableCompanyCustomization: boolean;
  useLegacyEvaluationFlow: boolean;
}

interface CompanyScoringProfile {
  mode: 'legacy_average' | 'weighted_average';
  settings: Record<string, any>;
}

interface CompanyHierarchyTemplate {
  rules: Array<{
    evaluatorRole: string;
    targetRoles: string[];
  }>;
}

interface CompanyConfigurationPayload {
  companyId: string;
  featureFlags: CompanyFeatureFlags;
  scoringProfile: CompanyScoringProfile;
  hierarchyTemplate: CompanyHierarchyTemplate;
}

interface CompanyFormTemplatePayload {
  companyId: string;
  categories: Array<{
    id: string;
    name: string;
    order: number;
    weight: number;
    items: Array<{
      id: string;
      name: string;
      order: number;
      weight?: number;
      isActive?: boolean;
    }>;
  }>;
}

/** Roles shown in hierarchy & form editors (order: broad → narrow) */
const ROLE_OPTIONS_EVALUATOR = [
  'SUPER_ADMIN',
  'ADMIN',
  'SALES_DIRECTOR',
  'REGIONAL_SALES_MANAGER',
  'REGIONAL_MANAGER',
  'SALES_LEAD',
  'SALESPERSON'
] as const;

const ROLE_OPTIONS_TARGET = [
  'SALESPERSON',
  'SALES_LEAD',
  'REGIONAL_MANAGER',
  'REGIONAL_SALES_MANAGER',
  'SALES_DIRECTOR',
  'ADMIN',
  'SUPER_ADMIN'
] as const;

type HierarchyRuleEditor = {
  key: string;
  evaluatorRole: string;
  targetRoles: string[];
};

type FormItemEditor = {
  key: string;
  id: string;
  name: string;
  order: number;
  weight: number;
  isActive: boolean;
};

type FormCategoryEditor = {
  key: string;
  id: string;
  name: string;
  order: number;
  weight: number;
  items: FormItemEditor[];
};

const PROD_SALESPERSON_STANDARD_PRESET: CompanyFormTemplatePayload['categories'] = [
  {
    id: crypto.randomUUID(),
    name: 'Discovery (SALESPERSON)',
    order: 1,
    weight: 0.25,
    items: [
      { id: crypto.randomUUID(), name: 'Asks open-ended questions', order: 1, weight: 1, isActive: true },
      { id: crypto.randomUUID(), name: 'Uncovers customer pain points', order: 2, weight: 1, isActive: true },
      { id: crypto.randomUUID(), name: 'Identifies decision makers', order: 3, weight: 1, isActive: true }
    ]
  },
  {
    id: crypto.randomUUID(),
    name: 'Solution Positioning (SALESPERSON)',
    order: 2,
    weight: 0.25,
    items: [
      { id: crypto.randomUUID(), name: 'Tailors solution to customer context', order: 1, weight: 1, isActive: true },
      { id: crypto.randomUUID(), name: 'Articulates clear value proposition', order: 2, weight: 1, isActive: true },
      { id: crypto.randomUUID(), name: 'Demonstrates product knowledge', order: 3, weight: 1, isActive: true }
    ]
  },
  {
    id: crypto.randomUUID(),
    name: 'Closing & Next Steps (SALESPERSON)',
    order: 3,
    weight: 0.25,
    items: [
      { id: crypto.randomUUID(), name: 'Makes clear asks', order: 1, weight: 1, isActive: true },
      { id: crypto.randomUUID(), name: 'Identifies next steps', order: 2, weight: 1, isActive: true },
      { id: crypto.randomUUID(), name: 'Sets mutual commitments', order: 3, weight: 1, isActive: true }
    ]
  },
  {
    id: crypto.randomUUID(),
    name: 'Professionalism (SALESPERSON)',
    order: 4,
    weight: 0.25,
    items: [
      { id: crypto.randomUUID(), name: 'Arrives prepared', order: 1, weight: 1, isActive: true },
      { id: crypto.randomUUID(), name: 'Manages time effectively', order: 2, weight: 1, isActive: true },
      { id: crypto.randomUUID(), name: 'Maintains professional demeanor', order: 3, weight: 1, isActive: true }
    ]
  }
];

const PROD_COACHING_SALES_LEAD_PRESET: CompanyFormTemplatePayload['categories'] = [
  {
    id: crypto.randomUUID(),
    name: 'PRE-MEETING COACHING',
    order: 1,
    weight: 3 / 12,
    items: [
      { id: crypto.randomUUID(), name: 'Clarified the objective for the client meeting', order: 1, weight: 1, isActive: true },
      { id: crypto.randomUUID(), name: 'Reviewed salesperson preparation (menu, max potential, basket size)', order: 2, weight: 1, isActive: true },
      { id: crypto.randomUUID(), name: 'Ensured the salesperson has a clear strategy for what to do in the meeting', order: 3, weight: 1, isActive: true }
    ]
  },
  {
    id: crypto.randomUUID(),
    name: 'BEHAVIOR DURING CLIENT MEETING',
    order: 2,
    weight: 2 / 12,
    items: [
      { id: crypto.randomUUID(), name: 'Allowed the salesperson to lead the conversation', order: 1, weight: 1, isActive: true },
      { id: crypto.randomUUID(), name: 'Intervened only when necessary (business-critical situations)', order: 2, weight: 1, isActive: true }
    ]
  },
  {
    id: crypto.randomUUID(),
    name: 'Quality of Analysis & Feedback',
    order: 3,
    weight: 4 / 12,
    items: [
      { id: crypto.randomUUID(), name: 'Asked for the salesperson’s self-assessment first', order: 1, weight: 1, isActive: true },
      { id: crypto.randomUUID(), name: 'Gave positive feedback using Behavior - Impact - Result', order: 2, weight: 1, isActive: true },
      { id: crypto.randomUUID(), name: 'Gave constructive feedback using Behavior - Impact - Result', order: 3, weight: 1, isActive: true },
      { id: crypto.randomUUID(), name: 'Used real examples from the meeting', order: 4, weight: 1, isActive: true }
    ]
  },
  {
    id: crypto.randomUUID(),
    name: 'Translating Into Action',
    order: 4,
    weight: 3 / 12,
    items: [
      { id: crypto.randomUUID(), name: 'Set a clear goal for executing specific behavior for the next visit (FOCUS)', order: 1, weight: 1, isActive: true },
      { id: crypto.randomUUID(), name: 'Ensured agreement and understanding from the salesperson', order: 2, weight: 1, isActive: true },
      { id: crypto.randomUUID(), name: 'Set a weekly goal for executing specific behavior (FOCUS)', order: 3, weight: 1, isActive: true }
    ]
  }
];

/** Mirrors /scoring/categories filtering by category name (Metro-style tokens). View-only in admin. */
type FormTemplatePwaView = 'all' | 'sp_standard' | 'sp_high_share' | 'sales_lead';

function categoryMatchesPwaView(categoryName: string, view: FormTemplatePwaView): boolean {
  if (view === 'all') return true;
  const n = categoryName || '';
  const u = n.toUpperCase();
  if (view === 'sales_lead') {
    return u.includes('SALES_LEAD');
  }
  if (view === 'sp_high_share') {
    return u.includes('SALESPERSON') && (u.includes('HIGH_SHARE') || n.includes('High Share'));
  }
  if (view === 'sp_standard') {
    return u.includes('SALESPERSON') && !u.includes('HIGH_SHARE') && !n.includes('High Share');
  }
  return true;
}

interface LoginResponse {
  token: string;
  user: User;
}

// API Service — relative URLs in dev (empty base) so CRA `proxy` forwards to the Node backend; use env or origin in prod / cross-origin.
const API_BASE =
  process.env.REACT_APP_ADMIN_API_BASE_URL ||
  process.env.REACT_APP_API_BASE_URL ||
  (process.env.NODE_ENV === 'development' ? '' : window.location.origin);

class ApiService {
  private token: string | null = null;
  private companyId: string | null = localStorage.getItem('adminCompanyId');

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

  setCompanyContext(companyId: string | null) {
    this.companyId = companyId;
    if (companyId) {
      localStorage.setItem('adminCompanyId', companyId);
    } else {
      localStorage.removeItem('adminCompanyId');
    }
  }

  private withCompany(path: string): string {
    if (!this.companyId) {
      return `${API_BASE}${path}`;
    }
    const separator = path.includes('?') ? '&' : '?';
    return `${API_BASE}${path}${separator}companyId=${encodeURIComponent(this.companyId)}`;
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    // Use the correct auth endpoint
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
    
    // Extract token from the response
    const token = data.access_token || data.token;
    
    if (!token) {
      throw new Error('No token received from server');
    }
    
    // SECURITY CHECK: Only ADMIN/SUPER_ADMIN users can access admin panel
    const userRole = data.user?.role;
    if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
      throw new Error('Access denied. Only admin users can access the admin panel.');
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

  async getCurrentUser(): Promise<User> {
    const response = await fetch(`${API_BASE}/users/profile/me`, {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch user profile: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async getUsers(): Promise<User[]> {
    const response = await fetch(this.withCompany('/public-admin/users'), {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }

    return response.json();
  }

  async getTeams(): Promise<Team[]> {
    // Connect to your real API
    const response = await fetch(this.withCompany('/public-admin/teams'), {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch teams');
    }

    return response.json();
  }

  async removeUserFromTeam(userId: string, teamId: string): Promise<any> {
    // Connect to your real API
    const response = await fetch(this.withCompany('/public-admin/remove-user-from-team'), {
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

  async updateUser(userId: string, userData: { displayName?: string; email?: string; role?: string; isActive?: boolean }): Promise<User> {
    const response = await fetch(this.withCompany(`/public-admin/users/${userId}`), {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update user: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async deactivateUser(userId: string): Promise<any> {
    const response = await fetch(this.withCompany(`/public-admin/users/${userId}/deactivate`), {
      method: 'POST',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to deactivate user: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async deleteUser(userId: string): Promise<any> {
    const response = await fetch(this.withCompany(`/public-admin/users/${userId}`), {
      method: 'DELETE',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to delete user: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async createTeam(teamData: { name: string; region: string; managerId?: string }): Promise<Team> {
    const response = await fetch(this.withCompany('/public-admin/teams'), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(teamData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create team: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async updateTeamManager(teamId: string, managerId: string): Promise<Team> {
    const response = await fetch(this.withCompany(`/public-admin/teams/${teamId}/manager`), {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ managerId })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update team manager: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async updateTeam(teamId: string, teamData: { name?: string; region?: string }): Promise<Team> {
    const response = await fetch(this.withCompany(`/public-admin/teams/${teamId}`), {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(teamData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update team: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async deleteTeam(teamId: string): Promise<any> {
    const response = await fetch(this.withCompany(`/public-admin/teams/${teamId}`), {
      method: 'DELETE',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to delete team: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async getRegions(): Promise<Region[]> {
    const response = await fetch(this.withCompany('/public-admin/regions'), {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch regions: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async assignUserToTeam(userId: string, teamId: string): Promise<any> {
    const response = await fetch(this.withCompany('/public-admin/assign-user-to-team'), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ userId, teamId })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to assign user to team: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async createUser(userData: { 
    displayName: string; 
    email: string; 
    password: string; 
    role: string; 
  }): Promise<User> {
    const response = await fetch(this.withCompany('/public-admin/users'), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create user: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async getCompanies(): Promise<Company[]> {
    const response = await fetch(`${API_BASE}/public-admin/companies`, {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch companies: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async createCompany(payload: {
    id: string;
    name: string;
    slug?: string;
    isActive?: boolean;
  }): Promise<Company & { slug?: string }> {
    const response = await fetch(`${API_BASE}/public-admin/companies`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create company: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async seedTemplates(companyId: string): Promise<any> {
    const response = await fetch(`${API_BASE}/public-admin/companies/${encodeURIComponent(companyId)}/seed-defaults`, {
      method: 'POST',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to seed templates: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async getCompanyConfiguration(companyId: string): Promise<CompanyConfigurationPayload> {
    const response = await fetch(`${API_BASE}/public-admin/companies/${encodeURIComponent(companyId)}/config`, {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to load company configuration: ${response.status} ${errorText}`);
    }
    return response.json();
  }

  async updateCompanyConfiguration(companyId: string, payload: {
    featureFlags: CompanyFeatureFlags;
    scoringProfile: CompanyScoringProfile;
    hierarchyTemplate: CompanyHierarchyTemplate;
  }): Promise<CompanyConfigurationPayload> {
    const response = await fetch(`${API_BASE}/public-admin/companies/${encodeURIComponent(companyId)}/config`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update company configuration: ${response.status} ${errorText}`);
    }
    return response.json();
  }

  async getCompanyFormTemplate(companyId: string): Promise<CompanyFormTemplatePayload> {
    const response = await fetch(`${API_BASE}/public-admin/companies/${encodeURIComponent(companyId)}/form-template`, {
      headers: this.getHeaders()
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to load company form template: ${response.status} ${errorText}`);
    }
    return response.json();
  }

  async updateCompanyFormTemplate(companyId: string, categories: any[]): Promise<CompanyFormTemplatePayload> {
    const response = await fetch(`${API_BASE}/public-admin/companies/${encodeURIComponent(companyId)}/form-template`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ categories })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update company form template: ${response.status} ${errorText}`);
    }
    return response.json();
  }
}

const apiService = new ApiService();

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

const TeamMembers: React.FC<{ openCreateSignal?: number; selectedCompanyId: string }> = ({
  openCreateSignal = 0,
  selectedCompanyId
}) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Sub-tab state
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'sales-director' | 'regional-manager' | 'sales-lead'>('all');
  
  // Form states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [showAddMemberForm, setShowAddMemberForm] = useState<string | null>(null);
  const [showSetManagerForm, setShowSetManagerForm] = useState<string | null>(null);
  
  // Form data
  const [createForm, setCreateForm] = useState({ name: '', region: '', managerId: '' });
  const [editForm, setEditForm] = useState({ name: '', region: '', managerId: '' });
  const [addMemberForm, setAddMemberForm] = useState({ userId: '' });
  const [setManagerForm, setSetManagerForm] = useState({ managerId: '' });
  const [viewMode, setViewMode] = useState<'list' | 'hierarchy'>('list');

  const loadTeams = async () => {
    setLoading(true);
    setError('');
    try {
      const [teamsData, usersData, regionsData] = await Promise.all([
        apiService.getTeams(),
        apiService.getUsers(),
        apiService.getRegions()
      ]);
      setTeams(teamsData);
      setUsers(usersData);
      setRegions(regionsData);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!createForm.name || !createForm.region) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      await apiService.createTeam(createForm);
      alert('✅ Team created successfully!');
      setCreateForm({ name: '', region: '', managerId: '' });
      setShowCreateForm(false);
      loadTeams();
    } catch (err) {
      alert('❌ Failed to create team: ' + (err as Error).message);
    }
  };

  const handleEditTeam = async () => {
    if (!editingTeam || !editForm.name || !editForm.region) {
      alert('Please fill in all fields');
      return;
    }

    try {
      await apiService.updateTeam(editingTeam.id, editForm);
      alert('✅ Team updated successfully!');
      setEditingTeam(null);
      setEditForm({ name: '', region: '', managerId: '' });
      loadTeams();
    } catch (err) {
      alert('❌ Failed to update team: ' + (err as Error).message);
    }
  };

  const handleSetTeamManager = async (teamId: string) => {
    if (!setManagerForm.managerId) {
      alert('Please select a manager');
      return;
    }

    try {
      await apiService.updateTeamManager(teamId, setManagerForm.managerId);
      alert('✅ Team manager updated successfully!');
      setShowSetManagerForm(null);
      setSetManagerForm({ managerId: '' });
      loadTeams();
    } catch (err) {
      alert('❌ Failed to update team manager: ' + (err as Error).message);
    }
  };

  const handleDeleteTeam = async (team: Team) => {
    if (!window.confirm(`Are you sure you want to delete team "${team.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await apiService.deleteTeam(team.id);
      alert('✅ Team deleted successfully!');
      loadTeams();
    } catch (err) {
      alert('❌ Failed to delete team: ' + (err as Error).message);
    }
  };

  const handleAddMember = async (teamId: string) => {
    if (!addMemberForm.userId) {
      alert('Please select a user to add');
      return;
    }

    try {
      await apiService.assignUserToTeam(addMemberForm.userId, teamId);
      alert('✅ User added to team successfully!');
      setAddMemberForm({ userId: '' });
      setShowAddMemberForm(null);
      loadTeams();
    } catch (err) {
      alert('❌ Failed to add user to team: ' + (err as Error).message);
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

  const startEditTeam = (team: Team) => {
    setEditingTeam(team);
    setEditForm({ 
      name: team.name, 
      region: team.region?.name || '',
      managerId: team.managerId || ''
    });
  };

  const cancelEdit = () => {
    setEditingTeam(null);
    setEditForm({ name: '', region: '', managerId: '' });
  };

  const getAvailableUsers = (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    const teamUserIds = team?.userTeams.map(ut => ut.user.id) || [];
    return users.filter(user => 
      user.isActive && 
      !teamUserIds.includes(user.id) &&
      ['SALESPERSON', 'SALES_LEAD', 'REGIONAL_SALES_MANAGER', 'SALES_DIRECTOR'].includes(user.role)
    );
  };

  const getFilteredTeams = () => {
    if (activeSubTab === 'all') {
      return teams;
    }
    
    return teams.filter(team => {
      if (!team.manager) return false;
      
      switch (activeSubTab) {
        case 'sales-director':
          return team.manager.role === 'SALES_DIRECTOR';
        case 'regional-manager':
          return team.manager.role === 'REGIONAL_SALES_MANAGER';
        case 'sales-lead':
          return team.manager.role === 'SALES_LEAD';
        default:
          return true;
      }
    });
  };

  const getSubTabTitle = () => {
    switch (activeSubTab) {
      case 'sales-director':
        return 'Sales Director Teams';
      case 'regional-manager':
        return 'Regional Manager Teams';
      case 'sales-lead':
        return 'Sales Lead Teams';
      default:
        return 'All Teams';
    }
  };

  useEffect(() => {
    loadTeams();
  }, [selectedCompanyId]);

  useEffect(() => {
    if (openCreateSignal > 0) {
      setShowCreateForm(true);
    }
  }, [openCreateSignal]);

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
          <div className="view-mode-toggle">
            <button 
              onClick={() => setViewMode('list')} 
              className={`view-toggle ${viewMode === 'list' ? 'active' : ''}`}
            >
              📋 List View
            </button>
            <button 
              onClick={() => setViewMode('hierarchy')} 
              className={`view-toggle ${viewMode === 'hierarchy' ? 'active' : ''}`}
            >
              🏗️ Hierarchy View
            </button>
          </div>
          <button onClick={() => setShowCreateForm(true)} className="action-button success">
            ➕ Create Team
          </button>
          <button onClick={loadTeams} className="refresh-button">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Sub-tabs for team filtering */}
      <div className="sub-tabs">
        <button 
          className={`sub-tab ${activeSubTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('all')}
        >
          📊 All Teams ({teams.length})
        </button>
        <button 
          className={`sub-tab ${activeSubTab === 'sales-director' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('sales-director')}
        >
          👔 Sales Director Teams ({teams.filter(t => t.manager?.role === 'SALES_DIRECTOR').length})
        </button>
        <button 
          className={`sub-tab ${activeSubTab === 'regional-manager' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('regional-manager')}
        >
          🏢 Regional Manager Teams ({teams.filter(t => t.manager?.role === 'REGIONAL_SALES_MANAGER').length})
        </button>
        <button 
          className={`sub-tab ${activeSubTab === 'sales-lead' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('sales-lead')}
        >
          👥 Sales Lead Teams ({teams.filter(t => t.manager?.role === 'SALES_LEAD').length})
        </button>
      </div>

      {/* Create Team Form */}
      {showCreateForm && (
        <div className="form-section">
          <h4>Create New Team</h4>
          <div className="form-group">
            <label>Team Name:</label>
            <input
              type="text"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              placeholder="Enter team name"
            />
          </div>
          <div className="form-group">
            <label>Region:</label>
            <select
              value={createForm.region}
              onChange={(e) => setCreateForm({ ...createForm, region: e.target.value })}
            >
              <option value="">Select a region</option>
              {regions.map(region => (
                <option key={region.id} value={region.name}>
                  {region.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Team Manager (Optional):</label>
            <select
              value={createForm.managerId}
              onChange={(e) => setCreateForm({ ...createForm, managerId: e.target.value })}
            >
              <option value="">No manager assigned</option>
              {users.filter(user => user.role === 'SALES_LEAD' || user.role === 'REGIONAL_SALES_MANAGER' || user.role === 'SALES_DIRECTOR').map(user => (
                <option key={user.id} value={user.id}>
                  {user.displayName} ({user.role})
                </option>
              ))}
            </select>
          </div>
          <div className="form-actions">
            <button onClick={handleCreateTeam} className="action-button success">
              Create Team
            </button>
            <button onClick={() => setShowCreateForm(false)} className="action-button">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Teams List or Hierarchy View */}
      {viewMode === 'hierarchy' ? (
        <div className="hierarchical-view">
          {getFilteredTeams().length === 0 ? (
            <p>No teams found in {getSubTabTitle().toLowerCase()}. Create your first team to get started.</p>
          ) : (
            getFilteredTeams().map(team => (
              <div key={team.id} className="team-hierarchy">
                <h4>🏢 {team.name}</h4>
                {team.manager ? (
                  <div className="manager-card">
                    <div className="manager-info">
                      <div className="manager-avatar">
                        {team.manager.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="manager-details">
                        <h5>{team.manager.displayName}</h5>
                        <p>{team.manager.email}</p>
                        <span className={`role-badge ${team.manager.role.toLowerCase().replace('_', '-')}`}>
                          {team.manager.role.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <div className="subordinates">
                      {team.userTeams
                        .filter(userTeam => userTeam.user.id !== team.manager?.id)
                        .map(userTeam => (
                          <div key={userTeam.user.id} className="subordinate-card">
                            <div className="subordinate-info">
                              <div className="subordinate-avatar">
                                {userTeam.user.displayName.charAt(0).toUpperCase()}
                              </div>
                              <div className="subordinate-details">
                                <h6>{userTeam.user.displayName}</h6>
                                <p>{userTeam.user.email}</p>
                                <span className={`role-badge ${userTeam.user.role.toLowerCase().replace('_', '-')}`}>
                                  {userTeam.user.role.replace('_', ' ')}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : (
                  <div className="no-manager">
                    <p>No manager assigned to this team.</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        getFilteredTeams().length === 0 ? (
          <p>No teams found in {getSubTabTitle().toLowerCase()}. Create your first team to get started.</p>
        ) : (
          getFilteredTeams().map(team => (
            <div key={team.id} className="team-section">
            <div className="team-header">
              {editingTeam?.id === team.id ? (
                <div className="edit-form">
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="edit-input"
                  />
                  <select
                    value={editForm.region}
                    onChange={(e) => setEditForm({ ...editForm, region: e.target.value })}
                    className="edit-select"
                  >
                    {regions.map(region => (
                      <option key={region.id} value={region.name}>
                        {region.name}
                      </option>
                    ))}
                  </select>
                  <button onClick={handleEditTeam} className="action-button success">
                    Save
                  </button>
                  <button onClick={cancelEdit} className="action-button">
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="team-info">
                  <h4>🏢 {team.name} ({team.region?.name || 'No region'})</h4>
                  <p className="team-manager">
                    👤 Manager: {team.manager ? `${team.manager.displayName} (${team.manager.role})` : 'No manager assigned'}
                  </p>
                  <div className="team-actions">
                    <button onClick={() => startEditTeam(team)} className="action-button">
                      ✏️ Edit
                    </button>
                    <button onClick={() => setShowSetManagerForm(team.id)} className="action-button">
                      👤 Set Manager
                    </button>
                    <button onClick={() => handleDeleteTeam(team)} className="action-button danger">
                      🗑️ Delete
                    </button>
                    <button 
                      onClick={() => setShowAddMemberForm(team.id)} 
                      className="action-button success"
                    >
                      ➕ Add Member
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Add Member Form */}
            {showAddMemberForm === team.id && (
              <div className="add-member-form">
                <select
                  value={addMemberForm.userId}
                  onChange={(e) => setAddMemberForm({ userId: e.target.value })}
                >
                  <option value="">Select a user to add</option>
                  {getAvailableUsers(team.id).map(user => (
                    <option key={user.id} value={user.id}>
                      {user.displayName} ({user.email}) - {user.role}
                    </option>
                  ))}
                </select>
                <button onClick={() => handleAddMember(team.id)} className="action-button success">
                  Add
                </button>
                <button onClick={() => setShowAddMemberForm(null)} className="action-button">
                  Cancel
                </button>
              </div>
            )}

            {/* Set Manager Form */}
            {showSetManagerForm === team.id && (
              <div className="set-manager-form">
                <select
                  value={setManagerForm.managerId}
                  onChange={(e) => setSetManagerForm({ managerId: e.target.value })}
                >
                  <option value="">Select a manager</option>
                  {users.filter(user => user.role === 'SALES_LEAD' || user.role === 'REGIONAL_SALES_MANAGER' || user.role === 'SALES_DIRECTOR').map(user => (
                    <option key={user.id} value={user.id}>
                      {user.displayName} ({user.role})
                    </option>
                  ))}
                </select>
                <button onClick={() => handleSetTeamManager(team.id)} className="action-button success">
                  Set Manager
                </button>
                <button onClick={() => setShowSetManagerForm(null)} className="action-button">
                  Cancel
                </button>
              </div>
            )}
            
            {/* Team Members */}
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
        )
        )}
      )
    </div>
  );
};

const UserManagement: React.FC<{ openCreateSignal?: number; selectedCompanyId: string }> = ({
  openCreateSignal = 0,
  selectedCompanyId
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ displayName: '', email: '', role: '' });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ 
    displayName: '', 
    email: '', 
    password: '', 
    role: '' 
  });
  
  // Sub-tab state for user filtering
  const [activeUserSubTab, setActiveUserSubTab] = useState<'all' | 'admin' | 'sales-director' | 'regional-manager' | 'sales-lead' | 'salesperson'>('all');

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

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditForm({
      displayName: user.displayName,
      email: user.email,
      role: user.role
    });
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;

    try {
      await apiService.updateUser(editingUser.id, editForm);
      alert('✅ User updated successfully!');
      setEditingUser(null);
      loadUsers(); // Refresh the list
    } catch (err) {
      alert('❌ Failed to update user: ' + (err as Error).message);
    }
  };

  const handleDeactivateUser = async (user: User) => {
    if (!window.confirm(`Are you sure you want to ${user.isActive ? 'deactivate' : 'activate'} ${user.displayName}?`)) {
      return;
    }

    try {
      if (user.isActive) {
        await apiService.deactivateUser(user.id);
        alert('✅ User deactivated successfully!');
      } else {
        await apiService.updateUser(user.id, { isActive: true });
        alert('✅ User activated successfully!');
      }
      loadUsers(); // Refresh the list
    } catch (err) {
      alert('❌ Failed to update user status: ' + (err as Error).message);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!window.confirm(`⚠️ Are you sure you want to PERMANENTLY DELETE user "${user.displayName}" (${user.email})? This action cannot be undone!`)) {
      return;
    }

    try {
      await apiService.deleteUser(user.id);
      alert('✅ User deleted successfully!');
      loadUsers(); // Refresh the list
    } catch (err) {
      alert('❌ Failed to delete user: ' + (err as Error).message);
    }
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setEditForm({ displayName: '', email: '', role: '' });
  };

  const handleCreateUser = async () => {
    if (!createForm.displayName || !createForm.email || !createForm.password || !createForm.role) {
      alert('Please fill in all fields');
      return;
    }

    try {
      await apiService.createUser(createForm);
      alert('✅ User created successfully!');
      setCreateForm({ displayName: '', email: '', password: '', role: '' });
      setShowCreateForm(false);
      loadUsers(); // Refresh the list
    } catch (err) {
      alert('❌ Failed to create user: ' + (err as Error).message);
    }
  };

  const handleCancelCreate = () => {
    setShowCreateForm(false);
    setCreateForm({ displayName: '', email: '', password: '', role: '' });
  };

  const getFilteredUsers = () => {
    if (activeUserSubTab === 'all') {
      return users;
    }
    
    return users.filter(user => {
      switch (activeUserSubTab) {
        case 'admin':
          return user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
        case 'sales-director':
          return user.role === 'SALES_DIRECTOR';
        case 'regional-manager':
          return user.role === 'REGIONAL_SALES_MANAGER';
        case 'sales-lead':
          return user.role === 'SALES_LEAD';
        case 'salesperson':
          return user.role === 'SALESPERSON';
        default:
          return true;
      }
    });
  };

  const getUserSubTabTitle = () => {
    switch (activeUserSubTab) {
      case 'admin':
        return 'Administrators';
      case 'sales-director':
        return 'Sales Directors';
      case 'regional-manager':
        return 'Regional Managers';
      case 'sales-lead':
        return 'Sales Leads';
      case 'salesperson':
        return 'Salespeople';
      default:
        return 'All Users';
    }
  };

  useEffect(() => {
    loadUsers();
  }, [selectedCompanyId]);

  useEffect(() => {
    if (openCreateSignal > 0) {
      setShowCreateForm(true);
    }
  }, [openCreateSignal]);

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
          <button onClick={() => setShowCreateForm(true)} className="action-button success">
            ➕ Create User
          </button>
          <button onClick={loadUsers} className="refresh-button">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Sub-tabs for user filtering */}
      <div className="sub-tabs">
        <button 
          className={`sub-tab ${activeUserSubTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveUserSubTab('all')}
        >
          👥 All Users ({users.length})
        </button>
        <button 
          className={`sub-tab ${activeUserSubTab === 'admin' ? 'active' : ''}`}
          onClick={() => setActiveUserSubTab('admin')}
        >
          👑 Admins ({users.filter(u => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN').length})
        </button>
        <button 
          className={`sub-tab ${activeUserSubTab === 'sales-director' ? 'active' : ''}`}
          onClick={() => setActiveUserSubTab('sales-director')}
        >
          👔 Sales Directors ({users.filter(u => u.role === 'SALES_DIRECTOR').length})
        </button>
        <button 
          className={`sub-tab ${activeUserSubTab === 'regional-manager' ? 'active' : ''}`}
          onClick={() => setActiveUserSubTab('regional-manager')}
        >
          🏢 Regional Managers ({users.filter(u => u.role === 'REGIONAL_SALES_MANAGER').length})
        </button>
        <button 
          className={`sub-tab ${activeUserSubTab === 'sales-lead' ? 'active' : ''}`}
          onClick={() => setActiveUserSubTab('sales-lead')}
        >
          👥 Sales Leads ({users.filter(u => u.role === 'SALES_LEAD').length})
        </button>
        <button 
          className={`sub-tab ${activeUserSubTab === 'salesperson' ? 'active' : ''}`}
          onClick={() => setActiveUserSubTab('salesperson')}
        >
          💼 Salespeople ({users.filter(u => u.role === 'SALESPERSON').length})
        </button>
      </div>

      {/* Create User Form */}
      {showCreateForm && (
        <div className="form-section">
          <h4>Create New User</h4>
          <div className="form-group">
            <label>Display Name:</label>
            <input
              type="text"
              value={createForm.displayName}
              onChange={(e) => setCreateForm({ ...createForm, displayName: e.target.value })}
              placeholder="Enter full name"
            />
          </div>
          <div className="form-group">
            <label>Email:</label>
            <input
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              placeholder="Enter email address"
            />
          </div>
          <div className="form-group">
            <label>Password:</label>
            <input
              type="password"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              placeholder="Enter password"
            />
          </div>
          <div className="form-group">
            <label>Role:</label>
            <select
              value={createForm.role}
              onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
            >
              <option value="">Select a role</option>
              <option value="ADMIN">Admin</option>
              <option value="SALES_DIRECTOR">Sales Director</option>
              <option value="REGIONAL_SALES_MANAGER">Regional Manager</option>
              <option value="SALES_LEAD">Sales Lead</option>
              <option value="SALESPERSON">Salesperson</option>
            </select>
          </div>
          <div className="form-actions">
            <button onClick={handleCreateUser} className="action-button success">
              Create User
            </button>
            <button onClick={handleCancelCreate} className="action-button">
              Cancel
            </button>
          </div>
        </div>
      )}

      {getFilteredUsers().length === 0 ? (
        <p>No users found in {getUserSubTabTitle().toLowerCase()}.</p>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="users-table desktop-only">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {getFilteredUsers().map(user => (
                  <tr key={user.id}>
                    <td>
                      {editingUser?.id === user.id ? (
                        <input
                          type="text"
                          value={editForm.displayName}
                          onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                          className="edit-input"
                        />
                      ) : (
                        user.displayName
                      )}
                    </td>
                    <td>
                      {editingUser?.id === user.id ? (
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          className="edit-input"
                        />
                      ) : (
                        user.email
                      )}
                    </td>
                    <td>
                      {editingUser?.id === user.id ? (
                        <select
                          value={editForm.role}
                          onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                          className="edit-select"
                        >
                          <option value="ADMIN">Admin</option>
                          <option value="SALES_DIRECTOR">Sales Director</option>
                          <option value="REGIONAL_SALES_MANAGER">Regional Manager</option>
                          <option value="SALES_LEAD">Sales Lead</option>
                          <option value="SALESPERSON">Salesperson</option>
                        </select>
                      ) : (
                        <span className={`role-badge role-${user.role.toLowerCase()}`}>
                          {user.role.replace('_', ' ')}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`status-badge ${user.isActive ? 'active' : 'inactive'}`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      {editingUser?.id === user.id ? (
                        <>
                          <button className="action-button success" onClick={handleSaveEdit}>
                            Save
                          </button>
                          <button className="action-button" onClick={handleCancelEdit}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            className="action-button" 
                            onClick={() => handleEditUser(user)}
                          >
                            Edit
                          </button>
                          <button 
                            className="action-button danger" 
                            onClick={() => handleDeactivateUser(user)}
                          >
                            {user.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button 
                            className="action-button danger" 
                            onClick={() => handleDeleteUser(user)}
                            style={{ backgroundColor: '#dc3545', marginLeft: '5px' }}
                          >
                            🗑️ Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="users-cards mobile-only">
            {getFilteredUsers().map(user => (
              <div key={user.id} className="user-card">
                <div className="user-card-header">
                  <div className="user-info">
                    <h4>
                      {editingUser?.id === user.id ? (
                        <input
                          type="text"
                          value={editForm.displayName}
                          onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                          className="edit-input"
                        />
                      ) : (
                        user.displayName
                      )}
                    </h4>
                    <p className="user-email">
                      {editingUser?.id === user.id ? (
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          className="edit-input"
                        />
                      ) : (
                        user.email
                      )}
                    </p>
                  </div>
                  <div className="user-status">
                    <span className={`status-badge ${user.isActive ? 'active' : 'inactive'}`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                
                <div className="user-card-body">
                  <div className="user-role">
                    <label>Role:</label>
                    {editingUser?.id === user.id ? (
                      <select
                        value={editForm.role}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                        className="edit-select"
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="SALES_DIRECTOR">Sales Director</option>
                        <option value="REGIONAL_SALES_MANAGER">Regional Manager</option>
                        <option value="SALES_LEAD">Sales Lead</option>
                        <option value="SALESPERSON">Salesperson</option>
                      </select>
                    ) : (
                      <span className={`role-badge role-${user.role.toLowerCase()}`}>
                        {user.role.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="user-card-actions">
                  {editingUser?.id === user.id ? (
                    <>
                      <button className="action-button success" onClick={handleSaveEdit}>
                        Save
                      </button>
                      <button className="action-button" onClick={handleCancelEdit}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        className="action-button" 
                        onClick={() => handleEditUser(user)}
                      >
                        Edit
                      </button>
                      <button 
                        className="action-button danger" 
                        onClick={() => handleDeactivateUser(user)}
                      >
                        {user.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button 
                        className="action-button danger" 
                        onClick={() => handleDeleteUser(user)}
                        style={{ backgroundColor: '#dc3545', marginLeft: '5px' }}
                      >
                        🗑️ Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const RegionsManagement: React.FC<{ selectedCompanyId: string }> = ({ selectedCompanyId }) => {
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadRegions = async () => {
    setLoading(true);
    setError('');
    try {
      const regionsData = await apiService.getRegions();
      setRegions(regionsData);
    } catch (err) {
      setError('Failed to load regions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRegions();
  }, [selectedCompanyId]);

  if (loading) {
    return <div className="loading">Loading regions...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="user-management">
      <div className="section-header">
        <h3>🗺️ Regions</h3>
        <div className="header-actions">
          <button onClick={loadRegions} className="refresh-button">🔄 Refresh</button>
        </div>
      </div>
      {regions.length === 0 ? (
        <p>No regions found.</p>
      ) : (
        <div className="users-table desktop-only">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((region) => (
                <tr key={region.id}>
                  <td>{region.name}</td>
                  <td>{region.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const CompanyConfiguration: React.FC<{ selectedCompanyId: string }> = ({ selectedCompanyId }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [featureFlags, setFeatureFlags] = useState<CompanyFeatureFlags>({
    enableCompanyCustomization: false,
    useLegacyEvaluationFlow: true
  });
  const [scoringMode, setScoringMode] = useState<'legacy_average' | 'weighted_average'>('legacy_average');
  const [hierarchyRules, setHierarchyRules] = useState<HierarchyRuleEditor[]>([]);
  const [formCategories, setFormCategories] = useState<FormCategoryEditor[]>([]);
  const [pwaFormView, setPwaFormView] = useState<FormTemplatePwaView>('all');

  const normalizeHierarchyFromConfig = (template: CompanyHierarchyTemplate | undefined): HierarchyRuleEditor[] => {
    const rules = template?.rules;
    if (Array.isArray(rules) && rules.length > 0) {
      return rules.map((r) => ({
        key: crypto.randomUUID(),
        evaluatorRole: typeof r.evaluatorRole === 'string' ? r.evaluatorRole : 'SALES_LEAD',
        targetRoles: Array.isArray(r.targetRoles) ? r.targetRoles.filter((x) => typeof x === 'string') : []
      }));
    }
    return [
      {
        key: crypto.randomUUID(),
        evaluatorRole: 'SALES_LEAD',
        targetRoles: ['SALESPERSON']
      }
    ];
  };

  const normalizeFormCategoriesFromApi = (categories: CompanyFormTemplatePayload['categories']): FormCategoryEditor[] => {
    if (!Array.isArray(categories) || categories.length === 0) {
      return [];
    }
    return categories.map((c) => ({
      key: crypto.randomUUID(),
      id: typeof c.id === 'string' ? c.id : crypto.randomUUID(),
      name: typeof c.name === 'string' ? c.name : '',
      order: Number.isFinite(Number(c.order)) ? Number(c.order) : 1,
      weight: Number.isFinite(Number(c.weight)) ? Number(c.weight) : 1,
      items: (Array.isArray(c.items) ? c.items : []).map((it) => ({
        key: crypto.randomUUID(),
        id: typeof it.id === 'string' ? it.id : crypto.randomUUID(),
        name: typeof it.name === 'string' ? it.name : '',
        order: Number.isFinite(Number(it.order)) ? Number(it.order) : 1,
        weight: (() => {
          const w = it.weight;
          if (typeof w === 'number' && Number.isFinite(w)) return w;
          const p = parseFloat(String(w ?? '1'));
          return Number.isFinite(p) ? p : 1;
        })(),
        isActive: it.isActive !== false
      }))
    }));
  };

  const load = async () => {
    if (selectedCompanyId === 'all') {
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    const errors: string[] = [];
    try {
      try {
        const config = await apiService.getCompanyConfiguration(selectedCompanyId);
        setFeatureFlags({
          enableCompanyCustomization: config.featureFlags?.enableCompanyCustomization === true,
          useLegacyEvaluationFlow: config.featureFlags?.useLegacyEvaluationFlow !== false
        });
        setScoringMode(config.scoringProfile?.mode === 'weighted_average' ? 'weighted_average' : 'legacy_average');
        setHierarchyRules(normalizeHierarchyFromConfig(config.hierarchyTemplate));
      } catch (configErr) {
        errors.push((configErr as Error).message);
      }

      try {
        const formTemplate = await apiService.getCompanyFormTemplate(selectedCompanyId);
        setFormCategories(normalizeFormCategoriesFromApi(formTemplate.categories || []));
      } catch (formErr) {
        errors.push((formErr as Error).message);
      }

      if (errors.length) {
        setError(errors.join('\n\n'));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyId]);

  const toggleTargetRole = (ruleKey: string, role: string) => {
    setHierarchyRules((prev) =>
      prev.map((rule) => {
        if (rule.key !== ruleKey) return rule;
        const has = rule.targetRoles.includes(role);
        return {
          ...rule,
          targetRoles: has ? rule.targetRoles.filter((r) => r !== role) : [...rule.targetRoles, role]
        };
      })
    );
  };

  const addHierarchyRule = () => {
    setHierarchyRules((prev) => [
      ...prev,
      { key: crypto.randomUUID(), evaluatorRole: 'SALES_LEAD', targetRoles: ['SALESPERSON'] }
    ]);
  };

  const removeHierarchyRule = (ruleKey: string) => {
    setHierarchyRules((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== ruleKey)));
  };

  const addCategory = () => {
    setFormCategories((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        id: crypto.randomUUID(),
        name: 'New category',
        order: prev.length + 1,
        weight: 1,
        items: []
      }
    ]);
  };

  const applyPreset = (preset: CompanyFormTemplatePayload['categories']) => {
    if (!window.confirm('Replace the current category list with this preset? You can still edit before saving.')) {
      return;
    }
    setFormCategories(normalizeFormCategoriesFromApi(preset));
    setSuccess('Preset loaded. Review and click Save configuration to persist.');
    setError('');
  };

  const removeCategory = (catKey: string) => {
    setFormCategories((prev) => prev.filter((c) => c.key !== catKey));
  };

  const updateCategory = (catKey: string, patch: Partial<Pick<FormCategoryEditor, 'name' | 'order' | 'weight'>>) => {
    setFormCategories((prev) =>
      prev.map((c) => (c.key === catKey ? { ...c, ...patch } : c))
    );
  };

  const addItem = (catKey: string) => {
    setFormCategories((prev) =>
      prev.map((c) => {
        if (c.key !== catKey) return c;
        const nextOrder = c.items.length + 1;
        return {
          ...c,
          items: [
            ...c.items,
            {
              key: crypto.randomUUID(),
              id: crypto.randomUUID(),
              name: 'New item',
              order: nextOrder,
              weight: 1,
              isActive: true
            }
          ]
        };
      })
    );
  };

  const removeItem = (catKey: string, itemKey: string) => {
    setFormCategories((prev) =>
      prev.map((c) => {
        if (c.key !== catKey) return c;
        return { ...c, items: c.items.filter((it) => it.key !== itemKey) };
      })
    );
  };

  const updateItem = (
    catKey: string,
    itemKey: string,
    patch: Partial<Pick<FormItemEditor, 'name' | 'order' | 'weight' | 'isActive'>>
  ) => {
    setFormCategories((prev) =>
      prev.map((c) => {
        if (c.key !== catKey) return c;
        return {
          ...c,
          items: c.items.map((it) => (it.key === itemKey ? { ...it, ...patch } : it))
        };
      })
    );
  };

  const handleSave = async () => {
    if (selectedCompanyId === 'all') {
      setError('Please select a specific company first.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const parsedHierarchy: CompanyHierarchyTemplate = {
        rules: hierarchyRules.map((r) => ({
          evaluatorRole: r.evaluatorRole,
          targetRoles: [...r.targetRoles]
        }))
      };
      const parsedFormTemplate = formCategories.map((c, ci) => ({
        id: c.id,
        name: c.name.trim() || `Category ${ci + 1}`,
        order: c.order,
        weight: c.weight,
        items: c.items.map((it, ii) => ({
          id: it.id,
          name: it.name.trim() || `Item ${ii + 1}`,
          order: it.order,
          weight: it.weight,
          isActive: it.isActive
        }))
      }));
      if (parsedFormTemplate.length === 0) {
        setError('Add at least one evaluation category (or use Seed Templates first).');
        setSaving(false);
        return;
      }
      await apiService.updateCompanyConfiguration(selectedCompanyId, {
        featureFlags,
        scoringProfile: {
          mode: scoringMode,
          settings: {}
        },
        hierarchyTemplate: parsedHierarchy
      });
      await apiService.updateCompanyFormTemplate(selectedCompanyId, parsedFormTemplate);
      setSuccess('✅ Company configuration saved.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (selectedCompanyId === 'all') {
    return (
      <div className="team-members">
        <div className="section-header">
          <h3>⚙️ Company Configuration</h3>
        </div>
        <p>Please select a specific company from the header dropdown.</p>
      </div>
    );
  }

  const visibleFormCategories = formCategories.filter((c) => categoryMatchesPwaView(c.name, pwaFormView));

  return (
    <div className="team-members company-config-wizard">
      <div className="section-header">
        <h3>⚙️ Company Configuration</h3>
        <div className="header-actions">
          <button onClick={load} className="refresh-button">🔄 Refresh</button>
          <button onClick={handleSave} className="action-button success" disabled={saving || loading}>
            {saving ? 'Saving...' : 'Save configuration'}
          </button>
        </div>
      </div>

      <p className="company-config-intro">
        Choose your company in the header first. Changes here apply <strong>only to that company</strong>. Use the forms
        below—no JSON editing required. Click <strong>Save configuration</strong> when you are done.
      </p>

      {loading ? <div className="loading">Loading configuration...</div> : null}
      {error ? <div className="error-message">{error}</div> : null}
      {success ? <div className="success-message">{success}</div> : null}

      <div className="form-section company-config-card">
        <h4>App behavior</h4>
        <p className="config-hint">These options control how the mobile/web app uses this company&apos;s data. If unsure, leave as-is and ask your administrator.</p>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={featureFlags.enableCompanyCustomization}
            onChange={(e) => setFeatureFlags((prev) => ({ ...prev, enableCompanyCustomization: e.target.checked }))}
          />
          <span>
            <strong>Use this company&apos;s own evaluation setup in the app</strong>
            <span className="config-sub"> (company customization)</span>
          </span>
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={featureFlags.useLegacyEvaluationFlow}
            onChange={(e) => setFeatureFlags((prev) => ({ ...prev, useLegacyEvaluationFlow: e.target.checked }))}
          />
          <span>
            <strong>Use standard evaluation flow</strong>
            <span className="config-sub"> (recommended; turn off only if support asks)</span>
          </span>
        </label>
      </div>

      <div className="form-section company-config-card">
        <h4>Scoring</h4>
        <p className="config-hint">How scores are combined for this company.</p>
        <div className="form-group">
          <label htmlFor="scoring-mode">Scoring style</label>
          <select
            id="scoring-mode"
            value={scoringMode}
            onChange={(e) => setScoringMode(e.target.value as 'legacy_average' | 'weighted_average')}
          >
            <option value="legacy_average">Simple average (recommended)</option>
            <option value="weighted_average">Weighted average</option>
          </select>
        </div>
      </div>

      <div className="form-section company-config-card">
        <h4>Who can evaluate whom</h4>
        <p className="config-hint">
          Each rule means: people with the first role may evaluate people who have one of the checked roles.
        </p>
        {hierarchyRules.map((rule) => (
          <div key={rule.key} className="hierarchy-rule-card">
            <div className="hierarchy-rule-header">
              <label className="form-group compact">
                <span>Evaluator role</span>
                <select
                  value={rule.evaluatorRole}
                  onChange={(e) =>
                    setHierarchyRules((prev) =>
                      prev.map((r) => (r.key === rule.key ? { ...r, evaluatorRole: e.target.value } : r))
                    )
                  }
                >
                  {ROLE_OPTIONS_EVALUATOR.map((role) => (
                    <option key={role} value={role}>{role.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </label>
              <button type="button" className="action-button danger subtle" onClick={() => removeHierarchyRule(rule.key)}>
                Remove rule
              </button>
            </div>
            <fieldset className="target-roles-fieldset">
              <legend>Can evaluate these roles</legend>
              <div className="target-roles-grid">
                {ROLE_OPTIONS_TARGET.map((role) => (
                  <label key={role} className="checkbox-row inline">
                    <input
                      type="checkbox"
                      checked={rule.targetRoles.includes(role)}
                      onChange={() => toggleTargetRole(rule.key, role)}
                    />
                    {role.replace(/_/g, ' ')}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        ))}
        <button type="button" className="action-button" onClick={addHierarchyRule}>
          + Add rule
        </button>
      </div>

      <div className="form-section company-config-card">
        <h4>Evaluation form (categories &amp; items)</h4>
        <div className="config-callout">
          <p>
            <strong>Dev vs production:</strong> This list comes from the <strong>same API your admin uses</strong> (for example
            Docker on localhost). Production PWA uses the production API and database — content often <strong>will not match</strong>{' '}
            until you use the same data source.
          </p>
          <p>
            <strong>One list here, several experiences in the app:</strong> The PWA loads only categories whose <strong>names</strong>{' '}
            match the situation (for Metro: tokens like <code>(SALESPERSON)</code>, <code>(SALES_LEAD)</code>, and optional{' '}
            <code>HIGH_SHARE</code>). Everything still lives in one template; the app filters by role and visit type.
          </p>
        </div>
        <p className="config-hint">
          Edit names and order, or add categories and line items. Use &quot;Seed templates&quot; in the header first if this list is empty.
        </p>
        <div className="preset-toolbar">
          <span className="preset-label">Load real prod baselines:</span>
          <button
            type="button"
            className="action-button"
            onClick={() => applyPreset(PROD_SALESPERSON_STANDARD_PRESET)}
          >
            Salesperson standard
          </button>
          <button
            type="button"
            className="action-button"
            onClick={() => applyPreset(PROD_COACHING_SALES_LEAD_PRESET)}
          >
            RM -&gt; Sales Lead coaching
          </button>
        </div>
        {formCategories.length > 0 ? (
          <div className="form-group pwa-view-picker">
            <label htmlFor="pwa-form-view">Preview like the mobile app (filter only — save still stores the full template)</label>
            <select
              id="pwa-form-view"
              value={pwaFormView}
              onChange={(e) => setPwaFormView(e.target.value as FormTemplatePwaView)}
            >
              <option value="all">All categories (full template in database)</option>
              <option value="sp_standard">Salesperson — standard visit (~categories with SALESPERSON, not high-share)</option>
              <option value="sp_high_share">Salesperson — high-share visit (~HIGH_SHARE in name)</option>
              <option value="sales_lead">Sales lead / coaching (~SALES_LEAD in name)</option>
            </select>
          </div>
        ) : null}
        {formCategories.length === 0 ? (
          <p className="config-empty">No categories yet. Use <strong>Seed templates</strong> in the header, then refresh this page.</p>
        ) : null}
        {formCategories.length > 0 && visibleFormCategories.length === 0 ? (
          <p className="config-empty">
            No categories match this preview. Try <strong>All categories</strong>, or check that names include the expected tokens
            (e.g. <code>(SALESPERSON)</code>).
          </p>
        ) : null}
        {visibleFormCategories.map((cat) => (
          <div key={cat.key} className="form-category-card">
            <div className="form-category-header">
              <input
                type="text"
                className="category-title-input"
                value={cat.name}
                onChange={(e) => updateCategory(cat.key, { name: e.target.value })}
                aria-label="Category name"
              />
              <button type="button" className="action-button danger subtle" onClick={() => removeCategory(cat.key)}>
                Remove category
              </button>
            </div>
            <div className="form-row-3">
              <label className="form-group compact">
                Display order
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={cat.order}
                  onChange={(e) => updateCategory(cat.key, { order: parseInt(e.target.value, 10) || 1 })}
                />
              </label>
              <label className="form-group compact">
                Weight
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={cat.weight}
                  onChange={(e) => updateCategory(cat.key, { weight: parseFloat(e.target.value) || 0 })}
                />
              </label>
            </div>
            <div className="form-items-block">
              <div className="form-items-head">Items in this category</div>
              {cat.items.map((it) => (
                <div key={it.key} className="form-item-row">
                  <input
                    type="text"
                    value={it.name}
                    onChange={(e) => updateItem(cat.key, it.key, { name: e.target.value })}
                    placeholder="Item description"
                    aria-label="Item name"
                  />
                  <label className="sr-only" htmlFor={`ord-${it.key}`}>Order</label>
                  <input
                    id={`ord-${it.key}`}
                    type="number"
                    className="item-order"
                    min={1}
                    title="Order"
                    value={it.order}
                    onChange={(e) => updateItem(cat.key, it.key, { order: parseInt(e.target.value, 10) || 1 })}
                  />
                  <label className="checkbox-row inline tight">
                    <input
                      type="checkbox"
                      checked={it.isActive}
                      onChange={(e) => updateItem(cat.key, it.key, { isActive: e.target.checked })}
                    />
                    Active
                  </label>
                  <button
                    type="button"
                    className="action-button danger subtle"
                    onClick={() => removeItem(cat.key, it.key)}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" className="action-button success subtle" onClick={() => addItem(cat.key)}>
                + Add item to this category
              </button>
            </div>
          </div>
        ))}
        <button type="button" className="action-button success" onClick={addCategory}>
          + Add category
        </button>
      </div>
    </div>
  );
};

const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState('teams');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() => localStorage.getItem('adminCompanyId') || 'all');
  const [openCreateSignal, setOpenCreateSignal] = useState(0);
  const [adminRole, setAdminRole] = useState<string | null>(null);
  const [showCreateCompanyPanel, setShowCreateCompanyPanel] = useState(false);
  const [createCompanyForm, setCreateCompanyForm] = useState({ id: '', name: '', slug: '' });
  const [createCompanyError, setCreateCompanyError] = useState('');
  const [createCompanySaving, setCreateCompanySaving] = useState(false);

  const loadCompanies = async () => {
    try {
      const companiesData = await apiService.getCompanies();
      setCompanies(companiesData || []);
    } catch (err) {
      setCompanies([]);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    window.location.reload();
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  useEffect(() => {
    apiService.setCompanyContext(selectedCompanyId === 'all' ? null : selectedCompanyId);
  }, [selectedCompanyId]);

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const u = await apiService.getCurrentUser();
        setAdminRole(u.role);
      } catch {
        setAdminRole(null);
      }
    })();
  }, []);

  const handleNew = () => {
    if (adminRole === 'SUPER_ADMIN') {
      setCreateCompanyError('');
      setCreateCompanyForm({ id: '', name: '', slug: '' });
      setShowCreateCompanyPanel(true);
      return;
    }
    if (activeTab === 'teams' || activeTab === 'users') {
      setOpenCreateSignal(prev => prev + 1);
    }
  };

  const handleCreateCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = createCompanyForm.id.trim();
    const name = createCompanyForm.name.trim();
    const slug = createCompanyForm.slug.trim();
    if (!id || !name) {
      setCreateCompanyError('Company id and name are required.');
      return;
    }
    setCreateCompanySaving(true);
    setCreateCompanyError('');
    try {
      const created = await apiService.createCompany({
        id,
        name,
        ...(slug ? { slug } : {})
      });
      apiService.setCompanyContext(created.id);
      setSelectedCompanyId(created.id);
      await loadCompanies();
      setShowCreateCompanyPanel(false);
      setActiveTab('configuration');
    } catch (err) {
      setCreateCompanyError((err as Error).message);
    } finally {
      setCreateCompanySaving(false);
    }
  };

  const handleSeedTemplates = async () => {
    if (selectedCompanyId === 'all') {
      alert('Please select a specific company before seeding templates.');
      return;
    }
    try {
      const result = await apiService.seedTemplates(selectedCompanyId);
      const msg = (result && typeof result.message === 'string') ? result.message : '';
      const cats = result?.categories;
      const items = result?.items;
      const counts =
        typeof cats === 'number' && typeof items === 'number'
          ? ` (${cats} categories, ${items} items)`
          : '';
      alert(`✅ ${msg || 'Done.'}${counts}`);
    } catch (error) {
      alert(`❌ Failed to seed templates: ${(error as Error).message}`);
    }
  };

  const pageTitles: Record<string, string> = {
    regions: 'Regions',
    teams: 'Team management',
    users: 'User management',
    configuration: 'Company configuration'
  };

  return (
    <div className="admin-panel">
      <div className="admin-shell">
        <aside className={`admin-sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`} aria-label="Main navigation">
          <div className="sidebar-brand">
            <span className="sidebar-brand-mark" aria-hidden="true">
              SS
            </span>
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-title">Sales Scorecard</span>
              <span className="sidebar-brand-sub">Admin console</span>
            </div>
          </div>
          <nav className="admin-sidebar-nav">
            <button
              type="button"
              className={activeTab === 'regions' ? 'nav-button active' : 'nav-button'}
              onClick={() => {
                setActiveTab('regions');
                closeMobileMenu();
              }}
            >
              Regions
            </button>
            <button
              type="button"
              className={activeTab === 'teams' ? 'nav-button active' : 'nav-button'}
              onClick={() => {
                setActiveTab('teams');
                closeMobileMenu();
              }}
            >
              Team management
            </button>
            <button
              type="button"
              className={activeTab === 'users' ? 'nav-button active' : 'nav-button'}
              onClick={() => {
                setActiveTab('users');
                closeMobileMenu();
              }}
            >
              User management
            </button>
            <button
              type="button"
              className={activeTab === 'configuration' ? 'nav-button active' : 'nav-button'}
              onClick={() => {
                setActiveTab('configuration');
                closeMobileMenu();
              }}
            >
              Company configuration
            </button>
          </nav>
        </aside>

        <div className="admin-main">
          <header className="admin-topbar">
            <div className="topbar-left">
              <button
                type="button"
                className={isMobileMenuOpen ? 'mobile-menu-toggle active' : 'mobile-menu-toggle'}
                onClick={toggleMobileMenu}
                aria-label="Toggle navigation menu"
                aria-expanded={isMobileMenuOpen}
              >
                <span className="hamburger-line" />
                <span className="hamburger-line" />
                <span className="hamburger-line" />
              </button>
              <h1 className="topbar-page-title">{pageTitles[activeTab] ?? 'Admin'}</h1>
            </div>
            <div className="topbar-actions">
              <label className="topbar-company-field">
                <span className="topbar-company-label">Company</span>
                <select
                  className="topbar-company-select"
                  value={selectedCompanyId}
                  onChange={(e) => {
                    const v = e.target.value;
                    apiService.setCompanyContext(v === 'all' ? null : v);
                    setSelectedCompanyId(v);
                  }}
                >
                  <option value="all">All companies</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
                <span className="topbar-company-hint">Switching updates teams and users.</span>
              </label>
              {adminRole === 'SUPER_ADMIN' && showCreateCompanyPanel ? (
                <button
                  type="button"
                  className="action-button action-button--ghost"
                  disabled={createCompanySaving}
                  onClick={() => !createCompanySaving && setShowCreateCompanyPanel(false)}
                >
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  className="action-button action-button--primary"
                  onClick={handleNew}
                  title={
                    adminRole === 'SUPER_ADMIN'
                      ? 'Create a new company'
                      : 'Create team (Team Management) or user (User Management)'
                  }
                >
                  + New
                </button>
              )}
              <button type="button" className="action-button action-button--ghost" onClick={handleSeedTemplates}>
                Seed templates
              </button>
              <button type="button" onClick={handleLogout} className="logout-button">
                Log out
              </button>
            </div>
          </header>

          {adminRole === 'SUPER_ADMIN' && showCreateCompanyPanel ? (
            <section className="create-company-panel" aria-labelledby="create-company-title">
              <h2 id="create-company-title" className="create-company-panel-title">
                Create company
              </h2>
              <form className="create-company-panel-form" onSubmit={handleCreateCompanySubmit}>
                <div className="create-company-panel-fields">
                  <div className="form-group">
                    <label htmlFor="cc-id">Company ID</label>
                    <input
                      id="cc-id"
                      value={createCompanyForm.id}
                      onChange={(e) => setCreateCompanyForm((f) => ({ ...f, id: e.target.value }))}
                      placeholder="e.g. company_demo"
                      autoComplete="off"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="cc-name">Name</label>
                    <input
                      id="cc-name"
                      value={createCompanyForm.name}
                      onChange={(e) => setCreateCompanyForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Demo Industries"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="cc-slug">Slug (optional)</label>
                    <input
                      id="cc-slug"
                      value={createCompanyForm.slug}
                      onChange={(e) => setCreateCompanyForm((f) => ({ ...f, slug: e.target.value }))}
                      placeholder="e.g. demo-industries"
                    />
                  </div>
                </div>
                {createCompanyError ? (
                  <div className="error-message create-company-panel-error">{createCompanyError}</div>
                ) : null}
                <div className="create-company-panel-actions">
                  <button
                    type="button"
                    className="action-button action-button--ghost"
                    disabled={createCompanySaving}
                    onClick={() => setShowCreateCompanyPanel(false)}
                  >
                    Close
                  </button>
                  <button type="submit" className="action-button action-button--primary" disabled={createCompanySaving}>
                    {createCompanySaving ? 'Creating…' : 'Create company'}
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          <main className="admin-content">
            {activeTab === 'regions' && <RegionsManagement selectedCompanyId={selectedCompanyId} />}
            {activeTab === 'teams' && (
              <TeamMembers openCreateSignal={openCreateSignal} selectedCompanyId={selectedCompanyId} />
            )}
            {activeTab === 'users' && (
              <UserManagement openCreateSignal={openCreateSignal} selectedCompanyId={selectedCompanyId} />
            )}
            {activeTab === 'configuration' && <CompanyConfiguration selectedCompanyId={selectedCompanyId} />}
          </main>
        </div>
      </div>

      {isMobileMenuOpen ? (
        <div className="mobile-menu-overlay" onClick={closeMobileMenu} role="presentation" />
      ) : null}
    </div>
  );
};

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    // Check if user is already logged in and has ADMIN role
    const checkAuth = async () => {
      const token = localStorage.getItem('adminToken');
      if (token) {
        try {
          // Verify the user still has ADMIN role
          const currentUser = await apiService.getCurrentUser();
          if (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN') {
            setIsLoggedIn(true);
          } else {
            // User is no longer admin, clear token and show login
            localStorage.removeItem('adminToken');
            setIsLoggedIn(false);
          }
        } catch (error) {
          // Token is invalid or expired, clear it
          localStorage.removeItem('adminToken');
          setIsLoggedIn(false);
        }
      }
      setIsCheckingAuth(false);
    };

    checkAuth();
  }, []);

  const handleLogin = (token: string) => {
    setIsLoggedIn(true);
  };

  // Show loading while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="App">
        <div className="login-container">
          <div className="login-form">
            <h2>🔐 Admin Panel</h2>
            <p>Checking authentication...</p>
          </div>
        </div>
      </div>
    );
  }

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