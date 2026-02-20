// API Service for Sales Scorecard PWA
const API_BASE = process.env.REACT_APP_API_BASE_URL || 'https://api.scorecard.instorm.io';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'SALES_DIRECTOR' | 'REGIONAL_SALES_MANAGER' | 'REGIONAL_MANAGER' | 'SALES_LEAD' | 'SALESPERSON';
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
  rating: number;
  comment?: string;
  behaviorItem: BehaviorItem;
}

export interface Evaluation {
  id: string;
  salespersonId: string;
  managerId: string;
  visitDate: string;
  customerName?: string;
  customerType?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  locationAccuracy?: number;
  overallComment?: string;
  overallScore?: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  salesperson: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    teamId: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    displayName?: string; // For compatibility
    name?: string; // Backend sometimes returns this instead of displayName
  };
  manager: User;
  items: EvaluationItem[];
}

class ApiService {
  private token: string | null = null;

  constructor() {
    // Simple token initialization - try localStorage first, then sessionStorage
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const userToken = localStorage.getItem('userToken') || sessionStorage.getItem('userToken');
    
    // Use token if available, otherwise fallback to userToken
    this.token = token || userToken;
    
    console.log('🔍 ApiService initialized with token:', !!this.token);
  }

  setToken(token: string) {
    this.token = token;
    try {
      localStorage.setItem('token', token);
      localStorage.setItem('userToken', token); // Keep for backward compatibility
      console.log('✅ [MOBILE DEBUG] Token saved to localStorage');
    } catch (error) {
      console.error('❌ [MOBILE DEBUG] Failed to save token to localStorage:', error);
      // Mobile browsers sometimes have localStorage issues
      // Store in sessionStorage as fallback
      try {
        sessionStorage.setItem('token', token);
        sessionStorage.setItem('userToken', token); // Keep for backward compatibility
        console.log('✅ [MOBILE DEBUG] Token saved to sessionStorage as fallback');
      } catch (sessionError) {
        console.error('❌ [MOBILE DEBUG] Failed to save token to sessionStorage:', sessionError);
      }
    }
  }

  clearToken() {
    this.token = null;
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('userToken'); // Keep for backward compatibility
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('userToken'); // Keep for backward compatibility
      console.log('✅ [MOBILE DEBUG] Tokens cleared from storage');
    } catch (error) {
      console.error('❌ [MOBILE DEBUG] Failed to clear tokens:', error);
    }
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
    console.log('🔍 [DEBUG] Login attempt - Browser:', navigator.userAgent);
    console.log('🔍 [DEBUG] Email:', email);
    console.log('🔍 [DEBUG] Email length:', email.length);
    console.log('🔍 [DEBUG] Email charCodes:', Array.from(email).map((c, i) => `${i}:${c}(${c.charCodeAt(0)})`).join(' '));
    console.log('🔍 [DEBUG] Password length:', password.length);
    console.log('🔍 [DEBUG] API_BASE:', API_BASE);
    
