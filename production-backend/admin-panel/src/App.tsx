import React, { useState, useEffect, useRef, useMemo } from 'react';
import './App.css';
import EvaluationStructureM3 from './EvaluationStructureM3';

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
    name: 'Preparation Before the Meeting (SALESPERSON)',
    order: 1,
    weight: 0.25,
    items: [
      { id: crypto.randomUUID(), name: 'Preparation item 1', order: 1, weight: 1, isActive: true },
      { id: crypto.randomUUID(), name: 'Preparation item 2', order: 2, weight: 1, isActive: true },
      { id: crypto.randomUUID(), name: 'Preparation item 3', order: 3, weight: 1, isActive: true }
    ]
  },
  {
    id: crypto.randomUUID(),
    name: 'Problem Definition (SALESPERSON)',
    order: 2,
    weight: 0.25,
    items: [
      { id: crypto.randomUUID(), name: 'Problem definition item 1', order: 1, weight: 1, isActive: true },
      { id: crypto.randomUUID(), name: 'Problem definition item 2', order: 2, weight: 1, isActive: true },
      { id: crypto.randomUUID(), name: 'Problem definition item 3', order: 3, weight: 1, isActive: true }
    ]
  },
  {
    id: crypto.randomUUID(),
    name: 'Handling Objections (SALESPERSON)',
    order: 3,
    weight: 0.25,
    items: [
      { id: crypto.randomUUID(), name: 'Objection handling item 1', order: 1, weight: 1, isActive: true },
      { id: crypto.randomUUID(), name: 'Objection handling item 2', order: 2, weight: 1, isActive: true },
      { id: crypto.randomUUID(), name: 'Objection handling item 3', order: 3, weight: 1, isActive: true }
    ]
  },
  {
    id: crypto.randomUUID(),
    name: 'Commercial Proposal (SALESPERSON)',
    order: 4,
    weight: 0.25,
    items: [
      { id: crypto.randomUUID(), name: 'Commercial proposal item 1', order: 1, weight: 1, isActive: true },
      { id: crypto.randomUUID(), name: 'Commercial proposal item 2', order: 2, weight: 1, isActive: true },
      { id: crypto.randomUUID(), name: 'Commercial proposal item 3', order: 3, weight: 1, isActive: true }
    ]
  }
];

const PROD_COACHING_SALES_LEAD_PRESET: CompanyFormTemplatePayload['categories'] = [
  {
    id: crypto.randomUUID(),
    name: 'BEHAVIOR DURING CLIENT MEETING',
    order: 1,
    weight: 1 / 3,
    items: [
      { id: crypto.randomUUID(), name: 'Allowed the salesperson to lead the conversation', order: 1, weight: 1, isActive: true },
      { id: crypto.randomUUID(), name: 'Intervened only when necessary (business-critical situations)', order: 2, weight: 1, isActive: true }
    ]
  },
  {
    id: crypto.randomUUID(),
    name: 'Quality of Analysis & Feedback',
    order: 2,
    weight: 1 / 3,
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
    order: 3,
    weight: 1 / 3,
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
    // Product rule: high-share and low-mid share use the same category set.
    return u.includes('SALESPERSON');
  }
  if (view === 'sp_standard') {
    // Product rule: high-share and low-mid share use the same category set.
    return u.includes('SALESPERSON');
  }
  return true;
}

interface LoginResponse {
  token: string;
  user: User;
}

/**
 * API base URL for fetch():
 * - `npm start` (CRA, e.g. :3002): default to http://localhost:3001 so requests go straight to the
 *   Node API. Relying on webpack proxy alone breaks login and many /public-admin/* routes.
 * - Production build: '' → root-relative URLs on the same origin as the admin (Express).
 * - Override anytime: REACT_APP_ADMIN_API_BASE_URL (e.g. remote API while developing).
 */
function getApiBase(): string {
  const fromEnv = (process.env.REACT_APP_ADMIN_API_BASE_URL || process.env.REACT_APP_API_BASE_URL || '').trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3001';
  }
  return '';
}

