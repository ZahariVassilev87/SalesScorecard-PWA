// Offline service for handling offline functionality
// Provides utilities for offline data storage and sync

export interface OfflineEvaluation {
  id: string;
  data: any;
  token: string;
  timestamp: number;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
}

export interface OfflineUserUpdate {
  id: string;
  endpoint: string;
  method: string;
  data: any;
  token: string;
  timestamp: number;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
}

class OfflineService {
  private isOnline: boolean = navigator.onLine;
  private syncInProgress: boolean = false;
  private lastOnlineCheck: number = 0;
  private onlineCheckInterval: number = 30000; // Check every 30 seconds

  constructor() {
    this.setupEventListeners();
    this.performOnlineCheck(); // Initial check
  }

  private setupEventListeners(): void {
    window.addEventListener('online', () => {
      console.log('🌐 Browser reports online - verifying connection');
      this.performOnlineCheck();
      // Auto-sync when coming online
      this.autoSyncWhenOnline();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('📴 Browser reports offline');
    });

    // Periodic online check - TEMPORARILY DISABLED FOR PWA DEBUGGING
    // setInterval(() => {
    //   this.performOnlineCheck();
    // }, this.onlineCheckInterval);

    // Auto-sync on app startup if online
    setTimeout(() => {
      if (this.isOnline) {
        this.autoSyncWhenOnline();
      }
    }, 2000); // Wait 2 seconds after app starts
  }

  // Perform actual online check by pinging the API
  private async performOnlineCheck(): Promise<void> {
    const now = Date.now();
    
    // Don't check too frequently
    if (now - this.lastOnlineCheck < 5000) {
      return;
    }
    
    this.lastOnlineCheck = now;
    
    // First check browser's online status
    if (!navigator.onLine) {
      const wasOnline = this.isOnline;
      this.isOnline = false;
      if (wasOnline) {
        console.log('📴 Browser reports offline');
      }
      return;
    }
    
    // If browser says online, trust it for basic connectivity
    const wasOffline = !this.isOnline;
    this.isOnline = true;
    
    if (wasOffline) {
      console.log('🌐 Browser reports online - app is online');
      this.triggerSync();
    }
  }

  // Check if app is online
  public isAppOnline(): boolean {
    return this.isOnline;
  }

  // Force online check
  public async checkOnlineStatus(): Promise<boolean> {
    // Simply use navigator.onLine for online status
    this.isOnline = navigator.onLine;
    return this.isOnline;
  }

  // Update stored evaluations with fresh token
  public updateStoredEvaluationsToken(oldToken: string, newToken: string): void {
    try {
      const evaluations = this.getStoredEvaluations();
      const updatedEvaluations = evaluations.map(evaluation => {
        if (evaluation.token === oldToken) {
          return { ...evaluation, token: newToken };
        }
        return evaluation;
      });
      
      localStorage.setItem('offlineEvaluations', JSON.stringify(updatedEvaluations));
      console.log('🔄 Updated stored evaluations with fresh token');
    } catch (error) {
      console.error('❌ Failed to update stored evaluations token:', error);
    }
  }

  // Check if current user token is valid
  public async isCurrentTokenValid(): Promise<boolean> {
    try {
      const currentToken = localStorage.getItem('userToken');
      if (!currentToken) {
        return false;
      }

      // Use a lightweight endpoint to check token validity
      const response = await fetch('https://api.scorecard.instorm.io/auth/verify', {
        method: 'HEAD',
        headers: {
          'Authorization': `Bearer ${currentToken}`
        }
      });

      return response.status !== 401;
    } catch (error) {
      console.error('❌ Failed to check token validity:', error);
      return false;
    }
  }

