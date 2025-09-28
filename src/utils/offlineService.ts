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

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('🌐 App is online - triggering sync');
      this.triggerSync();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('📴 App is offline');
    });
  }

  // Check if app is online
  public isAppOnline(): boolean {
    return this.isOnline;
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

    if (!this.isOnline) {
      console.log('📴 Cannot sync - app is offline');
      return;
    }

    this.syncInProgress = true;
    console.log('🔄 Starting manual sync...');

    try {
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
    } catch (error) {
      console.error('❌ Failed to trigger sync:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  // Perform immediate sync
  private async performImmediateSync(): Promise<void> {
    const evaluations = this.getStoredEvaluations().filter(e => e.status === 'pending');
    const updates = this.getStoredUserUpdates().filter(u => u.status === 'pending');

    console.log(`🔄 Syncing ${evaluations.length} evaluations and ${updates.length} updates`);

    // Sync evaluations
    for (const evaluation of evaluations) {
      try {
        await this.syncEvaluation(evaluation);
      } catch (error) {
        console.error('❌ Failed to sync evaluation:', evaluation.id, error);
      }
    }

    // Sync user updates
    for (const update of updates) {
      try {
        await this.syncUserUpdate(update);
      } catch (error) {
        console.error('❌ Failed to sync user update:', update.id, error);
      }
    }
  }

  // Sync individual evaluation
  private async syncEvaluation(evaluation: OfflineEvaluation): Promise<void> {
    try {
      const response = await fetch('/api/evaluations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${evaluation.token}`
        },
        body: JSON.stringify(evaluation.data)
      });

      if (response.ok) {
        this.removeStoredEvaluation(evaluation.id);
        console.log('✅ Evaluation synced successfully:', evaluation.id);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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