    const loginData = { email: email.trim(), password: password.trim() };
    console.log('🔍 [DEBUG] Sending:', JSON.stringify(loginData));
    
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(loginData)
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
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'TimeoutError') {
          throw new Error('Login timeout - please check your internet connection');
        }
        if (error.message.includes('Failed to fetch')) {
          throw new Error('Network error - please check your internet connection');
        }
      }
      throw error;
    }
  }


  async getTeams(): Promise<Team[]> {
    try {
      console.log('🔍 [DEBUG] Calling /organizations/teams endpoint...');
      // Use the RBAC endpoint instead of the admin endpoint
      const teams = await this.request<any[]>(`/organizations/teams?t=${Date.now()}`);
      console.log('✅ [DEBUG] Successfully got teams from /organizations/teams:', teams.length, 'teams');
      // Transform the API response to match our Team interface
      return teams.map(team => ({
        id: team.id,
        name: team.name,
        region: team.region ? {
          id: team.region.id,
          name: team.region.name
        } : undefined,
        members: team.userTeams ? team.userTeams.map((ut: any) => ut.user) : (team.salespeople || []),
        manager: team.manager
      }));
    } catch (error) {
      console.error('❌ [DEBUG] Failed to load teams from /organizations/teams:', error);
      console.log('🔄 [DEBUG] Falling back to /public-admin/teams...');
      try {
        const fallbackTeams = await this.request<any[]>('/public-admin/teams');
        console.log('✅ [DEBUG] Successfully got teams from fallback:', fallbackTeams.length, 'teams');
        return fallbackTeams.map(team => ({
          id: team.id,
          name: team.name,
          region: team.region ? {
            id: team.region.id,
            name: team.region.name
          } : undefined,
          members: team.userTeams ? team.userTeams.map((ut: any) => ut.user) : (team.salespeople || []),
          manager: team.manager
        }));
      } catch (fallbackError) {
        console.error('❌ [DEBUG] Fallback also failed:', fallbackError);
        return [];
      }
    }
  }

  async getMyTeam(): Promise<Team | null> {
    console.log('🔍 [API] Loading team data...');
    console.log('🔍 [API] Current token source:', this.token ? 'EXISTS' : 'MISSING');
    console.log('🔍 [API] Token preview:', this.token ? this.token.substring(0, 50) + '...' : 'NONE');
    
    try {
      // Use the new dedicated endpoint to get user's team with all members
      console.log('📡 [API] Calling /users/my-team...');
      const team = await this.request<Team>('/users/my-team');
      console.log('👥 [API] Team data:', team);
      
      if (team) {
        console.log(`✅ [API] Found team: ${team.name} with ${team.members?.length || 0} members`);
        return team;
      }
      
      console.log('⚠️ [API] No team found for current user');
      return null;
    } catch (error) {
      console.error('❌ Error loading team:', error);
      
      // Fallback to old logic
      console.log('⚠️ Falling back to old profile-based logic...');
      try {
        const profile = await this.request<any>('/users/profile/me');
        console.log('👤 Profile data:', profile);
      
      if (profile) {
        // Check if user has managed teams
        if (profile.managedTeams && profile.managedTeams.length > 0) {
          console.log('👥 Found managed teams:', profile.managedTeams);
          const managedTeam = profile.managedTeams[0];
          console.log('🔍 Managed team structure:', JSON.stringify(managedTeam, null, 2));
          
          // Try to get team data from the RBAC-enabled organizations endpoint first
          let members = [];
          try {
            console.log('📡 Calling /organizations/teams to get RBAC-filtered team data...');
            const teams = await this.request<any[]>(`/organizations/teams?t=${Date.now()}`);
            console.log('📋 Teams from organizations endpoint:', teams);
            
            // Find the team that matches the managed team
            const teamWithMembers = teams.find(team => team.id === managedTeam.id);
            if (teamWithMembers && teamWithMembers.userTeams) {
              members = teamWithMembers.userTeams.map((ut: any) => ut.user);
              console.log('✅ Found RBAC-filtered team members:', members.length);
            } else {
              console.log('⚠️ No matching team found in RBAC endpoint, using managed team data');
              if (managedTeam.userTeams) {
                members = managedTeam.userTeams.map((ut: any) => ut.user);
              }
            }
          } catch (orgError) {
            console.log('⚠️ Failed to get teams from organizations endpoint:', orgError);
            
            // Fallback: try to get team members from the admin teams endpoint
            try {
              console.log('📡 Calling /public-admin/teams to get team members...');
              const teams = await this.request<any[]>('/public-admin/teams');
              const teamWithMembers = teams.find(team => team.id === managedTeam.id);
              if (teamWithMembers && teamWithMembers.userTeams) {
                members = teamWithMembers.userTeams.map((ut: any) => ut.user);
                console.log('📋 Found team members from admin teams endpoint:', members);
              }
            } catch (teamError) {
              console.log('⚠️ Failed to get team members from admin teams endpoint:', teamError);
            }
          }
          
          // Fallback to profile data if teams endpoint fails
          if (members.length === 0) {
            if (managedTeam.salespeople) {
              members = managedTeam.salespeople;
              console.log('📋 Found salespeople field:', members);
            } else if (managedTeam.members) {
              members = managedTeam.members;
              console.log('📋 Found members field:', members);
            } else if (managedTeam.users) {
              members = managedTeam.users;
              console.log('📋 Found users field:', members);
            } else if (managedTeam.userTeams) {
              // Map userTeams relationship to members
              members = managedTeam.userTeams.map((ut: any) => ut.user);
              console.log('📋 Found userTeams field, mapped to members:', members);
            } else {
              console.log('⚠️ No members found in team structure');
            }
          }
          
          const teamData = {
            id: managedTeam.id,
            name: managedTeam.name,
            members: members,
            manager: profile
          };
          console.log('✅ Returning managed team:', teamData);
          return teamData;
        }
        
        // Check if user is part of a team
        if (profile.userTeams && profile.userTeams.length > 0) {
          console.log('👥 Found user teams:', profile.userTeams);
          const userTeam = profile.userTeams[0];
          const teamData = {
            id: userTeam.team.id,
            name: userTeam.team.name,
            region: userTeam.team.region ? {
              id: userTeam.team.region.id,
              name: userTeam.team.region.name
            } : undefined,
            members: userTeam.team.userTeams ? userTeam.team.userTeams.map((ut: any) => ut.user) : (userTeam.team.salespeople || []),
            manager: userTeam.team.manager
          };
          console.log('✅ Returning user team:', teamData);
          return teamData;
        }
      }
      
      console.log('⚠️ No team data found in profile');
      // If user has no managed teams and no user teams, return null
      return null;
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError);
        return null;
      }
    }
  }

  async getUsers(): Promise<User[]> {
    try {
      return await this.request<User[]>('/users');
    } catch (error) {
      console.error('Failed to load users:', error);
      // Return empty array if API fails
      return [];
    }
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
    try {
      // Try to get real analytics data
      const analytics = await this.request<any>('/analytics/dashboard');
      return {
        totalRegions: analytics.totalRegions || 0,
        totalTeamMembers: analytics.totalTeamMembers || 0,
        averagePerformance: analytics.averagePerformance || 0,
        totalEvaluations: analytics.totalEvaluations || 0,
        evaluationsCompleted: analytics.evaluationsCompleted || 0,
        averageScore: analytics.averageScore || 0
      };
    } catch (error) {
      console.error('Failed to load directorate data:', error);
      // Fall back to mock data
      return {
        totalRegions: 5,
        totalTeamMembers: 45,
        averagePerformance: 87,
        totalEvaluations: 156,
        evaluationsCompleted: 23,
        averageScore: 4.2
      };
    }
  }

  async getTeamAnalytics(): Promise<any> {
    try {
      // Try to get real team analytics
      const analytics = await this.request<any>('/analytics/team');
      return analytics;
    } catch (error) {
      console.error('Failed to load team analytics:', error);
      // Fall back to mock data
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
  }

  async getBehaviorCategories(customerType?: string): Promise<BehaviorCategory[]> {
    try {
      const endpoint = customerType 
        ? `/scoring/categories?customerType=${encodeURIComponent(customerType)}`
        : '/scoring/categories';
      console.log('🔍 [API] getBehaviorCategories called with customerType:', customerType);
      console.log('🔍 [API] Endpoint:', endpoint);
      const result = await this.request<BehaviorCategory[]>(endpoint);
      console.log('✅ [API] getBehaviorCategories returned', result.length, 'categories');
      if (result.length > 0) {
        console.log('🔍 [API] First category:', result[0].name);
      }
      return result;
    } catch (error) {
      console.error('❌ [API] Failed to load behavior categories:', error);
      // Return empty array if API fails
      return [];
    }
  }

  async getEvaluations(): Promise<Evaluation[]> {
    try {
      return await this.request<Evaluation[]>('/evaluations');
    } catch (error) {
      console.error('Failed to load evaluations:', error);
      // Return empty array if API fails
      return [];
    }
  }

  async getMyEvaluations(): Promise<Evaluation[]> {
    try {
      return await this.request<Evaluation[]>('/evaluations/my');
    } catch (error) {
      console.error('Failed to load my evaluations:', error);
      // Return empty array if API fails
      return [];
    }
  }

  async createEvaluation(evaluationData: {
    salespersonId: string;
    visitDate: string;
    customerName?: string;
    customerType?: string;
    location?: string;
    overallComment?: string;
    items: Array<{
      behaviorItemId: string;
      rating: number; // Backend expects 'rating' not 'score'
      comment?: string;
    }>;
  }): Promise<Evaluation> {
    try {
      return await this.request<Evaluation>('/evaluations', {
        method: 'POST',
        body: JSON.stringify(evaluationData)
      });
    } catch (error) {
      console.error('Failed to submit evaluation:', error);
      throw error;
    }
  }

  async getEvaluationById(id: string): Promise<Evaluation> {
    return this.request<Evaluation>(`/evaluations/${id}`);
  }

  // Hierarchy management methods
  async getSubordinates(): Promise<User[]> {
    try {
      // Try to get subordinates from profile endpoint
      const profile = await this.request<any>('/users/profile/me');
      if (profile && profile.managedTeams) {
        const subordinates: User[] = [];
        profile.managedTeams.forEach((team: any) => {
          if (team.salespeople) {
            subordinates.push(...team.salespeople);
          }
        });
        return subordinates;
      }
      return [];
    } catch (error) {
      console.error('Failed to load subordinates:', error);
      return [];
    }
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
    console.log('🔍 Loading evaluatable users...');
    
    try {
      // Use team-based approach as primary method
      console.log('📡 Getting team data for evaluatable users...');
      const currentUserStr = localStorage.getItem('user');
      if (!currentUserStr) {
        console.log('❌ No current user found in localStorage');
        return [];
      }
      
      const currentUser = JSON.parse(currentUserStr);
      console.log('👤 Current user role:', currentUser.role);
      
      // Get team members based on current user's role
      if (currentUser.role === 'SALES_LEAD') {
        console.log('🔍 Sales Lead: Getting team members...');
        const team = await this.getMyTeam();
        console.log('👥 Team data:', team);
        if (team && team.members && team.members.length > 0) {
          const salespeople = team.members.filter(member => member.role === 'SALESPERSON');
          console.log('✅ Found salespeople:', salespeople);
          return salespeople;
        }
        console.log('⚠️ No team members found - Sales Lead has no managed teams');
        return [];
      } else if (currentUser.role === 'REGIONAL_MANAGER' || currentUser.role === 'REGIONAL_SALES_MANAGER') {
        console.log('🔍 Regional Manager: Getting team members...');
        const team = await this.getMyTeam();
        console.log('👥 Team data:', team);
        if (team && team.members && team.members.length > 0) {
          const salesLeads = team.members.filter(member => member.role === 'SALES_LEAD');
          console.log('✅ Found sales leads:', salesLeads);
          return salesLeads;
        }
        console.log('⚠️ No team members found - Regional Manager has no managed teams');
        return [];
      } else if (currentUser.role === 'SALES_DIRECTOR') {
        console.log('🔍 Sales Director: Getting regional managers...');
        const users = await this.getUsers();
        const regionalManagers = users.filter(user => user.role === 'REGIONAL_MANAGER' || user.role === 'REGIONAL_SALES_MANAGER');
        console.log('✅ Found regional managers:', regionalManagers);
        return regionalManagers;
      } else if (currentUser.role === 'ADMIN') {
        console.log('🔍 Admin: Getting all users...');
        const users = await this.getUsers();
        const nonAdmins = users.filter(user => user.role !== 'ADMIN');
        console.log('✅ Found non-admin users:', nonAdmins);
        return nonAdmins;
      }
      
      console.log('⚠️ No matching role, returning empty array');
      return [];
      
    } catch (error) {
      console.error('❌ Error loading evaluatable users:', error);
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
    console.log('🔍 [MOBILE DEBUG] getCurrentUser called');
    
    // Try localStorage first, then sessionStorage for mobile compatibility
    let userStr = localStorage.getItem('user');
    if (!userStr) {
      console.log('🔍 [MOBILE DEBUG] No user in localStorage, trying sessionStorage');
      userStr = sessionStorage.getItem('user');
    }
    
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        console.log('✅ [MOBILE DEBUG] User found in storage:', user.displayName);
        return user;
      } catch (error) {
        console.error('❌ [MOBILE DEBUG] Failed to parse user data:', error);
        return null;
      }
    }
    
    console.log('⚠️ [MOBILE DEBUG] No user data found in any storage');
    return null;
  }

  logout() {
    console.log('🔍 [MOBILE DEBUG] ApiService logout called');
    this.clearToken();
    
    // Clear user data from both storages
    try {
      localStorage.removeItem('user');
      console.log('✅ [MOBILE DEBUG] User data cleared from localStorage');
    } catch (error) {
      console.error('❌ [MOBILE DEBUG] Failed to clear localStorage:', error);
    }
    
    try {
      sessionStorage.removeItem('user');
      console.log('✅ [MOBILE DEBUG] User data cleared from sessionStorage');
    } catch (error) {
      console.error('❌ [MOBILE DEBUG] Failed to clear sessionStorage:', error);
    }
  }

  // Sales Director Dashboard Analytics
  async getDirectorDashboard(): Promise<{
    // Regional execution performance (salespeople evaluations by sales leads)
    regionalExecutionPerformance: Array<{
      regionId: string;
      regionName: string;
      executionEvaluations: number;
      avgExecutionScore: number;
      uniqueSalespeopleEvaluated: number;
      uniqueSalesLeadsEvaluating: number;
    }>;
    
    // Regional coaching performance (sales leads evaluations by regional managers)
    regionalCoachingPerformance: Array<{
      regionId: string;
      regionName: string;
      coachingEvaluations: number;
      avgCoachingScore: number;
      uniqueSalesLeadsEvaluated: number;
      uniqueRegionalManagersEvaluating: number;
    }>;
    
    // Salespeople execution performance (by sales lead)
    salespeopleExecutionPerformance: Array<{
      salesLeadId: string;
      salesLeadName: string;
      salesLeadEmail: string;
      executionEvaluationsCreated: number;
      avgExecutionScore: number;
      regionId: string;
      regionName: string;
    }>;
    
    // Sales lead coaching performance (of sales leads by regional managers)
    salesLeadCoachingPerformance: Array<{
      salesLeadId: string;
      salesLeadName: string;
      salesLeadEmail: string;
      regionalManagerId: string;
      regionalManagerName: string;
      coachingEvaluationsReceived: number;
      avgCoachingScore: number;
      regionId: string;
      regionName: string;
    }>;
    
    // Company execution metrics (salespeople evaluations)
    companyExecutionMetrics: {
      totalExecutionEvaluations: number;
      avgExecutionScore: number;
      totalSalespeopleEvaluated: number;
      totalSalesLeadsEvaluating: number;
    } | null;
    
    // Company coaching metrics (sales leads evaluations)
    companyCoachingMetrics: {
      totalCoachingEvaluations: number;
      avgCoachingScore: number;
      totalSalesLeadsEvaluated: number;
      totalRegionalManagersEvaluating: number;
    } | null;
    
    // User counts
    userCounts: {
      totalSalesLeads: number;
      totalRegionalManagers: number;
      totalSalespeople: number;
    } | null;
    
    // Share of Wallet distribution
    shareOfWalletDistribution: Array<{
      customerType: string;
      evaluationCount: number;
      avgScore: number;
      percentage: number;
    }>;
    
    // Execution trends (salespeople evaluations)
    executionTrends: Array<{
      date: string;
      evaluationsCount: number;
      avgScore: number;
    }>;
    
    // Coaching trends (sales leads evaluations)
    coachingTrends: Array<{
      date: string;
      evaluationsCount: number;
      avgScore: number;
    }>;

    // Regional execution metrics (regional managers performance in sales behaviours)
    regionalExecutionMetrics: Array<{
      regionalManagerId: string;
      regionalManagerName: string;
      regionalManagerEmail: string;
      regionId: string;
      regionName: string;
      executionEvaluations: number;
      avgExecutionScore: number;
      uniqueSalespeopleEvaluated: number;
      uniqueSalesLeadsEvaluating: number;
    }>;

    // Regional coaching metrics (regional managers performance in coaching)
    regionalCoachingMetrics: Array<{
      regionalManagerId: string;
      regionalManagerName: string;
      regionalManagerEmail: string;
      regionId: string;
      regionName: string;
      coachingEvaluations: number;
      avgCoachingScore: number;
      uniqueSalesLeadsEvaluated: number;
    }>;
  }> {
    try {
      return await this.request('/analytics/director-dashboard');
    } catch (error) {
      console.error('Failed to load director dashboard data:', error);
      throw error;
    }
  }
}

export const apiService = new ApiService();
