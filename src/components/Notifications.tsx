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
        setIsPushSupported(supported);
        
        if (supported) {
          // Push notifications are disabled, so always set to false
          setIsSubscribed(false);
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
      // Push notifications are disabled, just show a message
      notificationService.showNotification('🔔 Notifications', {
        body: 'Push notifications are currently disabled. Local notifications are still active for assessment events.'
      });
    } catch (error) {
      console.error('Failed to toggle notifications:', error);
    }
  };

  const handleRequestPermission = async () => {
    try {
      const newPermission = await Notification.requestPermission();
      setPermission(newPermission);
      if (newPermission === 'granted') {
        // Push notifications are disabled, just show a message
        notificationService.showNotification('🔔 Notifications', {
          body: 'Push notifications are currently disabled. Local notifications are still active for assessment events.'
        });
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
                ? 'Push notifications are not supported in this browser or require a valid VAPID key to be configured. For now, you can still receive local notifications when assessments are completed.'
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
            <strong>Note:</strong> Currently, notifications work as local browser notifications. Push notifications require a backend server with VAPID keys to work across devices.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Notifications;
