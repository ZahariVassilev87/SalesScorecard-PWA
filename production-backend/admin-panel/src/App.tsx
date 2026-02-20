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

interface LoginResponse {
  token: string;
  user: User;
}

// API Service
const API_BASE = 'https://api.instorm.io';

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
    
    // SECURITY CHECK: Only ADMIN users can access admin panel
    const userRole = data.user?.role;
    if (userRole !== 'ADMIN') {
      throw new Error('Access denied. Only administrators can access the admin panel.');
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
    const response = await fetch(`${API_BASE}/public-admin/users`, {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }

    return response.json();
  }

  async getTeams(): Promise<Team[]> {
    // Connect to your real API
    const response = await fetch(`${API_BASE}/public-admin/teams`, {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch teams');
    }

    return response.json();
  }

  async removeUserFromTeam(userId: string, teamId: string): Promise<any> {
    // Connect to your real API
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

  async updateUser(userId: string, userData: { displayName?: string; email?: string; role?: string; isActive?: boolean }): Promise<User> {
    const response = await fetch(`${API_BASE}/public-admin/users/${userId}`, {
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
    const response = await fetch(`${API_BASE}/public-admin/users/${userId}/deactivate`, {
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
    const response = await fetch(`${API_BASE}/public-admin/users/${userId}`, {
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
    const response = await fetch(`${API_BASE}/public-admin/teams`, {
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
    const response = await fetch(`${API_BASE}/public-admin/teams/${teamId}/manager`, {
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
    const response = await fetch(`${API_BASE}/public-admin/teams/${teamId}`, {
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
    const response = await fetch(`${API_BASE}/public-admin/teams/${teamId}`, {
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
    const response = await fetch(`${API_BASE}/public-admin/regions`, {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch regions: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async assignUserToTeam(userId: string, teamId: string): Promise<any> {
    const response = await fetch(`${API_BASE}/public-admin/assign-user-to-team`, {
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
    const response = await fetch(`${API_BASE}/public-admin/users`, {
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

const TeamMembers: React.FC = () => {
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

const UserManagement: React.FC = () => {
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
          return user.role === 'ADMIN';
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
          👑 Admins ({users.filter(u => u.role === 'ADMIN').length})
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

const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState('teams');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  return (
    <div className="admin-panel">
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
          <h1>🎯 Sales Scorecard Admin</h1>
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

      {/* Mobile menu overlay */}
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
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    // Check if user is already logged in and has ADMIN role
    const checkAuth = async () => {
      const token = localStorage.getItem('adminToken');
      if (token) {
        try {
          // Verify the user still has ADMIN role
          const currentUser = await apiService.getCurrentUser();
          if (currentUser.role === 'ADMIN') {
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