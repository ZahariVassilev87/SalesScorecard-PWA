// Notification service for push notifications and browser notifications
// Handles permission requests, subscription management, and notification display

export interface NotificationPermission {
  granted: boolean;
  denied: boolean;
  default: boolean;
}

// Use the native PushSubscription type instead of custom interface

class NotificationService {
  private vapidPublicKey = process.env.REACT_APP_VAPID_PUBLIC_KEY || 
    'VhqYrM-RxeWY_ap4ps2pQymmC8ke_PGMnpdu7wotAM5pMylrzBtEFF0eTT24vh6REef4LJ5q7jJ3nZ2JkaD8kl0'; // VAPID key for testing

  constructor() {
    console.log('🔍 [DEBUG] NotificationService constructor - VAPID key:', this.vapidPublicKey);
    console.log('🔍 [DEBUG] Environment variable:', process.env.REACT_APP_VAPID_PUBLIC_KEY);
    console.log('🔍 [DEBUG] NEW VERSION 1.2.1 - Push notifications ENABLED');
  }

  // Check if notifications are supported
  public isSupported(): boolean {
    // Enable push notifications with VAPID key
    const hasNotification = 'Notification' in window;
    const hasServiceWorker = 'serviceWorker' in navigator;
    const hasPushManager = 'PushManager' in window;
    
    console.log('🔍 [DEBUG] Browser support check:', {
      hasNotification,
      hasServiceWorker,
      hasPushManager,
      vapidKey: this.vapidPublicKey ? 'Present' : 'Missing'
    });
    
    return hasNotification && hasServiceWorker && hasPushManager;
  }

  // Get current notification permission
  public getPermission(): NotificationPermission {
    if (!this.isSupported()) {
      return { granted: false, denied: true, default: false };
    }

    const permission = Notification.permission;
    return {
      granted: permission === 'granted',
      denied: permission === 'denied',
      default: permission === 'default'
    };
  }

