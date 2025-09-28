// API Service for Sales Scorecard PWA
import { tokenStorage, userStorage } from '../utils/secureStorage';
import { handleApiError, logError } from '../utils/errorHandler';

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
  refreshToken?: string;
  user: User;
  expiresIn?: number;
}

export interface RefreshTokenResponse {
  token: string;
  refreshToken?: string;
  expiresIn?: number;
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
  };
  manager: User;
  items: EvaluationItem[];
}

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = tokenStorage.getToken();
  }

  setToken(token: string) {
    this.token = token;
    tokenStorage.setToken(token);
  }

  clearToken() {
    this.token = null;
    tokenStorage.removeToken();
    userStorage.removeUser();
  }

  // Token refresh mechanism
  async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = tokenStorage.getRefreshToken();
      if (!refreshToken) {
        console.warn('No refresh token available');
        return false;
      }

      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        console.warn('Token refresh failed:', response.status);
        return false;
      }

      const data: RefreshTokenResponse = await response.json();
      
      // Update tokens
      this.setToken(data.token);
      if (data.refreshToken) {
        tokenStorage.setRefreshToken(data.refreshToken);
      }
      if (data.expiresIn) {
        tokenStorage.setTokenExpiry(Date.now() + (data.expiresIn * 1000));
      }

      console.log('✅ Token refreshed successfully');
      return true;
    } catch (error) {
      console.error('❌ Token refresh error:', error);
      return false;
    }
  }

  // Check if token is expired or about to expire
  isTokenExpired(): boolean {
    const expiry = tokenStorage.getTokenExpiry();
    if (!expiry) return false;
    
    // Consider token expired if it expires within the next 5 minutes
    const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
    return expiry < fiveMinutesFromNow;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}, retryCount = 0): Promise<T> {
    try {
      // Check if token is expired and refresh if needed
      if (this.token && this.isTokenExpired() && retryCount === 0) {
        console.log('🔄 Token expired, attempting refresh...');
        const refreshed = await this.refreshToken();
        if (!refreshed) {
          console.warn('⚠️ Token refresh failed, clearing auth data');
          this.clearToken();
          throw new Error('Authentication expired. Please log in again.');
        }
      }

      const url = `${API_BASE}${endpoint}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      };

      if (this.token) {
        headers.Authorization = `Bearer ${this.token}`;
      }

      console.log('🔍 [REQUEST DEBUG] Making request to:', url);
      console.log('🔍 [REQUEST DEBUG] Method:', options.method || 'GET');
      console.log('🔍 [REQUEST DEBUG] Headers:', headers);
      console.log('🔍 [REQUEST DEBUG] Body:', options.body);

      const response = await fetch(url, {
        ...options,
        headers,
      });

      console.log('🔍 [REQUEST DEBUG] Response status:', response.status);
      console.log('🔍 [REQUEST DEBUG] Response headers:', Object.fromEntries(response.headers.entries()));

      // Handle 401 Unauthorized - try token refresh once
      if (response.status === 401 && retryCount === 0 && this.token) {
        console.log('🔄 Received 401, attempting token refresh...');
        const refreshed = await this.refreshToken();
        if (refreshed) {
          console.log('✅ Token refreshed, retrying request...');
          return this.request<T>(endpoint, options, retryCount + 1);
        } else {
          console.warn('⚠️ Token refresh failed, clearing auth data');
          this.clearToken();
          throw new Error('Authentication expired. Please log in again.');
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔍 [REQUEST DEBUG] Error response body:', errorText);
        
        // Create a structured error object for better handling
        const error = {
          response: {
            status: response.status,
            data: errorText
          },
          message: `API Error: ${response.status} ${errorText}`
        };
        
        const appError = handleApiError(error, `API request to ${endpoint}`);
        logError(appError, error);
        throw appError;
      }

      const responseData = await response.json();
      console.log('🔍 [REQUEST DEBUG] Success response:', responseData);
      return responseData;
    } catch (error) {
      // Handle network errors and other exceptions
      if (error instanceof Error && error.name === 'TypeError' && error.message.includes('fetch')) {
        const networkError = handleApiError(error, `Network error for ${endpoint}`);
        logError(networkError, error);
        throw networkError;
      }
      
      // Re-throw if it's already an AppError
      if (error && typeof error === 'object' && 'code' in error) {
        throw error;
      }
      
      // Handle other errors
      const appError = handleApiError(error, `Unexpected error for ${endpoint}`);
      logError(appError, error);
      throw appError;
    }
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
    
    // Store refresh token and expiry if provided
    if (data.refreshToken || data.refresh_token) {
      tokenStorage.setRefreshToken(data.refreshToken || data.refresh_token);
    }
    if (data.expiresIn || data.expires_in) {
      const expiresIn = data.expiresIn || data.expires_in;
      tokenStorage.setTokenExpiry(Date.now() + (expiresIn * 1000));
    }
    
    const userData = {
      id: data.user?.id || '1',
      email: data.user?.email || email,
      displayName: data.user?.displayName || email.split('@')[0],
      role: data.user?.role || 'SALESPERSON',
      isActive: data.user?.isActive !== false
    };
    
    userStorage.setUser(userData);
    
    return {
      token: token,
      refreshToken: data.refreshToken || data.refresh_token,
      expiresIn: data.expiresIn || data.expires_in,
      user: userData
    };
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
    } catch (error) {
      console.error('❌ Failed to load team data:', error);
      console.log('🔄 Returning null - user has no team data');
      
      // Return null instead of mock data when user has no teams
      return null;
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
    customerType?: string;
    location?: string;
    overallComment?: string;
    items: Array<{
      behaviorItemId: string;
      score: number;
      comment?: string;
      example?: string;
    }>;
    evaluationType?: string;
    clusterScores?: Array<{
      clusterId: string;
      score: number;
      weight: number;
    }>;
    overallScore?: number;
  }): Promise<Evaluation> {
    try {
      console.log('🔍 [API DEBUG] createEvaluation called with:', JSON.stringify(evaluationData, null, 2));
      console.log('🔍 [API DEBUG] Request URL:', `${API_BASE}/evaluations`);
      console.log('🔍 [API DEBUG] Request method: POST');
      
      const result = await this.request<Evaluation>('/evaluations', {
        method: 'POST',
        body: JSON.stringify(evaluationData)
      });
      
      console.log('🔍 [API DEBUG] createEvaluation success:', result);
      return result;
    } catch (error) {
      console.error('🔍 [API DEBUG] createEvaluation failed:', error);
      console.error('🔍 [API DEBUG] Error details:', JSON.stringify(error, null, 2));
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
      // Use the new backend endpoint with proper RBAC
      console.log('📡 Calling /organizations/salespeople...');
      const salespeople = await this.request<User[]>('/organizations/salespeople');
      console.log('✅ Found salespeople from backend:', salespeople);
      return salespeople;
    } catch (error) {
      console.error('❌ Error loading evaluatable users from backend:', error);
      
      // Fallback to old logic if backend fails
      console.log('⚠️ Falling back to old logic...');
      try {
        const currentUser = userStorage.getUser();
        if (!currentUser) {
          console.log('❌ No current user found in secure storage');
          throw new Error('No current user found');
        }
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
          console.log('⚠️ No team members found - Sales Lead has no managed teams');
          return [];
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
      } catch (fallbackError) {
        console.error('❌ Failed to load evaluatable users:', fallbackError);
        console.log('🔄 Using fallback mock data...');
      }
    }
    
    // If we reach here, the backend correctly returned an empty array
    // This means the user has no teams they manage, so return empty array
    console.log('✅ Backend correctly returned empty array - user has no managed teams');
    return [];
  }

  private getCurrentUserId(): string {
    const user = userStorage.getUser();
    if (user) {
      return user.id;
    }
    return '';
  }

  getCurrentUser(): User | null {
    return userStorage.getUser();
  }

  logout() {
    this.clearToken();
    userStorage.removeUser();
  }
}

export const apiService = new ApiService();
