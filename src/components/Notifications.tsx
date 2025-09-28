import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { notificationService } from '../utils/notificationService';

const Notifications: React.FC = () => {
  const { t } = useTranslation();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isLoading, setIsLoading] = useState(true);
  const [isPushSupported, setIsPushSupported] = useState(false);

  useEffect(() => {
    const checkNotificationStatus = async () => {
      try {
        const supported = notificationService.isSupported();
        console.log('🔍 [DEBUG] Notifications component - isSupported:', supported);
        setIsPushSupported(supported);
        
        if (supported) {
          // Check if user is subscribed to push notifications
          const subscription = await notificationService.getSubscription();
          console.log('🔍 [DEBUG] Notifications component - subscription:', subscription);
          setIsSubscribed(!!subscription);
          setPermission(Notification.permission);
        }
      } catch (error) {
        console.error('Failed to check notification status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkNotificationStatus();
  }, []);

  const handleToggleNotifications = async () => {
    try {
      if (isSubscribed) {
        // Unsubscribe from push notifications
        await notificationService.unsubscribeFromPush();
        setIsSubscribed(false);
        notificationService.showNotification('🔔 Notifications Disabled', {
          body: 'You have been unsubscribed from push notifications.'
        });
      } else {
        // Subscribe to push notifications
        const subscription = await notificationService.subscribeToPush();
        if (subscription) {
          setIsSubscribed(true);
          notificationService.showNotification('🔔 Notifications Enabled', {
            body: 'You will now receive push notifications for important updates.'
          });
        }
      }
    } catch (error) {
      console.error('Failed to toggle notifications:', error);
    }
  };

  const handleRequestPermission = async () => {
    try {
      const newPermission = await Notification.requestPermission();
      setPermission(newPermission);
      if (newPermission === 'granted') {
        // Automatically subscribe to push notifications after permission granted
        const subscription = await notificationService.subscribeToPush();
        if (subscription) {
          setIsSubscribed(true);
          notificationService.showNotification('🔔 Notifications Enabled', {
            body: 'You will now receive push notifications for important updates.'
          });
        }
      }
    } catch (error) {
      console.error('Failed to request permission:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="notifications-page">
      <div className="page-header">
        <h1>🔔 Notifications</h1>
        <p>Manage your push notification preferences</p>
      </div>

      <div className="notification-settings">
        <div className="setting-card">
          <div className="setting-header">
            <h3>Push Notifications</h3>
            <div className={`status-badge ${!isPushSupported ? 'unavailable' : isSubscribed ? 'enabled' : 'disabled'}`}>
              {!isPushSupported ? 'Unavailable' : isSubscribed ? 'Enabled' : 'Disabled'}
            </div>
          </div>
          
          <div className="setting-content">
                    <p>
                      {!isPushSupported
                        ? 'Push notifications are not supported in this browser.'
                        : isSubscribed
                          ? 'You will receive push notifications for important updates and events.'
                          : 'Enable push notifications to stay updated with important information.'
                      }
                    </p>
            
            <div className="permission-status">
              <strong>Permission Status:</strong> 
              <span className={`permission-badge ${permission}`}>
                {permission === 'granted' ? 'Granted' : 
                 permission === 'denied' ? 'Denied' : 'Not Requested'}
              </span>
            </div>

                    <div className="setting-actions">
                      {!isPushSupported ? (
                        <button
                          className="btn-secondary"
                          disabled
                        >
                          Push Notifications Unavailable
                        </button>
                      ) : permission === 'default' ? (
                        <button
                          className="btn-primary"
                          onClick={handleRequestPermission}
                        >
                          Request Permission
                        </button>
                      ) : (
                        <button
                          className={`btn-${isSubscribed ? 'secondary' : 'primary'}`}
                          onClick={handleToggleNotifications}
                        >
                          {isSubscribed ? 'Disable Notifications' : 'Enable Notifications'}
                        </button>
                      )}
                      
                      {/* Debug Test Button */}
                      <button
                        className="btn-secondary"
                        onClick={async () => {
                          console.log('🔍 [DEBUG] Manual test - Browser support:', {
                            hasNotification: 'Notification' in window,
                            hasServiceWorker: 'serviceWorker' in navigator,
                            hasPushManager: 'PushManager' in window,
                            permission: Notification.permission,
                            isSecureContext: window.isSecureContext,
                            protocol: window.location.protocol,
                            hostname: window.location.hostname
                          });
                          
                          // Check service worker registration
                          if ('serviceWorker' in navigator) {
                            try {
                              const registration = await navigator.serviceWorker.ready;
                              console.log('🔍 [DEBUG] Service Worker ready:', registration);
                              console.log('🔍 [DEBUG] Service Worker scope:', registration.scope);
                              console.log('🔍 [DEBUG] Service Worker active:', registration.active);
                            } catch (error) {
                              console.log('🔍 [DEBUG] Service Worker error:', error);
                            }
                          }
                          
                          // Test local notification
                          if ('Notification' in window && Notification.permission === 'granted') {
                            new Notification('Test Notification', {
                              body: 'This is a test notification',
                              icon: '/icons/icon-192x192.png'
                            });
                          } else {
                            console.log('🔍 [DEBUG] Cannot show notification - permission:', Notification.permission);
                          }
                        }}
                        style={{ marginTop: '10px', fontSize: '0.8rem' }}
                      >
                        🧪 Test Notifications
                      </button>
                    </div>
          </div>
        </div>

        <div className="notification-info">
          <h3>About Notifications</h3>
          <ul>
            <li>📱 <strong>Online/Offline Status:</strong> Get notified when you go online or offline</li>
            <li>🎉 <strong>App Installation:</strong> Confirmation when the app is installed</li>
            <li>🔄 <strong>Data Sync:</strong> Notifications about data synchronization</li>
            <li>⚡ <strong>Performance Updates:</strong> Important performance alerts</li>
            <li>📝 <strong>New Assessments:</strong> Get notified when you receive a new assessment</li>
            <li>👥 <strong>Team Activity:</strong> Notifications when team members complete assessments</li>
            <li>🎯 <strong>Regional Updates:</strong> Sales leads completing assessments in your region</li>
          </ul>
                  <p style={{ marginTop: '16px', padding: '12px', backgroundColor: 'var(--blue-100)', borderRadius: '8px', fontSize: '0.9rem' }}>
                    <strong>Note:</strong> Push notifications are now enabled! You can receive notifications even when the app is not open. For full functionality, a backend server is recommended for sending notifications across devices.
                  </p>
        </div>
      </div>
    </div>
  );
};

export default Notifications;
