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
    <div className="page-container">
      <div className="page-header">
        <h1>🔔 {t('navigation.notifications')}</h1>
        <p className="page-subtitle">{t('notifications.subtitle', 'Stay updated with important alerts')}</p>
      </div>

      {/* Status Card */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--gray-900)', margin: 0 }}>
            Push Notifications
          </h2>
          <div className={`status-badge ${!isPushSupported ? 'unavailable' : isSubscribed ? 'enabled' : 'disabled'}`}
               style={{
                 padding: 'var(--space-2) var(--space-4)',
                 borderRadius: '20px',
                 fontSize: '0.875rem',
                 fontWeight: '600',
                 backgroundColor: !isPushSupported ? 'var(--gray-200)' : isSubscribed ? 'var(--success-50)' : 'var(--warning-50)',
                 color: !isPushSupported ? 'var(--gray-600)' : isSubscribed ? 'var(--success-600)' : 'var(--warning-600)'
               }}>
            {!isPushSupported ? '❌ Unavailable' : isSubscribed ? '✅ Enabled' : '⚠️ Disabled'}
          </div>
        </div>
        
        <p style={{ color: 'var(--gray-600)', marginBottom: 'var(--space-6)', lineHeight: '1.5' }}>
          {!isPushSupported
            ? 'Push notifications are not supported in this browser. Try using a modern browser like Chrome, Safari, or Firefox.'
            : isSubscribed
              ? 'You are currently receiving push notifications for important updates and events.'
              : 'Enable push notifications to stay informed about important updates, team activities, and new assessments.'
          }
        </p>
        
        {/* Permission Status */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          padding: 'var(--space-4)', 
          backgroundColor: 'var(--gray-50)', 
          borderRadius: '8px',
          marginBottom: 'var(--space-6)'
        }}>
          <div style={{ 
            width: '48px', 
            height: '48px', 
            borderRadius: '50%', 
            backgroundColor: permission === 'granted' ? 'var(--success-100)' : permission === 'denied' ? 'var(--error-100)' : 'var(--gray-200)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 'var(--space-4)',
            fontSize: '1.5rem'
          }}>
            {permission === 'granted' ? '✅' : permission === 'denied' ? '❌' : '🔔'}
          </div>
          <div>
            <div style={{ fontWeight: '600', color: 'var(--gray-900)', marginBottom: 'var(--space-1)' }}>
              Permission Status
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>
              {permission === 'granted' ? 'Permission Granted' : 
               permission === 'denied' ? 'Permission Denied' : 'Permission Not Requested'}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {!isPushSupported ? (
            <button
              className="btn-secondary"
              disabled
              style={{ opacity: 0.5, cursor: 'not-allowed' }}
            >
              <span style={{ marginRight: 'var(--space-2)' }}>🚫</span>
              Notifications Not Supported
            </button>
          ) : permission === 'default' ? (
            <button
              className="btn-primary"
              onClick={handleRequestPermission}
              style={{
                background: 'linear-gradient(135deg, var(--primary-600), var(--primary-700))',
                padding: 'var(--space-4)',
                fontSize: '1rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <span style={{ marginRight: 'var(--space-2)' }}>🔔</span>
              Enable Notifications
            </button>
          ) : permission === 'denied' ? (
            <div style={{ 
              padding: 'var(--space-4)', 
              backgroundColor: 'var(--error-50)', 
              borderRadius: '8px',
              border: '1px solid var(--error-200)'
            }}>
              <p style={{ color: 'var(--error-600)', margin: 0, fontSize: '0.875rem' }}>
                ❌ Notifications are blocked. Please enable them in your browser settings.
              </p>
            </div>
          ) : (
            <>
              <button
                className={isSubscribed ? 'btn-secondary' : 'btn-primary'}
                onClick={handleToggleNotifications}
                style={{
                  background: isSubscribed ? 'var(--gray-100)' : 'linear-gradient(135deg, var(--primary-600), var(--primary-700))',
                  color: isSubscribed ? 'var(--gray-700)' : 'white',
                  padding: 'var(--space-4)',
                  fontSize: '1rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <span style={{ marginRight: 'var(--space-2)' }}>
                  {isSubscribed ? '🔕' : '🔔'}
                </span>
                {isSubscribed ? 'Disable Notifications' : 'Enable Notifications'}
              </button>
              
              {isSubscribed && (
                <button
                  className="btn-secondary"
                  onClick={async () => {
                    console.log('🔍 [DEBUG] Testing notification...');
                    await notificationService.showNotification('🧪 Test Notification', {
                      body: 'This is a test notification from Sales Scorecard!',
                      icon: '/icons/icon-192x192.png'
                    });
                  }}
                  style={{
                    padding: 'var(--space-3)',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <span style={{ marginRight: 'var(--space-2)' }}>🧪</span>
                  Send Test Notification
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Features Info Cards */}
      <h2 style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--gray-900)', marginBottom: 'var(--space-4)' }}>
        What You'll Receive
      </h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* Assessment Notifications */}
        <div className="card" style={{ 
          background: 'linear-gradient(135deg, #667eea15, #764ba215)',
          border: '1px solid #667eea30'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{ 
              fontSize: '2rem', 
              marginRight: 'var(--space-4)',
              minWidth: '48px',
              textAlign: 'center'
            }}>
              📝
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--gray-900)', marginBottom: 'var(--space-2)' }}>
                New Assessments
              </h3>
              <p style={{ color: 'var(--gray-600)', fontSize: '0.875rem', margin: 0 }}>
                Get notified when you receive a new behavior assessment to complete
              </p>
            </div>
          </div>
        </div>

        {/* Team Activity */}
        <div className="card" style={{ 
          background: 'linear-gradient(135deg, #22c55e15, #16a34a15)',
          border: '1px solid #22c55e30'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{ 
              fontSize: '2rem', 
              marginRight: 'var(--space-4)',
              minWidth: '48px',
              textAlign: 'center'
            }}>
              👥
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--gray-900)', marginBottom: 'var(--space-2)' }}>
                Team Updates
              </h3>
              <p style={{ color: 'var(--gray-600)', fontSize: '0.875rem', margin: 0 }}>
                Stay informed when team members complete assessments or when there are team changes
              </p>
            </div>
          </div>
        </div>

        {/* Performance Alerts */}
        <div className="card" style={{ 
          background: 'linear-gradient(135deg, #f59e0b15, #d9770615)',
          border: '1px solid #f59e0b30'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{ 
              fontSize: '2rem', 
              marginRight: 'var(--space-4)',
              minWidth: '48px',
              textAlign: 'center'
            }}>
              ⚡
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--gray-900)', marginBottom: 'var(--space-2)' }}>
                Performance Alerts
              </h3>
              <p style={{ color: 'var(--gray-600)', fontSize: '0.875rem', margin: 0 }}>
                Important alerts about performance metrics and goals
              </p>
            </div>
          </div>
        </div>

        {/* Sync & Offline */}
        <div className="card" style={{ 
          background: 'linear-gradient(135deg, #3b82f615, #2563eb15)',
          border: '1px solid #3b82f630'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{ 
              fontSize: '2rem', 
              marginRight: 'var(--space-4)',
              minWidth: '48px',
              textAlign: 'center'
            }}>
              🔄
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--gray-900)', marginBottom: 'var(--space-2)' }}>
                Data Sync & Status
              </h3>
              <p style={{ color: 'var(--gray-600)', fontSize: '0.875rem', margin: 0 }}>
                Notifications about data synchronization and online/offline status changes
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      {isPushSupported && (
        <div style={{
          marginTop: 'var(--space-6)',
          padding: 'var(--space-5)',
          backgroundColor: 'var(--primary-50)',
          borderRadius: '12px',
          border: '1px solid var(--primary-200)'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '1.5rem', marginRight: 'var(--space-3)' }}>💡</span>
            <div>
              <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--primary-900)', marginBottom: 'var(--space-2)' }}>
                About Push Notifications
              </h4>
              <p style={{ fontSize: '0.8125rem', color: 'var(--primary-700)', margin: 0, lineHeight: '1.5' }}>
                Push notifications work even when the app is closed. You'll receive updates about new assessments, team activities, and important alerts directly on your device.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;