const API_BASE = getApiBase();

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


  async createRegion(region: { id: string; name: string }): Promise<Region> {
    const response = await fetch(this.withCompany('/public-admin/regions'), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(region)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create region: ${response.status} ${errorText}`);
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

  async getEvaluationStructureConfig(companyId: string): Promise<any> {
    const response = await fetch(
      `${API_BASE}/public-admin/companies/${encodeURIComponent(companyId)}/evaluation-structure-config`,
      { headers: this.getHeaders() }
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to load evaluation structure config: ${response.status} ${errorText}`);
    }
    return response.json();
  }

  async getEvaluationStructurePreview(companyId: string): Promise<any> {
    const response = await fetch(
      `${API_BASE}/public-admin/companies/${encodeURIComponent(companyId)}/evaluation-structure/preview`,
      { headers: this.getHeaders() }
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to load evaluation structure preview: ${response.status} ${errorText}`);
    }
    return response.json();
  }

  async getEvaluationStructureHistory(companyId: string, limit = 20, offset = 0): Promise<any> {
    const response = await fetch(
      `${API_BASE}/public-admin/companies/${encodeURIComponent(companyId)}/evaluation-structure/history?limit=${encodeURIComponent(String(limit))}&offset=${encodeURIComponent(String(offset))}`,
      { headers: this.getHeaders() }
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to load evaluation structure history: ${response.status} ${errorText}`);
    }
    return response.json();
  }

  async getEvaluationStructureDraft(companyId: string): Promise<any> {
    const response = await fetch(
      `${API_BASE}/public-admin/companies/${encodeURIComponent(companyId)}/evaluation-structure/draft`,
      { headers: this.getHeaders() }
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to load evaluation structure draft: ${response.status} ${errorText}`);
    }
    return response.json();
  }

  async saveEvaluationStructureDraft(companyId: string, evaluationStructure: any): Promise<any> {
    const response = await fetch(
      `${API_BASE}/public-admin/companies/${encodeURIComponent(companyId)}/evaluation-structure/draft`,
      {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ evaluationStructure }),
      }
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to save evaluation structure draft: ${response.status} ${errorText}`);
    }
    return response.json();
  }

  async cloneEvaluationStructureToDraft(companyId: string, sourceCompanyId: string): Promise<any> {
    const response = await fetch(
      `${API_BASE}/public-admin/companies/${encodeURIComponent(companyId)}/evaluation-structure/clone-from`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ sourceCompanyId }),
      }
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to clone structure to draft: ${response.status} ${errorText}`);
    }
    return response.json();
  }

  async rollbackEvaluationStructureToDraft(companyId: string, sourceVersionId: string): Promise<any> {
    const response = await fetch(
      `${API_BASE}/public-admin/companies/${encodeURIComponent(companyId)}/evaluation-structure/rollback-to-draft`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ sourceVersionId }),
      }
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to rollback structure to draft: ${response.status} ${errorText}`);
    }
    return response.json();
  }

  async batchCloneEvaluationStructureToDraft(sourceCompanyId: string, targetCompanyIds: string[]): Promise<any> {
    const response = await fetch(`${API_BASE}/public-admin/evaluation-structure/batch-clone-to-draft`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ sourceCompanyId, targetCompanyIds }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to batch clone structure to drafts: ${response.status} ${errorText}`);
    }
    return response.json();
  }

  async publishEvaluationStructure(
    companyId: string,
    evaluationStructure: object,
    confirmReplace = false
  ): Promise<any> {
    const response = await fetch(
      `${API_BASE}/public-admin/companies/${encodeURIComponent(companyId)}/evaluation-structure/publish`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ evaluationStructure, confirmReplace }),
      }
    );
    const textBody = await response.text();
    let body: any = null;
    try {
      body = textBody ? JSON.parse(textBody) : null;
    } catch {
      body = { error: textBody || 'Unknown error' };
    }
    if (!response.ok) {
      throw new Error(`Failed to publish evaluation structure: ${response.status} ${textBody || 'Unknown error'}`);
    }
    return body;
  }

  async getBehaviorItemsForStructureEditor(companyId: string): Promise<Array<{ id: string; label: string }>> {
    const map = new Map<string, string>();
    const addFromCategoriesPayload = (payload: any) => {
      const cats = Array.isArray(payload?.categories) ? payload.categories : Array.isArray(payload) ? payload : [];
      for (const c of cats) {
        const items = Array.isArray(c.items) ? c.items : [];
        for (const it of items) {
          if (it?.id) {
            map.set(String(it.id), `${c.name || 'Category'} — ${it.name || it.id}`);
          }
        }
      }
    };
    const fetchMeta = async (suffix: string) => {
      const response = await fetch(this.withCompany(`/scoring/categories?meta=1${suffix}`), {
        headers: this.getHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        addFromCategoriesPayload(data);
      }
    };
    await fetchMeta('');
    await fetchMeta('&customerType=high-share');
    try {
      const tmpl = await this.getCompanyFormTemplate(companyId);
      for (const c of tmpl.categories || []) {
        for (const it of c.items || []) {
          if (it.id && !map.has(it.id)) {
            map.set(String(it.id), `${c.name || 'Category'} — ${it.name || it.id}`);
          }
        }
      }
    } catch {
      /* supplement */
    }
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
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
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        msg.includes('Failed to fetch') || msg.includes('NetworkError')
          ? 'Cannot reach the API. Start the backend on port 3001 (e.g. docker compose backend) and keep the admin on port 3002.'
          : msg
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <h2>Sign in</h2>
        <p className="login-subtitle">Sales Scorecard admin</p>
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

type AdminSearchHit =
  | { kind: 'user'; id: string; title: string; subtitle: string }
  | { kind: 'team'; id: string; title: string; subtitle: string }
  | { kind: 'region'; id: string; title: string; subtitle: string }
  | { kind: 'company'; id: string; title: string; subtitle: string };

const AdminGlobalSearch: React.FC<{
  selectedCompanyId: string;
  onSelectHit: (hit: AdminSearchHit) => void;
}> = ({ selectedCompanyId, onSelectHit }) => {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [activeHitIndex, setActiveHitIndex] = useState(0);
  const [index, setIndex] = useState<{
    users: User[];
    teams: Team[];
    regions: Region[];
    companies: Company[];
  } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hitRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const loadIndex = async () => {
    try {
      const [users, teams, regions, companies] = await Promise.all([
        apiService.getUsers(),
        apiService.getTeams(),
        apiService.getRegions(),
        apiService.getCompanies().catch(() => [] as Company[])
      ]);
      setIndex({ users, teams, regions, companies: Array.isArray(companies) ? companies : [] });
    } catch {
      setIndex({ users: [], teams: [], regions: [], companies: [] });
    }
  };

  useEffect(() => {
    loadIndex();
  }, [selectedCompanyId]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        wrapRef.current?.querySelector('input')?.focus();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const hits = useMemo(() => {
    if (!index || !q.trim()) return [] as AdminSearchHit[];
    const s = q.trim().toLowerCase();
    const out: AdminSearchHit[] = [];
    const push = (h: AdminSearchHit) => {
      if (out.length >= 24) return;
      out.push(h);
    };
    index.users.forEach((u) => {
      const t = `${u.displayName} ${u.email} ${u.role}`.toLowerCase();
      if (t.includes(s)) push({ kind: 'user', id: u.id, title: u.displayName, subtitle: u.email });
    });
    index.teams.forEach((t) => {
      const x = `${t.name} ${t.region?.name || ''}`.toLowerCase();
      if (x.includes(s)) push({ kind: 'team', id: t.id, title: t.name, subtitle: t.region?.name || 'Team' });
    });
    index.regions.forEach((r) => {
      if (`${r.name} ${r.id}`.toLowerCase().includes(s)) {
        push({ kind: 'region', id: r.id, title: r.name, subtitle: 'Region' });
      }
    });
    index.companies.forEach((c) => {
      if (`${c.name} ${c.id}`.toLowerCase().includes(s)) {
        push({ kind: 'company', id: c.id, title: c.name, subtitle: 'Company' });
      }
    });
    return out;
  }, [index, q]);

  useEffect(() => {
    setActiveHitIndex(0);
  }, [hits.length, q]);

  useEffect(() => {
    const el = hitRefs.current[activeHitIndex];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [activeHitIndex]);

  const applyHit = (hit: AdminSearchHit) => {
    onSelectHit(hit);
    setOpen(false);
    setQ('');
    setActiveHitIndex(0);
  };

  return (
    <div className="admin-global-search" ref={wrapRef}>
      <input
        type="search"
        className="admin-global-search-input"
        placeholder="Search users, teams, regions, companies…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || !q.trim()) return;
          if (hits.length === 0) {
            if (e.key === 'Escape') {
              e.preventDefault();
              setOpen(false);
            }
            return;
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveHitIndex((i) => Math.min(i + 1, hits.length - 1));
            return;
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveHitIndex((i) => Math.max(i - 1, 0));
            return;
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            const hit = hits[activeHitIndex];
            if (hit) applyHit(hit);
            return;
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            setOpen(false);
          }
        }}
        aria-label="Search"
        aria-autocomplete="list"
        aria-controls="admin-global-search-listbox"
        aria-activedescendant={
          open && q.trim() && hits.length > 0 ? `admin-search-hit-${activeHitIndex}` : undefined
        }
        autoComplete="off"
        id="admin-global-search-input"
      />
      <span className="admin-global-search-hint" title="Shortcut">
        ⌘K
      </span>
      {open && q.trim() && hits.length > 0 ? (
        <div
          className="admin-global-search-results"
          id="admin-global-search-listbox"
          role="listbox"
          aria-label="Search results"
        >
          {hits.map((h, idx) => (
            <button
              key={`${h.kind}-${h.id}`}
              ref={(el) => {
                hitRefs.current[idx] = el;
              }}
              id={`admin-search-hit-${idx}`}
              type="button"
              className={`admin-global-search-hit ${idx === activeHitIndex ? 'admin-global-search-hit--active' : ''}`}
              role="option"
              aria-selected={idx === activeHitIndex}
              onMouseEnter={() => setActiveHitIndex(idx)}
              onClick={() => applyHit(h)}
            >
              <span className="admin-global-search-hit-kind">{h.kind}</span>
              <span className="admin-global-search-hit-text">
                <span className="admin-global-search-hit-title">{h.title}</span>
                <span className="admin-global-search-hit-sub">{h.subtitle}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {open && q.trim() && hits.length === 0 && index ? (
        <div className="admin-global-search-empty" role="status">
          No matches
        </div>
      ) : null}
    </div>
  );
};

const AdminOverview: React.FC<{
  selectedCompanyId: string;
  companies: Company[];
  adminRole: string | null;
  onGo: (tab: 'regions' | 'teams' | 'users' | 'configuration' | 'evaluation-structure') => void;
  onSeed: () => void;
}> = ({ selectedCompanyId, companies, adminRole, onGo, onSeed }) => {
  const [stats, setStats] = useState<{ users: number; teams: number; regions: number; companies: number } | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [users, teams, regions, comps] = await Promise.all([
          apiService.getUsers(),
          apiService.getTeams(),
          apiService.getRegions(),
          apiService.getCompanies().catch(() => [] as Company[])
        ]);
        if (!cancelled) {
          setStats({
            users: users.length,
            teams: teams.length,
            regions: regions.length,
            companies: Array.isArray(comps) ? comps.length : 0
          });
        }
      } catch {
        if (!cancelled) setStats({ users: 0, teams: 0, regions: 0, companies: 0 });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCompanyId]);

  const companyLabel =
    selectedCompanyId === 'all'
      ? 'All companies'
      : companies.find((c) => c.id === selectedCompanyId)?.name ?? selectedCompanyId;

  return (
    <div className="admin-overview">
      <div className="admin-overview-hero">
        <p className="admin-overview-kicker">Current scope</p>
        <h2 className="admin-overview-title">{companyLabel}</h2>
        <p className="admin-overview-lede">
          Jump to a section below or use the search bar ({' '}
          <kbd className="admin-kbd">⌘</kbd>
          <kbd className="admin-kbd">K</kbd>) to open users, teams, or regions in one step.
        </p>
      </div>

      {loading || !stats ? (
        <div className="admin-overview-loading">Loading summary…</div>
      ) : (
        <div className="admin-overview-stats">
          <button type="button" className="admin-stat-card" onClick={() => onGo('users')}>
            <span className="admin-stat-value">{stats.users}</span>
            <span className="admin-stat-label">Users</span>
          </button>
          <button type="button" className="admin-stat-card" onClick={() => onGo('teams')}>
            <span className="admin-stat-value">{stats.teams}</span>
            <span className="admin-stat-label">Teams</span>
          </button>
          <button type="button" className="admin-stat-card" onClick={() => onGo('regions')}>
            <span className="admin-stat-value">{stats.regions}</span>
            <span className="admin-stat-label">Regions</span>
          </button>
          {adminRole === 'SUPER_ADMIN' ? (
            <div className="admin-stat-card admin-stat-card--static">
              <span className="admin-stat-value">{stats.companies}</span>
              <span className="admin-stat-label">Companies (tenant)</span>
            </div>
          ) : null}
        </div>
      )}

      <div className="admin-overview-actions">
        <button type="button" className="admin-quick-link" onClick={() => onGo('users')}>
          Manage users
        </button>
        <button type="button" className="admin-quick-link" onClick={() => onGo('teams')}>
          Manage teams
        </button>
        <button type="button" className="admin-quick-link" onClick={() => onGo('regions')}>
          Manage regions
        </button>
        <button type="button" className="admin-quick-link admin-quick-link--primary" onClick={() => onGo('configuration')}>
          Company configuration
        </button>
      </div>

      {selectedCompanyId !== 'all' && adminRole === 'SUPER_ADMIN' ? (
        <div className="admin-overview-panel">
          <div>
            <h3 className="admin-overview-panel-title">Templates</h3>
            <p className="admin-overview-panel-text">
              Seed default evaluation categories and items for <strong>{companyLabel}</strong> when the database is empty or you need a reset.
            </p>
          </div>
          <button type="button" className="action-button action-button--ghost" onClick={onSeed}>
            Seed templates
          </button>
        </div>
      ) : selectedCompanyId === 'all' ? (
        <div className="admin-overview-hint">
          Select a <strong>company</strong> in the header to edit company-specific configuration.
        </div>
      ) : (
        <div className="admin-overview-hint">
          Company admins can edit configuration below. <strong>Seed templates</strong> is available to super administrators.
        </div>
      )}
    </div>
  );
};

const TeamMembers: React.FC<{
  openCreateSignal?: number;
  selectedCompanyId: string;
  highlightTeamId?: string | null;
}> = ({
  openCreateSignal = 0,
  selectedCompanyId,
  highlightTeamId = null
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
      alert('Team created successfully!');
      setCreateForm({ name: '', region: '', managerId: '' });
      setShowCreateForm(false);
      loadTeams();
    } catch (err) {
      alert('Failed to create team: ' + (err as Error).message);
    }
  };

  const handleEditTeam = async () => {
    if (!editingTeam || !editForm.name || !editForm.region) {
      alert('Please fill in all fields');
      return;
    }

    try {
      await apiService.updateTeam(editingTeam.id, editForm);
      alert('Team updated successfully!');
      setEditingTeam(null);
      setEditForm({ name: '', region: '', managerId: '' });
      loadTeams();
    } catch (err) {
      alert('Failed to update team: ' + (err as Error).message);
    }
  };

  const handleSetTeamManager = async (teamId: string) => {
    if (!setManagerForm.managerId) {
      alert('Please select a manager');
      return;
    }

    try {
      await apiService.updateTeamManager(teamId, setManagerForm.managerId);
      alert('Team manager updated successfully!');
      setShowSetManagerForm(null);
      setSetManagerForm({ managerId: '' });
      loadTeams();
    } catch (err) {
      alert('Failed to update team manager: ' + (err as Error).message);
    }
  };

  const handleDeleteTeam = async (team: Team) => {
    if (!window.confirm(`Are you sure you want to delete team "${team.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await apiService.deleteTeam(team.id);
      alert('Team deleted successfully!');
      loadTeams();
    } catch (err) {
      alert('Failed to delete team: ' + (err as Error).message);
    }
  };

  const handleAddMember = async (teamId: string) => {
    if (!addMemberForm.userId) {
      alert('Please select a user to add');
      return;
    }

    try {
      await apiService.assignUserToTeam(addMemberForm.userId, teamId);
      alert('User added to team successfully!');
      setAddMemberForm({ userId: '' });
      setShowAddMemberForm(null);
      loadTeams();
    } catch (err) {
      alert('Failed to add user to team: ' + (err as Error).message);
    }
  };

  const handleRemoveUser = async (userId: string, teamId: string, userName: string, teamName: string) => {
    if (!window.confirm(`Are you sure you want to remove ${userName} from team "${teamName}"?`)) {
      return;
    }

    try {
      await apiService.removeUserFromTeam(userId, teamId);
      alert('User removed successfully!');
      loadTeams();
    } catch (err) {
      alert('Failed to remove user: ' + (err as Error).message);
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

  useEffect(() => {
    if (!highlightTeamId || teams.length === 0) return undefined;
    const t = window.setTimeout(() => {
      const el = document.querySelector(`[data-admin-team-id="${highlightTeamId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('admin-flash-highlight');
        window.setTimeout(() => el.classList.remove('admin-flash-highlight'), 2200);
      }
    }, 120);
    return () => window.clearTimeout(t);
  }, [highlightTeamId, teams]);

  if (loading) {
    return <div className="loading">Loading team data...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="team-members">
      <div className="section-header">
        <h3>Team Management</h3>
        <div className="header-actions">
          <div className="view-mode-toggle">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`view-toggle ${viewMode === 'list' ? 'active' : ''}`}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setViewMode('hierarchy')}
              className={`view-toggle ${viewMode === 'hierarchy' ? 'active' : ''}`}
            >
              Hierarchy
            </button>
          </div>
          <button type="button" onClick={() => setShowCreateForm(true)} className="action-button action-button--primary">
            Create Team
          </button>
          <button type="button" onClick={loadTeams} className="action-button action-button--ghost">
            Refresh
          </button>
        </div>
      </div>

      {/* Sub-tabs for team filtering */}
      <div className="sub-tabs">
        <button
          type="button"
          className={`sub-tab ${activeSubTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('all')}
        >
          All Teams ({teams.length})
        </button>
        <button
          type="button"
          className={`sub-tab ${activeSubTab === 'sales-director' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('sales-director')}
        >
          Sales Director ({teams.filter((t) => t.manager?.role === 'SALES_DIRECTOR').length})
        </button>
        <button
          type="button"
          className={`sub-tab ${activeSubTab === 'regional-manager' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('regional-manager')}
        >
          Regional Manager ({teams.filter((t) => t.manager?.role === 'REGIONAL_SALES_MANAGER').length})
        </button>
        <button
          type="button"
          className={`sub-tab ${activeSubTab === 'sales-lead' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('sales-lead')}
        >
          Sales Lead ({teams.filter((t) => t.manager?.role === 'SALES_LEAD').length})
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
            <button type="button" onClick={handleCreateTeam} className="action-button action-button--primary">
              Create Team
            </button>
            <button type="button" onClick={() => setShowCreateForm(false)} className="action-button action-button--ghost">
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
                <h4 className="team-hierarchy-title">{team.name}</h4>
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
            <div key={team.id} className="team-section" data-admin-team-id={team.id}>
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
                  <button type="button" onClick={handleEditTeam} className="action-button action-button--primary">
                    Save
                  </button>
                  <button type="button" onClick={cancelEdit} className="action-button action-button--ghost">
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="team-info">
                  <h4 className="team-card-title">
                    <span className="team-card-title-text">{team.name}</span>
                    <span className="team-card-title-meta">
                      {team.region?.name || 'No region'} · <code className="team-id-code">{team.id}</code>
                    </span>
                  </h4>
                  <p className="team-manager">
                    Manager:{' '}
                    {team.manager
                      ? `${team.manager.displayName} (${team.manager.role})`
                      : 'No manager assigned'}
                  </p>
                  <div className="team-actions">
                    <button
                      type="button"
                      onClick={() => startEditTeam(team)}
                      className="action-button action-button--edit action-button--compact"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSetManagerForm(team.id)}
                      className="action-button action-button--neutral action-button--compact"
                    >
                      Set manager
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTeam(team)}
                      className="action-button action-button--delete-subtle action-button--compact"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddMemberForm(team.id)}
                      className="action-button action-button--primary action-button--compact"
                    >
                      Add member
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
                <button type="button" onClick={() => handleAddMember(team.id)} className="action-button action-button--primary">
                  Add
                </button>
                <button type="button" onClick={() => setShowAddMemberForm(null)} className="action-button action-button--ghost">
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
                <button type="button" onClick={() => handleSetTeamManager(team.id)} className="action-button action-button--primary">
                  Set manager
                </button>
                <button type="button" onClick={() => setShowSetManagerForm(null)} className="action-button action-button--ghost">
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
                      {userTeam.user.displayName} ({userTeam.user.email}) — {userTeam.user.role}
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

const UserManagement: React.FC<{
  openCreateSignal?: number;
  selectedCompanyId: string;
  highlightUserId?: string | null;
}> = ({
  openCreateSignal = 0,
  selectedCompanyId,
  highlightUserId = null
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
      alert('User updated successfully!');
      setEditingUser(null);
      loadUsers(); // Refresh the list
    } catch (err) {
      alert('Failed to update user: ' + (err as Error).message);
    }
  };

  const handleDeactivateUser = async (user: User) => {
    if (!window.confirm(`Are you sure you want to ${user.isActive ? 'deactivate' : 'activate'} ${user.displayName}?`)) {
      return;
    }

    try {
      if (user.isActive) {
        await apiService.deactivateUser(user.id);
        alert('User deactivated successfully!');
      } else {
        await apiService.updateUser(user.id, { isActive: true });
        alert('User activated successfully!');
      }
      loadUsers(); // Refresh the list
    } catch (err) {
      alert('Failed to update user status: ' + (err as Error).message);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!window.confirm(`⚠️ Are you sure you want to PERMANENTLY DELETE user "${user.displayName}" (${user.email})? This action cannot be undone!`)) {
      return;
    }

    try {
      await apiService.deleteUser(user.id);
      alert('User deleted successfully!');
      loadUsers(); // Refresh the list
    } catch (err) {
      alert('Failed to delete user: ' + (err as Error).message);
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
      alert('User created successfully!');
      setCreateForm({ displayName: '', email: '', password: '', role: '' });
      setShowCreateForm(false);
      loadUsers(); // Refresh the list
    } catch (err) {
      alert('Failed to create user: ' + (err as Error).message);
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

  useEffect(() => {
    if (highlightUserId) {
      setActiveUserSubTab('all');
    }
  }, [highlightUserId]);

  useEffect(() => {
    if (!highlightUserId || users.length === 0) return undefined;
    const t = window.setTimeout(() => {
      const el = document.querySelector(`[data-admin-user-id="${highlightUserId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('admin-flash-highlight');
        window.setTimeout(() => el.classList.remove('admin-flash-highlight'), 2200);
      }
    }, 120);
    return () => window.clearTimeout(t);
  }, [highlightUserId, users]);

  if (loading) {
    return <div className="loading">Loading users...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="user-management">
      <div className="section-header">
        <h3>User Management</h3>
        <div className="header-actions">
          <button type="button" onClick={() => setShowCreateForm(true)} className="action-button action-button--primary">
            Create User
          </button>
          <button type="button" onClick={loadUsers} className="action-button action-button--ghost">
            Refresh
          </button>
        </div>
      </div>

      {/* Sub-tabs for user filtering */}
      <div className="sub-tabs">
        <button
          type="button"
          className={`sub-tab ${activeUserSubTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveUserSubTab('all')}
        >
          All Users ({users.length})
        </button>
        <button
          type="button"
          className={`sub-tab ${activeUserSubTab === 'admin' ? 'active' : ''}`}
          onClick={() => setActiveUserSubTab('admin')}
        >
          Admins ({users.filter((u) => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN').length})
        </button>
        <button
          type="button"
          className={`sub-tab ${activeUserSubTab === 'sales-director' ? 'active' : ''}`}
          onClick={() => setActiveUserSubTab('sales-director')}
        >
          Sales Directors ({users.filter((u) => u.role === 'SALES_DIRECTOR').length})
        </button>
        <button
          type="button"
          className={`sub-tab ${activeUserSubTab === 'regional-manager' ? 'active' : ''}`}
          onClick={() => setActiveUserSubTab('regional-manager')}
        >
          Regional Managers ({users.filter((u) => u.role === 'REGIONAL_SALES_MANAGER').length})
        </button>
        <button
          type="button"
          className={`sub-tab ${activeUserSubTab === 'sales-lead' ? 'active' : ''}`}
          onClick={() => setActiveUserSubTab('sales-lead')}
        >
          Sales Leads ({users.filter((u) => u.role === 'SALES_LEAD').length})
        </button>
        <button
          type="button"
          className={`sub-tab ${activeUserSubTab === 'salesperson' ? 'active' : ''}`}
          onClick={() => setActiveUserSubTab('salesperson')}
        >
          Salespeople ({users.filter((u) => u.role === 'SALESPERSON').length})
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
            <button type="button" onClick={handleCreateUser} className="action-button action-button--primary">
              Create User
            </button>
            <button type="button" onClick={handleCancelCreate} className="action-button action-button--ghost">
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
                  <tr key={user.id} data-admin-user-id={user.id}>
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
                        <div className="table-actions">
                          <button type="button" className="action-button action-button--primary action-button--compact" onClick={handleSaveEdit}>
                            Save
                          </button>
                          <button type="button" className="action-button action-button--ghost action-button--compact" onClick={handleCancelEdit}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="table-actions">
                          <button
                            type="button"
                            className="action-button action-button--edit action-button--compact"
                            onClick={() => handleEditUser(user)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="action-button action-button--neutral action-button--compact"
                            onClick={() => handleDeactivateUser(user)}
                          >
                            {user.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            className="action-button action-button--delete-subtle action-button--compact"
                            onClick={() => handleDeleteUser(user)}
                          >
                            Delete
                          </button>
                        </div>
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
              <div key={user.id} className="user-card" data-admin-user-id={user.id}>
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
                      <button type="button" className="action-button action-button--primary" onClick={handleSaveEdit}>
                        Save
                      </button>
                      <button type="button" className="action-button action-button--ghost" onClick={handleCancelEdit}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="action-button action-button--edit"
                        onClick={() => handleEditUser(user)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="action-button action-button--neutral"
                        onClick={() => handleDeactivateUser(user)}
                      >
                        {user.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        className="action-button action-button--delete-subtle"
                        onClick={() => handleDeleteUser(user)}
                      >
                        Delete
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

const RegionsManagement: React.FC<{
  selectedCompanyId: string;
  highlightRegionId?: string | null;
}> = ({ selectedCompanyId, highlightRegionId = null }) => {
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [newRegion, setNewRegion] = useState({ id: '', name: '' });

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

  useEffect(() => {
    if (!highlightRegionId || regions.length === 0) return undefined;
    const t = window.setTimeout(() => {
      const el = document.querySelector(`[data-admin-region-id="${highlightRegionId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('admin-flash-highlight');
        window.setTimeout(() => el.classList.remove('admin-flash-highlight'), 2200);
      }
    }, 120);
    return () => window.clearTimeout(t);
  }, [highlightRegionId, regions]);

  if (error) {
    return (
      <div className="user-management">
        <div className="section-header">
          <h3>Regions</h3>
        </div>
        <div className="error-message">{error}</div>
      </div>
    );
  }

  const handleCreateRegion = async () => {
    const id = newRegion.id.trim();
    const name = newRegion.name.trim();
    if (!id || !name) {
      alert('Region ID and name are required');
      return;
    }

    setCreating(true);
    try {
      await apiService.createRegion({ id, name });
      setNewRegion({ id: '', name: '' });
      await loadRegions();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="user-management">
      <div className="section-header">
        <h3>Regions</h3>
        <div className="header-actions">
          <input
            type="text"
            placeholder="Region ID"
            value={newRegion.id}
            onChange={(e) => setNewRegion((prev) => ({ ...prev, id: e.target.value }))}
            style={{ minWidth: 140 }}
          />
          <input
            type="text"
            placeholder="Region name"
            value={newRegion.name}
            onChange={(e) => setNewRegion((prev) => ({ ...prev, name: e.target.value }))}
            style={{ minWidth: 180 }}
          />
          <button type="button" onClick={handleCreateRegion} className="action-button action-button--primary" disabled={creating}>
            {creating ? 'Creating…' : '+ Create Region'}
          </button>
          <button type="button" onClick={loadRegions} className="action-button action-button--ghost" disabled={loading}>
            Refresh
          </button>
        </div>
      </div>
      {loading ? (
        <div className="admin-loading-surface" aria-busy="true" aria-label="Loading regions">
          <div className="admin-skeleton admin-skeleton--title" />
          <div className="admin-skeleton-rows">
            <div className="admin-skeleton admin-skeleton--row" />
            <div className="admin-skeleton admin-skeleton--row" />
            <div className="admin-skeleton admin-skeleton--row" />
          </div>
          <span className="sr-only">Loading regions…</span>
        </div>
      ) : regions.length === 0 ? (
        <div className="admin-empty-state">
          <p className="admin-empty-state-title">No regions yet</p>
          <p className="admin-empty-state-text">Regions appear here once they are created for your organization.</p>
        </div>
      ) : (
        <>
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
                  <tr key={region.id} data-admin-region-id={region.id}>
                    <td>{region.name}</td>
                    <td>
                      <code className="admin-inline-code">{region.id}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="regions-cards mobile-only">
            {regions.map((region) => (
              <div key={region.id} className="region-card" data-admin-region-id={region.id}>
                <div className="region-card-name">{region.name}</div>
                <div className="region-card-meta">
                  <span className="region-card-label">ID</span>
                  <code className="admin-inline-code">{region.id}</code>
                </div>
              </div>
            ))}
          </div>
        </>
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

  const loadMetroBaseline = async (mode: 'salesperson' | 'sales_lead') => {
    if (!window.confirm('Load baseline from Metro template and replace current category list? You can still edit before saving.')) {
      return;
    }
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      const metroTemplate = await apiService.getCompanyFormTemplate('company_metro');
      const sourceCategories: CompanyFormTemplatePayload['categories'] = Array.isArray(metroTemplate?.categories)
        ? metroTemplate.categories
        : [];

      const salespersonTokens = [
        'PREPARATION BEFORE THE MEETING',
        'PROBLEM DEFINITION',
        'HANDLING OBJECTIONS',
        'COMMERCIAL PROPOSAL',
      ];
      const salesLeadTokens = [
        'BEHAVIOR DURING CLIENT MEETING',
        'QUALITY OF ANALYSIS',
        'TRANSLATING INTO ACTION',
      ];

      const tokens = mode === 'salesperson' ? salespersonTokens : salesLeadTokens;
      const filtered = sourceCategories.filter((c) => {
        const n = String(c?.name || '').toUpperCase();
        return tokens.some((t) => n.includes(t));
      });

      if (filtered.length === 0) {
        throw new Error(
          mode === 'salesperson'
            ? 'Metro baseline does not contain the expected salesperson categories.'
            : 'Metro baseline does not contain the expected sales lead categories.'
        );
      }

      setFormCategories(normalizeFormCategoriesFromApi(filtered));
      setSuccess(`Loaded ${filtered.length} categories from Metro baseline. Review and click Save configuration.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
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
      setSuccess('Configuration saved.');
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
          <h3>Company configuration</h3>
        </div>
        <div className="admin-empty-state">
          <p className="admin-empty-state-title">Choose a company</p>
          <p className="admin-empty-state-text">Select a specific company in the header to load and edit its configuration.</p>
        </div>
      </div>
    );
  }

  const visibleFormCategories = formCategories.filter((c) => categoryMatchesPwaView(c.name, pwaFormView));

  return (
    <div className={`team-members company-config-wizard${loading ? ' company-config-wizard--loading' : ''}`}>
      <div className="section-header">
        <h3>Company configuration</h3>
        <div className="header-actions">
          <button type="button" onClick={load} className="action-button action-button--ghost" disabled={loading || saving}>
            Refresh
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="action-button action-button--primary"
            disabled={saving || loading}
          >
            {saving ? 'Saving…' : 'Save configuration'}
          </button>
        </div>
      </div>

      <p className="company-config-intro">
        Choose your company in the header first. Changes here apply <strong>only to that company</strong>. Use the forms
        below—no JSON editing required. Click <strong>Save configuration</strong> when you are done.
      </p>

      {loading ? (
        <div className="admin-loading-surface" aria-busy="true" aria-label="Loading configuration">
          <div className="admin-skeleton admin-skeleton--block" />
          <div className="admin-skeleton admin-skeleton--block admin-skeleton--short" />
          <div className="admin-skeleton-rows">
            <div className="admin-skeleton admin-skeleton--row" />
            <div className="admin-skeleton admin-skeleton--row" />
            <div className="admin-skeleton admin-skeleton--row" />
          </div>
          <span className="sr-only">Loading configuration…</span>
        </div>
      ) : null}
      {error ? <div className="error-message">{error}</div> : null}
      {success ? <div className="success-message">{success}</div> : null}

      <div className="company-config-form-stack">
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
              <button
                type="button"
                className="action-button action-button--delete-subtle subtle"
                onClick={() => removeHierarchyRule(rule.key)}
              >
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
        <button type="button" className="action-button action-button--primary subtle" onClick={addHierarchyRule}>
          Add rule
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
            className="action-button action-button--ghost subtle"
            onClick={() => loadMetroBaseline('salesperson')}
          >
            Salesperson standard
          </button>
          <button
            type="button"
            className="action-button action-button--ghost subtle"
            onClick={() => loadMetroBaseline('sales_lead')}
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
              <option value="sp_standard">Salesperson — low-mid / regular</option>
              <option value="sp_high_share">Salesperson — high-share</option>
              <option value="sales_lead">Sales lead / coaching (~SALES_LEAD in name)</option>
            </select>
          </div>
        ) : null}
        {formCategories.length === 0 ? (
          <p className="config-empty">
            No categories yet. Super administrators can use <strong>Seed templates</strong> in the header, then refresh this page.
          </p>
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
              <button
                type="button"
                className="action-button action-button--delete-subtle subtle"
                onClick={() => removeCategory(cat.key)}
              >
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
                    className="action-button action-button--delete-subtle subtle"
                    onClick={() => removeItem(cat.key, it.key)}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" className="action-button action-button--primary subtle" onClick={() => addItem(cat.key)}>
                Add item
              </button>
            </div>
          </div>
        ))}
        <button type="button" className="action-button action-button--primary" onClick={addCategory}>
          Add category
        </button>
      </div>
      </div>
    </div>
  );
};

const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() => localStorage.getItem('adminCompanyId') || 'all');
  const [openCreateSignal, setOpenCreateSignal] = useState(0);
  const [adminRole, setAdminRole] = useState<string | null>(null);
  const [showCreateCompanyPanel, setShowCreateCompanyPanel] = useState(false);
  const [createCompanyForm, setCreateCompanyForm] = useState({ id: '', name: '', slug: '' });
  const [createCompanyError, setCreateCompanyError] = useState('');
  const [createCompanySaving, setCreateCompanySaving] = useState(false);
  const [highlightUserId, setHighlightUserId] = useState<string | null>(null);
  const [highlightTeamId, setHighlightTeamId] = useState<string | null>(null);
  const [highlightRegionId, setHighlightRegionId] = useState<string | null>(null);

  const clearHighlights = () => {
    setHighlightUserId(null);
    setHighlightTeamId(null);
    setHighlightRegionId(null);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const navigateToTab = (tab: 'overview' | 'regions' | 'teams' | 'users' | 'configuration' | 'evaluation-structure') => {
    clearHighlights();
    setActiveTab(tab);
    closeMobileMenu();
  };

  const handleSearchHit = (hit: AdminSearchHit) => {
    clearHighlights();
    if (hit.kind === 'company') {
      apiService.setCompanyContext(hit.id);
      setSelectedCompanyId(hit.id);
      setActiveTab('configuration');
      closeMobileMenu();
      return;
    }
    if (hit.kind === 'user') {
      setHighlightUserId(hit.id);
      setActiveTab('users');
      closeMobileMenu();
      return;
    }
    if (hit.kind === 'team') {
      setHighlightTeamId(hit.id);
      setActiveTab('teams');
      closeMobileMenu();
      return;
    }
    setHighlightRegionId(hit.id);
    setActiveTab('regions');
    closeMobileMenu();
  };

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

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') {
      return undefined;
    }
    const prevTitle = document.title;
    document.title = 'Admin (dev) · Sales Scorecard';
    console.info(
      '[Sales Scorecard Admin] Dev bundle. UI: grouped sidebar, blue primary, search in header. If this log is missing or the UI looks old: stop the dev server, run `npm start` again, open http://localhost:3002/ (root), hard-refresh.'
    );
    return () => {
      document.title = prevTitle;
    };
  }, []);

  const handleNew = () => {
    if (adminRole === 'SUPER_ADMIN') {
      setCreateCompanyError('');
      setCreateCompanyForm({ id: '', name: '', slug: '' });
      setShowCreateCompanyPanel(true);
      return;
    }
    if (activeTab === 'overview') {
      clearHighlights();
      setActiveTab('teams');
      setOpenCreateSignal((prev) => prev + 1);
      return;
    }
    if (activeTab === 'teams' || activeTab === 'users') {
      setOpenCreateSignal((prev) => prev + 1);
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
      alert(`${msg || 'Done.'}${counts}`);
    } catch (error) {
      alert(`Failed to seed templates: ${(error as Error).message}`);
    }
  };

  const pageTitles: Record<string, string> = {
    overview: 'Overview',
    regions: 'Regions',
    teams: 'Teams',
    users: 'Users',
    configuration: 'Configuration',
    'evaluation-structure': 'Evaluation structure (M3)'
  };

  return (
    <div className="admin-panel">
      {process.env.NODE_ENV === 'development' ? (
        <div className="admin-dev-banner" role="status">
          <strong>Development</strong>
          <span>
            Live React app — use <code>http://localhost:3002/</code> (root). After changing{' '}
            <code>.env</code>, restart <code>npm start</code>. Hard-refresh (⌘⇧R) if styles look cached.
          </span>
        </div>
      ) : null}
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
          <nav className="admin-sidebar-nav" aria-label="Primary">
            <div className="sidebar-nav-section">
              <p className="sidebar-nav-label" id="nav-label-home">
                Home
              </p>
              <div className="sidebar-nav-items" role="group" aria-labelledby="nav-label-home">
                <button
                  type="button"
                  className={activeTab === 'overview' ? 'nav-button active' : 'nav-button'}
                  onClick={() => navigateToTab('overview')}
                >
                  Overview
                </button>
              </div>
            </div>
            <div className="sidebar-nav-section">
              <p className="sidebar-nav-label" id="nav-label-org">
                Organization
              </p>
              <div className="sidebar-nav-items" role="group" aria-labelledby="nav-label-org">
                <button
                  type="button"
                  className={activeTab === 'regions' ? 'nav-button active' : 'nav-button'}
                  onClick={() => navigateToTab('regions')}
                >
                  Regions
                </button>
                <button
                  type="button"
                  className={activeTab === 'teams' ? 'nav-button active' : 'nav-button'}
                  onClick={() => navigateToTab('teams')}
                >
                  Teams
                </button>
                <button
                  type="button"
                  className={activeTab === 'users' ? 'nav-button active' : 'nav-button'}
                  onClick={() => navigateToTab('users')}
                >
                  Users
                </button>
              </div>
            </div>
            <div className="sidebar-nav-section">
              <p className="sidebar-nav-label" id="nav-label-company">
                Company
              </p>
              <div className="sidebar-nav-items" role="group" aria-labelledby="nav-label-company">
                <button
                  type="button"
                  className={activeTab === 'configuration' ? 'nav-button active' : 'nav-button'}
                  onClick={() => navigateToTab('configuration')}
                >
                  Configuration
                </button>
                <button
                  type="button"
                  className={activeTab === 'evaluation-structure' ? 'nav-button active' : 'nav-button'}
                  onClick={() => navigateToTab('evaluation-structure')}
                >
                  Evaluation structure (M3)
                </button>
              </div>
            </div>
            <p className="sidebar-build-stamp" title="If this line is missing, the browser is serving an old build.">
              Admin UI · 2026.04
            </p>
          </nav>
        </aside>

        <div className="admin-main">
          <header className="admin-topbar">
            <div className="admin-topbar-row admin-topbar-row--main">
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
                <h1 className="topbar-page-heading">
                  <span className="topbar-breadcrumb-muted">Admin</span>
                  <span className="topbar-breadcrumb-sep" aria-hidden="true">
                    /
                  </span>
                  <span className="topbar-page-title-text">{pageTitles[activeTab] ?? 'Admin'}</span>
                </h1>
              </div>
              <div className="topbar-search-wrap">
                <AdminGlobalSearch selectedCompanyId={selectedCompanyId} onSelectHit={handleSearchHit} />
              </div>
            </div>
            <div className="admin-topbar-row admin-topbar-row--tools">
              <div className="topbar-actions">
              <label className="topbar-company-field">
                <span className="topbar-company-label">Company</span>
                <select
                  className="topbar-company-select"
                  title="Switching updates teams and users."
                  aria-describedby="topbar-company-hint"
                  value={selectedCompanyId}
                  onChange={(e) => {
                    const v = e.target.value;
                    apiService.setCompanyContext(v === 'all' ? null : v);
                    setSelectedCompanyId(v);
                    clearHighlights();
                  }}
                >
                  <option value="all">All companies</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
                <span id="topbar-company-hint" className="sr-only">
                  Switching updates teams and users.
                </span>
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
                      : activeTab === 'overview'
                        ? 'Create a team (opens Team management)'
                        : 'Create team (Team Management) or user (User Management)'
                  }
                >
                  + New
                </button>
              )}
              {adminRole === 'SUPER_ADMIN' ? (
                <button type="button" className="action-button action-button--ghost" onClick={handleSeedTemplates}>
                  Seed templates
                </button>
              ) : null}
              <button type="button" onClick={handleLogout} className="logout-button">
                Log out
              </button>
              </div>
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
            {activeTab === 'overview' && (
              <AdminOverview
                selectedCompanyId={selectedCompanyId}
                companies={companies}
                adminRole={adminRole}
                onGo={(tab) => navigateToTab(tab)}
                onSeed={handleSeedTemplates}
              />
            )}
            {activeTab === 'regions' && (
              <RegionsManagement
                selectedCompanyId={selectedCompanyId}
                highlightRegionId={highlightRegionId}
              />
            )}
            {activeTab === 'teams' && (
              <TeamMembers
                openCreateSignal={openCreateSignal}
                selectedCompanyId={selectedCompanyId}
                highlightTeamId={highlightTeamId}
              />
            )}
            {activeTab === 'users' && (
              <UserManagement
                openCreateSignal={openCreateSignal}
                selectedCompanyId={selectedCompanyId}
                highlightUserId={highlightUserId}
              />
            )}
            {activeTab === 'configuration' && <CompanyConfiguration selectedCompanyId={selectedCompanyId} />}
            {activeTab === 'evaluation-structure' && (
              <EvaluationStructureM3 selectedCompanyId={selectedCompanyId} api={apiService as any} />
            )}
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
            <h2>Admin</h2>
            <p className="login-subtitle">Checking session…</p>
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

