// API Service for Sales Scorecard PWA
const API_BASE = process.env.REACT_APP_API_BASE_URL || 'https://api.instorm.io';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'SALES_DIRECTOR' | 'REGIONAL_SALES_MANAGER' | 'SALES_LEAD' | 'SALESPERSON';
  isActive: boolean;
  teamId?: string;
}

export interface Team {
  id: string;
  name: string;
  region?: {
    id: string;
    name: string;
  };
  members: User[];
  manager?: User;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface SalesData {
  totalSales: number;
  monthlyTarget: number;
  achievement: number;
  teamPerformance: number;
}

export interface DirectorateData {
  totalRegions: number;
  totalTeamMembers: number;
  averagePerformance: number;
  totalSales: number;
  evaluationsCompleted: number;
  targetAchievement: number;
}

export interface BehaviorCategory {
  id: string;
  name: string;
  order: number;
  weight: number;
  items: BehaviorItem[];
}

export interface BehaviorItem {
  id: string;
  name: string;
  order: number;
  isActive: boolean;
  categoryId: string;
  category?: BehaviorCategory;
}

export interface EvaluationItem {
  id: string;
  evaluationId: string;
  behaviorItemId: string;
  score: number;
  comment?: string;
  behaviorItem: BehaviorItem;
}

export interface Evaluation {
  id: string;
  salespersonId: string;
  managerId: string;
  visitDate: string;
  customerName?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  locationAccuracy?: number;
  overallComment?: string;
  overallScore?: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  salesperson: User;
  manager: User;
  items: EvaluationItem[];
}

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('userToken');
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('userToken', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('userToken');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} ${errorText}`);
    }

    return response.json();
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


  async getTeams(): Promise<Team[]> {
    return this.request<Team[]>('/teams');
  }

  async getMyTeam(): Promise<Team | null> {
    const teams = await this.getTeams();
    return teams.find(team => 
      team.members.some(member => member.id === this.getCurrentUserId())
    ) || null;
  }

  async getUsers(): Promise<User[]> {
    return this.request<User[]>('/users');
  }

  async getSalesData(): Promise<SalesData> {
    // Mock data for now - replace with real API call
    return {
      totalSales: 125000,
      monthlyTarget: 100000,
      achievement: 125,
      teamPerformance: 98
    };
  }

  async getDirectorateData(): Promise<any> {
    // Mock data for Sales Directors - evaluation results
    return {
      totalRegions: 5,
      totalTeamMembers: 45,
      averagePerformance: 87,
      totalEvaluations: 156,
      evaluationsCompleted: 23,
      averageScore: 4.2
    };
  }

  async getTeamAnalytics(): Promise<any> {
    // Mock data for team analytics - replace with real API call
    return {
      teamPerformance: {
        average: 4.2,
        trend: 'improving',
        topPerformers: 3,
        needsImprovement: 1
      },
      evaluationStats: {
        totalEvaluations: 15,
        thisMonth: 5,
        averageScore: 4.1,
        completionRate: 85
      },
      commonIssues: [
        { issue: 'Discovery Questions', frequency: 3 },
        { issue: 'Closing Techniques', frequency: 2 },
        { issue: 'Solution Positioning', frequency: 1 }
      ]
    };
  }

  async getBehaviorCategories(): Promise<BehaviorCategory[]> {
    return this.request<BehaviorCategory[]>('/scoring/categories');
  }

  async getEvaluations(): Promise<Evaluation[]> {
    return this.request<Evaluation[]>('/evaluations');
  }

  async getMyEvaluations(): Promise<Evaluation[]> {
    const evaluations = await this.getEvaluations();
    const currentUserId = this.getCurrentUserId();
    return evaluations.filter(evaluation => evaluation.managerId === currentUserId);
  }

  async createEvaluation(evaluationData: {
    salespersonId: string;
    visitDate: string;
    customerName?: string;
    location?: string;
    overallComment?: string;
    items: Array<{
      behaviorItemId: string;
      score: number;
      comment?: string;
    }>;
  }): Promise<Evaluation> {
    return this.request<Evaluation>('/evaluations', {
      method: 'POST',
      body: JSON.stringify(evaluationData)
    });
  }

  async getEvaluationById(id: string): Promise<Evaluation> {
    return this.request<Evaluation>(`/evaluations/${id}`);
  }

  // Hierarchy management methods
  async getSubordinates(): Promise<User[]> {
    return this.request<User[]>('/users/subordinates');
  }

  async getSalesLeads(): Promise<User[]> {
    const users = await this.getUsers();
    return users.filter(user => user.role === 'SALES_LEAD');
  }

  async getRegionalManagers(): Promise<User[]> {
    const users = await this.getUsers();
    return users.filter(user => user.role === 'REGIONAL_SALES_MANAGER');
  }

  async getSalespeople(): Promise<User[]> {
    const users = await this.getUsers();
    return users.filter(user => user.role === 'SALESPERSON');
  }

  // Role-based evaluation methods
  async getEvaluatableUsers(): Promise<User[]> {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return [];

    switch (currentUser.role) {
      case 'SALES_DIRECTOR':
        return this.getRegionalManagers();
      case 'REGIONAL_SALES_MANAGER':
        return this.getSalesLeads();
      case 'SALES_LEAD':
        return this.getSalespeople();
      default:
        return [];
    }
  }

  private getCurrentUserId(): string {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      return user.id;
    }
    return '';
  }

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      return JSON.parse(userStr);
    }
    return null;
  }

  logout() {
    this.clearToken();
    localStorage.removeItem('user');
  }
}

export const apiService = new ApiService();