  // Request notification permission
  public async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) {
      console.warn('Notifications not supported');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      console.log('Notification permission:', permission);
      return permission === 'granted';
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  }

  // Subscribe to push notifications
  public async subscribeToPush(): Promise<globalThis.PushSubscription | null> {
    console.log('🔍 [DEBUG] subscribeToPush called, VAPID key:', this.vapidPublicKey);
    
    // Early check for VAPID key
    if (!this.vapidPublicKey || this.vapidPublicKey.trim() === '') {
      console.warn('Notification Service: No VAPID key provided. Push notifications disabled.');
      return null;
    }

    if (!this.isSupported()) {
      console.warn('Push notifications not supported');
      return null;
    }

    try {
      // Request permission first
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        console.warn('Notification permission denied');
        return null;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;
      
      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
      });

      console.log('Push subscription successful:', subscription);
      
      // Store subscription locally
      this.storeSubscription(subscription);
      
      // Send subscription to server
      await this.sendSubscriptionToServer(subscription);
      
      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  }

  // Unsubscribe from push notifications
  public async unsubscribeFromPush(): Promise<boolean> {
    if (!this.isSupported()) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        this.removeStoredSubscription();
        await this.removeSubscriptionFromServer(subscription);
        console.log('Unsubscribed from push notifications');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      return false;
    }
  }

  // Check if user is subscribed
  public async isSubscribed(): Promise<boolean> {
    if (!this.isSupported()) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      return !!subscription;
    } catch (error) {
      console.error('Failed to check subscription status:', error);
      return false;
    }
  }

  // Get current push subscription
  public async getSubscription(): Promise<globalThis.PushSubscription | null> {
    if (!this.isSupported()) {
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      return subscription;
    } catch (error) {
      console.error('Failed to get subscription:', error);
      return null;
    }
  }

  // Show local notification
  public showNotification(title: string, options: NotificationOptions = {}): void {
    if (!this.isSupported() || !this.getPermission().granted) {
      console.warn('Cannot show notification - not supported or permission denied');
      return;
    }

    const defaultOptions: NotificationOptions = {
      icon: '/logo192.png',
      badge: '/logo192.png',
      vibrate: [100, 50, 100],
      requireInteraction: false,
      ...options
    };

    try {
      const notification = new Notification(title, defaultOptions);
      
      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

      // Handle click
      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      console.log('Local notification shown:', title);
    } catch (error) {
      console.error('Failed to show notification:', error);
    }
  }

  // Show evaluation reminder notification
  public showEvaluationReminder(userName: string): void {
    this.showNotification(
      '📝 Evaluation Reminder',
      {
        body: `Don't forget to complete the evaluation for ${userName}`,
        tag: 'evaluation-reminder',
        requireInteraction: true,
        actions: [
          {
            action: 'evaluate',
            title: 'Start Evaluation',
            icon: '/logo192.png'
          },
          {
            action: 'dismiss',
            title: 'Dismiss',
            icon: '/logo192.png'
          }
        ]
      }
    );
  }

  // Show sync completion notification
  public showSyncComplete(count: number): void {
    this.showNotification(
      '🔄 Sync Complete',
      {
        body: `${count} offline items have been synced successfully`,
        tag: 'sync-complete',
        icon: '/logo192.png'
      }
    );
  }

  // Show offline notification
  public showOfflineNotification(): void {
    this.showNotification(
      '📴 Working Offline',
      {
        body: 'Your data will sync when you\'re back online',
        tag: 'offline-mode',
        icon: '/logo192.png'
      }
    );
  }

  // Assessment-specific notifications
  public showNewAssessmentNotification(assessorName: string, assesseeName: string): void {
    this.showNotification('📝 New Assessment Received', {
      body: `${assessorName} has completed an assessment for ${assesseeName}`,
      tag: 'new-assessment',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      requireInteraction: true,
      actions: [
        {
          action: 'view',
          title: 'View Assessment',
          icon: '/icons/icon-96x96.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ]
    });
  }

  public showTeamAssessmentNotification(teamMemberName: string): void {
    this.showNotification('👥 Team Assessment Completed', {
      body: `${teamMemberName} has completed a new assessment`,
      tag: 'team-assessment',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      requireInteraction: true,
      actions: [
        {
          action: 'view',
          title: 'View Team',
          icon: '/icons/icon-96x96.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ]
    });
  }

  public showSalesLeadAssessmentNotification(salesLeadName: string): void {
    this.showNotification('🎯 Sales Lead Assessment', {
      body: `${salesLeadName} has completed an assessment in your region`,
      tag: 'sales-lead-assessment',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      requireInteraction: true,
      actions: [
        {
          action: 'view',
          title: 'View Assessment',
          icon: '/icons/icon-96x96.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ]
    });
  }

  // Show online notification
  public showOnlineNotification(): void {
    this.showNotification(
      '🌐 Back Online',
      {
        body: 'Syncing your offline data...',
        tag: 'online-mode',
        icon: '/logo192.png'
      }
    );
  }

  // Store subscription locally
  private storeSubscription(subscription: globalThis.PushSubscription): void {
    try {
      localStorage.setItem('pushSubscription', JSON.stringify(subscription));
    } catch (error) {
      console.error('Failed to store push subscription:', error);
    }
  }

  // Remove stored subscription
  private removeStoredSubscription(): void {
    try {
      localStorage.removeItem('pushSubscription');
    } catch (error) {
      console.error('Failed to remove push subscription:', error);
    }
  }

  // Get stored subscription
  public getStoredSubscription(): globalThis.PushSubscription | null {
    try {
      const stored = localStorage.getItem('pushSubscription');
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to get stored push subscription:', error);
      return null;
    }
  }

  // Send subscription to server
  private async sendSubscriptionToServer(subscription: globalThis.PushSubscription): Promise<void> {
    try {
      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('userToken')}`
        },
        body: JSON.stringify({
          subscription,
          userId: localStorage.getItem('userId')
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('Push subscription sent to server successfully');
    } catch (error) {
      console.error('Failed to send subscription to server:', error);
      // Don't throw - subscription is still valid locally
    }
  }

  // Remove subscription from server
  private async removeSubscriptionFromServer(subscription: globalThis.PushSubscription): Promise<void> {
    try {
      const response = await fetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('userToken')}`
        },
        body: JSON.stringify({
          subscription,
          userId: localStorage.getItem('userId')
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('Push subscription removed from server successfully');
    } catch (error) {
      console.error('Failed to remove subscription from server:', error);
    }
  }

  // Convert VAPID key to Uint8Array
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    console.log('🔍 [DEBUG] Converting VAPID key:', base64String);
    
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    console.log('🔍 [DEBUG] VAPID key converted to Uint8Array, length:', outputArray.length);
    return outputArray;
  }

  // Initialize notification service
  public async initialize(): Promise<void> {
    if (!this.isSupported()) {
      console.log('Notifications not supported');
      return;
    }

    // Check if we have a stored subscription
    const storedSubscription = this.getStoredSubscription();
    if (storedSubscription) {
      console.log('Found stored push subscription');
      // Verify subscription is still valid
      const registration = await navigator.serviceWorker.ready;
      const currentSubscription = await registration.pushManager.getSubscription();
      
      if (!currentSubscription) {
        console.log('Stored subscription is no longer valid, removing...');
        this.removeStoredSubscription();
      }
    }

    // Set up notification click handlers
    this.setupNotificationHandlers();
  }

  // Set up notification click handlers
  private setupNotificationHandlers(): void {
    // Handle notification clicks when app is already open
    window.addEventListener('notificationclick', (event: any) => {
      console.log('Notification clicked:', event);
      
      if (event.notification) {
        event.notification.close();
      }
      
      if (event.action === 'evaluate') {
        // Navigate to evaluation form
        window.location.hash = '#evaluation';
      } else if (event.action === 'view') {
        // Navigate based on notification tag
        if (event.notification.tag === 'new-assessment') {
          window.location.hash = '#history';
        } else if (event.notification.tag === 'team-assessment') {
          window.location.hash = '#team';
        } else if (event.notification.tag === 'sales-lead-assessment') {
          window.location.hash = '#history';
        } else {
          window.location.hash = '#dashboard';
        }
      } else if (event.action === 'dismiss') {
        // Just close the notification
        return;
      } else {
        // Default action - focus the app
        window.focus();
      }
    });
  }

  // Get notification settings
  public getSettings(): {
    supported: boolean;
    permission: NotificationPermission;
    subscribed: boolean;
  } {
    return {
      supported: this.isSupported(),
      permission: this.getPermission(),
      subscribed: false // This would need to be async to check properly
    };
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
