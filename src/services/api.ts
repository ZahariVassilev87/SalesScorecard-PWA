// API Service for Sales Scorecard PWA
const API_BASE = process.env.REACT_APP_API_BASE_URL || 'https://api.instorm.io';

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
  };
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
    try {
      const teams = await this.request<any[]>('/public-admin/teams');
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
      console.error('Failed to load teams:', error);
      // Return empty array if API fails
      return [];
    }
  }

  async getMyTeam(): Promise<Team | null> {
    console.log('🔍 Loading team data...');
    
    try {
      // Get current user profile which includes team information
      console.log('📡 Calling /users/profile/me...');
      const profile = await this.request<any>('/users/profile/me');
      console.log('👤 Profile data:', profile);
      
      if (profile) {
        // Check if user has managed teams
        if (profile.managedTeams && profile.managedTeams.length > 0) {
          console.log('👥 Found managed teams:', profile.managedTeams);
          const managedTeam = profile.managedTeams[0];
          console.log('🔍 Managed team structure:', JSON.stringify(managedTeam, null, 2));
          
          // Try to get team members from the organizations endpoint first
          let members = [];
          try {
            console.log('📡 Calling /organizations/team-members to get team members...');
            const teamMembers = await this.request<any[]>('/organizations/team-members');
            console.log('📋 Team members from organizations endpoint:', teamMembers);
            members = teamMembers;
          } catch (orgError) {
            console.log('⚠️ Failed to get team members from organizations endpoint:', orgError);
            
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
      
      console.log('⚠️ No team data found in profile, using fallback');
      // Fall back to mock data if no real team found
      throw new Error('No real team data available');
    } catch (error) {
      console.error('❌ Failed to load team data:', error);
      console.log('🔄 Using mock team data...');
      
      // Return mock team data for now
      const mockTeam: Team = {
        id: '1',
        name: 'Sales Team Alpha',
        region: {
          id: '1',
          name: 'North Region'
        },
        members: [
          {
            id: '1',
            email: 'john.smith@company.com',
            displayName: 'John Smith',
            role: 'SALESPERSON' as const,
            isActive: true,
            teamId: '1'
          },
          {
            id: '2',
            email: 'sarah.johnson@company.com',
            displayName: 'Sarah Johnson',
            role: 'SALES_LEAD' as const,
            isActive: true,
            teamId: '1'
          },
          {
            id: '3',
            email: 'mike.davis@company.com',
            displayName: 'Mike Davis',
            role: 'SALESPERSON' as const,
            isActive: true,
            teamId: '1'
          }
        ]
      };
      console.log('✅ Returning mock team:', mockTeam);
      return mockTeam;
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

  async getBehaviorCategories(): Promise<BehaviorCategory[]> {
    try {
      return await this.request<BehaviorCategory[]>('/scoring/categories');
    } catch (error) {
      console.error('Failed to load behavior categories:', error);
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
    location?: string;
    overallComment?: string;
    items: Array<{
      behaviorItemId: string;
      score: number;
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
      // Get current user from localStorage
      const currentUserStr = localStorage.getItem('user');
      if (!currentUserStr) {
        console.log('❌ No current user found in localStorage');
        throw new Error('No current user found');
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
          if (salespeople.length > 0) {
            return salespeople;
          }
        }
        console.log('⚠️ No team members found, using fallback');
      } else if (currentUser.role === 'REGIONAL_MANAGER' || currentUser.role === 'REGIONAL_SALES_MANAGER') {
        console.log('🔍 Regional Manager: Getting team members...');
        const team = await this.getMyTeam();
        console.log('👥 Team data:', team);
        if (team && team.members && team.members.length > 0) {
          const salesLeads = team.members.filter(member => member.role === 'SALES_LEAD');
          console.log('✅ Found sales leads:', salesLeads);
          if (salesLeads.length > 0) {
            return salesLeads;
          }
        }
        console.log('⚠️ No team members found, using fallback');
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
      
      console.log('⚠️ No matching role, using fallback');
    } catch (error) {
      console.error('❌ Failed to load evaluatable users:', error);
      console.log('🔄 Using fallback mock data...');
    }
    
    // Always fall back to mock data if we reach here
    console.log('🔄 Using fallback mock data...');
    
    // Return mock data based on role
    const currentUserStr = localStorage.getItem('user');
    if (currentUserStr) {
      const currentUser = JSON.parse(currentUserStr);
      console.log('👤 Fallback for role:', currentUser.role);
      
      if (currentUser.role === 'SALES_LEAD') {
        const mockData: User[] = [
          {
            id: '1',
            email: 'john.smith@company.com',
            displayName: 'John Smith',
            role: 'SALESPERSON' as const,
            isActive: true,
            teamId: '1'
          },
          {
            id: '3',
            email: 'mike.davis@company.com',
            displayName: 'Mike Davis',
            role: 'SALESPERSON' as const,
            isActive: true,
            teamId: '1'
          }
        ];
        console.log('✅ Returning mock salespeople:', mockData);
        return mockData;
      } else if (currentUser.role === 'REGIONAL_MANAGER' || currentUser.role === 'REGIONAL_SALES_MANAGER') {
        const mockData: User[] = [
          {
            id: '2',
            email: 'sarah.johnson@company.com',
            displayName: 'Sarah Johnson',
            role: 'SALES_LEAD' as const,
            isActive: true,
            teamId: '1'
          }
        ];
        console.log('✅ Returning mock sales leads:', mockData);
        return mockData;
      } else if (currentUser.role === 'ADMIN') {
        const mockData: User[] = [
          {
            id: '1',
            email: 'john.smith@company.com',
            displayName: 'John Smith',
            role: 'SALESPERSON' as const,
            isActive: true,
            teamId: '1'
          },
          {
            id: '2',
            email: 'sarah.johnson@company.com',
            displayName: 'Sarah Johnson',
            role: 'SALES_LEAD' as const,
            isActive: true,
            teamId: '1'
          },
          {
            id: '3',
            email: 'mike.davis@company.com',
            displayName: 'Mike Davis',
            role: 'SALESPERSON' as const,
            isActive: true,
            teamId: '1'
          }
        ];
        console.log('✅ Returning mock users for admin:', mockData);
        return mockData;
      }
    }
    
    console.log('❌ No fallback data available');
    return [];
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