  // Store evaluation for offline sync
  public async storeEvaluationOffline(evaluationData: any, token: string): Promise<string> {
    const evaluation: OfflineEvaluation = {
      id: `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      data: evaluationData,
      token,
      timestamp: Date.now(),
      status: 'pending'
    };

    try {
      // Store in localStorage as backup
      const existingEvaluations = this.getStoredEvaluations();
      existingEvaluations.push(evaluation);
      localStorage.setItem('offlineEvaluations', JSON.stringify(existingEvaluations));

      // Notify service worker
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'STORE_OFFLINE_EVALUATION',
          evaluation
        });
      }

      console.log('📝 Evaluation stored for offline sync:', evaluation.id);
      
      // Auto-sync if online
      if (this.isOnline) {
        console.log('🔄 Auto-syncing newly stored evaluation');
        this.autoSyncWhenOnline();
      }
      
      return evaluation.id;
    } catch (error) {
      console.error('❌ Failed to store evaluation offline:', error);
      throw error;
    }
  }

  // Store user update for offline sync
  public async storeUserUpdateOffline(
    endpoint: string, 
    method: string, 
    data: any, 
    token: string
  ): Promise<string> {
    const update: OfflineUserUpdate = {
      id: `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      endpoint,
      method,
      data,
      token,
      timestamp: Date.now(),
      status: 'pending'
    };

    try {
      // Store in localStorage as backup
      const existingUpdates = this.getStoredUserUpdates();
      existingUpdates.push(update);
      localStorage.setItem('offlineUserUpdates', JSON.stringify(existingUpdates));

      // Notify service worker
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'STORE_OFFLINE_USER_UPDATE',
          update
        });
      }

      console.log('👤 User update stored for offline sync:', update.id);
      return update.id;
    } catch (error) {
      console.error('❌ Failed to store user update offline:', error);
      throw error;
    }
  }

  // Get stored evaluations
  public getStoredEvaluations(): OfflineEvaluation[] {
    try {
      const stored = localStorage.getItem('offlineEvaluations');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('❌ Failed to get stored evaluations:', error);
      return [];
    }
  }

  // Get stored user updates
  public getStoredUserUpdates(): OfflineUserUpdate[] {
    try {
      const stored = localStorage.getItem('offlineUserUpdates');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('❌ Failed to get stored user updates:', error);
      return [];
    }
  }

  // Remove stored evaluation
  public removeStoredEvaluation(id: string): void {
    try {
      const evaluations = this.getStoredEvaluations();
      const filtered = evaluations.filter(evaluation => evaluation.id !== id);
      localStorage.setItem('offlineEvaluations', JSON.stringify(filtered));
    } catch (error) {
      console.error('❌ Failed to remove stored evaluation:', error);
    }
  }

  // Remove stored user update
  public removeStoredUserUpdate(id: string): void {
    try {
      const updates = this.getStoredUserUpdates();
      const filtered = updates.filter(update => update.id !== id);
      localStorage.setItem('offlineUserUpdates', JSON.stringify(filtered));
    } catch (error) {
      console.error('❌ Failed to remove stored user update:', error);
    }
  }

  // Get pending items count
  public getPendingItemsCount(): number {
    const evaluations = this.getStoredEvaluations();
    const updates = this.getStoredUserUpdates();
    return evaluations.filter(e => e.status === 'pending').length + 
           updates.filter(u => u.status === 'pending').length;
  }

  // Trigger manual sync
  public async triggerSync(): Promise<void> {
    if (this.syncInProgress) {
      console.log('🔄 Sync already in progress');
      return;
    }

    // Check if we're online using navigator.onLine
    if (!navigator.onLine) {
      console.log('📴 Cannot sync - app is offline');
      throw new Error('App is offline - please check your internet connection');
    }

    this.syncInProgress = true;
    console.log('🔄 Starting manual sync...');

    try {
      // Check current pending items
      const status = this.getOfflineStatus();
      console.log('🔍 Current pending items:', status);

      // Register background sync
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        const registration = await navigator.serviceWorker.ready;
        if ('sync' in registration && registration.sync) {
          await (registration as any).sync.register('background-sync');
          console.log('✅ Background sync registered');
        }
      }

      // Also try immediate sync
      await this.performImmediateSync();
      
      // Check status after sync
      const newStatus = this.getOfflineStatus();
      console.log('🔍 Pending items after sync:', newStatus);
    } catch (error) {
      console.error('❌ Failed to trigger sync:', error);
      throw error; // Re-throw to let the UI handle it
    } finally {
      this.syncInProgress = false;
    }
  }

  // Auto-sync when coming online (silent, no UI feedback)
  private async autoSyncWhenOnline(): Promise<void> {
    if (this.syncInProgress) {
      console.log('🔄 Auto-sync skipped - manual sync in progress');
      return;
    }

    // Check if we have pending items
    const status = this.getOfflineStatus();
    if (status.totalPending === 0) {
      console.log('🔄 Auto-sync skipped - no pending items');
      return;
    }

    console.log('🔄 Starting automatic sync...');
    this.syncInProgress = true;

    try {
      // Try immediate sync first
      await this.performImmediateSync();
      
      // Check if we still have pending items
      const newStatus = this.getOfflineStatus();
      if (newStatus.totalPending > 0) {
        console.log('🔄 Auto-sync: Some items still pending, registering background sync');
        // Register background sync for remaining items
        if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
          const registration = await navigator.serviceWorker.ready;
          if ('sync' in registration && registration.sync) {
            await (registration as any).sync.register('background-sync');
            console.log('✅ Background sync registered for remaining items');
          }
        }
      } else {
        console.log('✅ Auto-sync completed successfully');
      }
    } catch (error) {
      console.error('❌ Auto-sync failed:', error);
      // Don't throw - this is automatic, we don't want to break the app
    } finally {
      this.syncInProgress = false;
    }
  }

  // Perform immediate sync
  private async performImmediateSync(): Promise<void> {
    const evaluations = this.getStoredEvaluations().filter(e => e.status === 'pending');
    const updates = this.getStoredUserUpdates().filter(u => u.status === 'pending');

    console.log(`🔄 Syncing ${evaluations.length} evaluations and ${updates.length} updates`);
    console.log('🔍 Pending evaluations:', evaluations);
    console.log('🔍 Pending updates:', updates);

    // Sync evaluations
    for (const evaluation of evaluations) {
      try {
        console.log('🔄 Syncing evaluation:', evaluation.id);
        await this.syncEvaluation(evaluation);
        console.log('✅ Evaluation synced successfully:', evaluation.id);
      } catch (error) {
        console.error('❌ Failed to sync evaluation:', evaluation.id, error);
      }
    }

    // Sync user updates
    for (const update of updates) {
      try {
        console.log('🔄 Syncing user update:', update.id);
        await this.syncUserUpdate(update);
        console.log('✅ User update synced successfully:', update.id);
      } catch (error) {
        console.error('❌ Failed to sync user update:', update.id, error);
      }
    }
  }

  // Sync individual evaluation
  private async syncEvaluation(evaluation: OfflineEvaluation): Promise<void> {
    try {
      console.log('🔍 Syncing evaluation data:', evaluation.data);
      
      // Always use current token for sync (more reliable)
      const currentToken = localStorage.getItem('userToken');
      if (!currentToken) {
        throw new Error('No authentication token available');
      }
      
      // Validate token format (should be JWT)
      if (!currentToken.includes('.')) {
        console.error('❌ Invalid token format - not a JWT token');
        console.log('🗑️ Removing evaluation with invalid token from offline storage');
        this.removeEvaluationFromStorage(evaluation.id);
        throw new Error('Invalid token format - evaluation removed from offline storage');
      }
      
      console.log('🔍 Using current token for sync');
      console.log('🔍 Token preview:', currentToken.substring(0, 50) + '...');
      
      let response = await fetch('https://api.scorecard.instorm.io/evaluations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`
        },
        body: JSON.stringify(evaluation.data)
      });

      console.log('🔍 Sync response status:', response.status);
      console.log('🔍 Sync response headers:', Object.fromEntries(response.headers.entries()));

      // If 401 Unauthorized, try with current token
      if (response.status === 401) {
        console.log('🔄 Token expired, trying with current token...');
        const currentToken = localStorage.getItem('userToken');
        
        console.log('🔍 Stored token (first 20 chars):', evaluation.token ? evaluation.token.substring(0, 20) + '...' : 'null');
        console.log('🔍 Current token (first 20 chars):', currentToken ? currentToken.substring(0, 20) + '...' : 'null');
        console.log('🔍 Tokens are different:', currentToken !== evaluation.token);
        
        if (currentToken && currentToken !== evaluation.token) {
          console.log('🔍 Using current token for sync');
          
          // Test if current token works with a simple API call
          try {
            const testResponse = await fetch('https://api.scorecard.instorm.io/organizations/salespeople', {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
              }
            });
            console.log('🔍 Token test response status:', testResponse.status);
            if (testResponse.status === 401) {
              console.log('❌ Current token is also invalid - login may have failed');
            } else {
              console.log('✅ Current token appears to be valid');
            }
          } catch (testError) {
            console.log('🔍 Token test failed:', testError);
          }
          
          // Test if current token works with evaluations endpoint (empty POST)
          try {
            const evalTestResponse = await fetch('https://api.scorecard.instorm.io/evaluations', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
              },
              body: JSON.stringify({})
            });
            console.log('🔍 Evaluations endpoint test status:', evalTestResponse.status);
            if (evalTestResponse.status === 401) {
              console.log('❌ Current token lacks permissions for evaluations endpoint');
              console.log('⚠️ Token expired, skipping evaluation sync...');
              throw new Error('Authentication failed - please log in again');
            } else if (evalTestResponse.status === 400) {
              console.log('✅ Current token has permissions for evaluations (400 = bad request, not auth)');
            } else {
              console.log('🔍 Evaluations endpoint response:', evalTestResponse.status);
            }
          } catch (evalTestError) {
            console.log('🔍 Evaluations endpoint test failed:', evalTestError);
          }
          
          response = await fetch('https://api.scorecard.instorm.io/evaluations', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify(evaluation.data)
          });
          
          console.log('🔍 Retry response status:', response.status);
        }
      }

      if (response.ok) {
        this.removeStoredEvaluation(evaluation.id);
        console.log('✅ Evaluation synced successfully:', evaluation.id);
      } else {
        const errorText = await response.text();
        console.error('❌ Sync failed with response:', errorText);
        
        // If still 401, the current token is also invalid
        if (response.status === 401) {
          console.error('❌ Current token is also invalid - user may need to re-login');
          // Don't remove the evaluation, keep it for later sync
          throw new Error('Authentication failed - please log in again');
        }
        
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }
    } catch (error) {
      console.error('❌ Failed to sync evaluation:', evaluation.id, error);
      throw error;
    }
  }

  // Sync individual user update
  private async syncUserUpdate(update: OfflineUserUpdate): Promise<void> {
    try {
      const response = await fetch(update.endpoint, {
        method: update.method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${update.token}`
        },
        body: JSON.stringify(update.data)
      });

      if (response.ok) {
        this.removeStoredUserUpdate(update.id);
        console.log('✅ User update synced successfully:', update.id);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('❌ Failed to sync user update:', update.id, error);
      throw error;
    }
  }

  // Clear all offline data
  public clearAllOfflineData(): void {
    try {
      localStorage.removeItem('offlineEvaluations');
      localStorage.removeItem('offlineUserUpdates');
      console.log('🗑️ All offline data cleared');
    } catch (error) {
      console.error('❌ Failed to clear offline data:', error);
    }
  }

  // Remove a specific evaluation from storage
  private removeEvaluationFromStorage(evaluationId: string): void {
    try {
      const evaluations = this.getStoredEvaluations();
      const filteredEvaluations = evaluations.filter(e => e.id !== evaluationId);
      localStorage.setItem('offlineEvaluations', JSON.stringify(filteredEvaluations));
      console.log('🗑️ Removed evaluation from storage:', evaluationId);
    } catch (error) {
      console.error('❌ Failed to remove evaluation from storage:', error);
    }
  }

  // Clear offline data with invalid tokens
  public clearInvalidTokenData(): void {
    const currentToken = localStorage.getItem('userToken');
    
    // If current token is invalid, clear all offline data
    if (!currentToken || !currentToken.includes('.')) {
      console.log('🗑️ Clearing offline data due to invalid token');
      this.clearAllOfflineData();
      return;
    }

    // Filter out evaluations with invalid tokens
    const evaluations = JSON.parse(localStorage.getItem('offlineEvaluations') || '[]');
    const validEvaluations = evaluations.filter((evaluation: OfflineEvaluation) => {
      return evaluation.token && evaluation.token.includes('.');
    });

    if (validEvaluations.length !== evaluations.length) {
      console.log(`🗑️ Removed ${evaluations.length - validEvaluations.length} evaluations with invalid tokens`);
      localStorage.setItem('offlineEvaluations', JSON.stringify(validEvaluations));
    }
  }

  // Clear offline data for specific user (when user logs out)
  public clearUserOfflineData(userToken: string): void {
    try {
      const evaluations = this.getStoredEvaluations();
      const updates = this.getStoredUserUpdates();
      
      // Remove evaluations and updates for this user
      const filteredEvaluations = evaluations.filter(e => e.token !== userToken);
      const filteredUpdates = updates.filter(u => u.token !== userToken);
      
      localStorage.setItem('offlineEvaluations', JSON.stringify(filteredEvaluations));
      localStorage.setItem('offlineUserUpdates', JSON.stringify(filteredUpdates));
      
      console.log('🗑️ Offline data cleared for user');
    } catch (error) {
      console.error('❌ Failed to clear user offline data:', error);
    }
  }

  // Get offline status info
  public getOfflineStatus(): {
    isOnline: boolean;
    pendingEvaluations: number;
    pendingUpdates: number;
    totalPending: number;
  } {
    const evaluations = this.getStoredEvaluations().filter(e => e.status === 'pending');
    const updates = this.getStoredUserUpdates().filter(u => u.status === 'pending');

    return {
      isOnline: this.isOnline,
      pendingEvaluations: evaluations.length,
      pendingUpdates: updates.length,
      totalPending: evaluations.length + updates.length
    };
  }
}

// Export singleton instance
export const offlineService = new OfflineService();
