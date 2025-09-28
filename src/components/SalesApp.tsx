import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import PerformanceDashboard from './PerformanceDashboard';
import InstallPrompt from './InstallPrompt';
// import ThemeToggle from './ThemeToggle'; // Dark mode disabled
import { notificationService } from '../utils/notificationService';
import { offlineService } from '../utils/offlineService';

// Lazy load components for better performance
const Dashboard = lazy(() => import('./Dashboard'));
const MyTeam = lazy(() => import('./MyTeam'));
const EvaluationForm = lazy(() => import('./EvaluationForm'));
const EvaluationHistory = lazy(() => import('./EvaluationHistory'));
const AnalyticsView = lazy(() => import('./AnalyticsView'));
const TeamManagementView = lazy(() => import('./TeamManagementView'));
const Notifications = lazy(() => import('./Notifications'));

const SalesApp: React.FC = () => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(() => {
    // Try to get the last selected tab from localStorage
    const savedTab = localStorage.getItem('lastActiveTab');
    return savedTab || 'dashboard';
  });
  const hasInitialized = useRef(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showPerformanceDashboard, setShowPerformanceDashboard] = useState(false);

  // Save active tab to localStorage whenever it changes
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    localStorage.setItem('lastActiveTab', tab);
  };

  // Performance dashboard state management

  const handleLogout = () => {
    logout();
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const getRoleDisplayName = (role: string) => {
    return t(`roles.${role}`) || role;
  };

  const canEvaluate = (userRole: string) => {
    return ['ADMIN', 'SALES_DIRECTOR', 'REGIONAL_SALES_MANAGER', 'REGIONAL_MANAGER', 'SALES_LEAD'].includes(userRole);
  };

  const canViewAnalytics = (userRole: string) => {
    return ['ADMIN', 'REGIONAL_SALES_MANAGER', 'REGIONAL_MANAGER', 'SALES_LEAD'].includes(userRole);
  };

  const canManageTeams = (userRole: string) => {
    return ['ADMIN', 'SALES_DIRECTOR', 'REGIONAL_SALES_MANAGER', 'REGIONAL_MANAGER'].includes(userRole);
  };

  const isSalesDirector = (userRole: string) => {
    return userRole === 'SALES_DIRECTOR';
  };

  // Set initial tab based on user role (only if no saved tab exists)
  useEffect(() => {
    if (user?.role && !hasInitialized.current) {
      hasInitialized.current = true;
      const savedTab = localStorage.getItem('lastActiveTab');
      
      // Only set default tab if no saved tab exists
      if (!savedTab) {
        if (user.role === 'SALES_DIRECTOR') {
          handleTabChange('dashboard');
        } else if (canEvaluate(user.role)) {
          // Sales Leads and Regional Managers start with Evaluation Form
          handleTabChange('evaluation');
        } else {
          handleTabChange('dashboard');
        }
      }
    }
  }, [user?.role]);

  // Initialize notification service and offline monitoring
  useEffect(() => {
    const initializeServices = async () => {
      try {
        // Initialize notification service
        await notificationService.initialize();
        
        // Set up offline/online event listeners
        const handleOnline = () => {
          notificationService.showOnlineNotification();
          offlineService.triggerSync();
        };
        
        const handleOffline = () => {
          notificationService.showOfflineNotification();
        };
        
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        // Cleanup
        return () => {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
        };
      } catch (error) {
        console.error('Failed to initialize services:', error);
      }
    };
    
    initializeServices();
  }, []);

  const handleEvaluationSuccess = () => {
    handleTabChange('history');
  };

  return (
    <div className="sales-app">
      <header className="app-header">
        <div className="header-left">
          <button 
            className="mobile-menu-toggle"
            onClick={toggleMobileMenu}
            aria-label="Toggle mobile menu"
          >
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
          </button>
          <h1>🎯 Sales Scorecard</h1>
        </div>
        <div className="header-right">
          {/* Performance Dashboard - Admin Only */}
          {user?.role === 'ADMIN' && (
            <button 
              onClick={() => {
                console.log('Performance button clicked!');
                setShowPerformanceDashboard(true);
              }} 
              className="performance-button"
              title="Performance Dashboard"
            style={{
              background: '#ff6b6b',
              color: 'white',
              border: '2px solid #ff0000',
              fontSize: '18px',
              padding: '8px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '50px',
              height: '50px',
              zIndex: 9999,
              position: 'relative'
            }}
          >
            🚀
          </button>
          )}
          
          {/* Notification Settings - Hidden on mobile */}
            <button 
              onClick={async () => {
                try {
                  const isSubscribed = await notificationService.getSubscription();
                  if (isSubscribed) {
                    await notificationService.unsubscribeFromPush();
                    notificationService.showNotification('🔔 Notifications Disabled', {
                      body: 'You have been unsubscribed from push notifications.'
                    });
                  } else {
                    const subscription = await notificationService.subscribeToPush();
                    if (subscription) {
                      notificationService.showNotification('🔔 Notifications Enabled', {
                        body: 'You will now receive push notifications for important updates.'
                      });
                    }
                  }
                } catch (error) {
                  console.error('Failed to toggle notifications:', error);
                }
              }}
              className="notification-button desktop-only"
              title="Toggle Notifications"
              style={{
                background: '#28a745',
                color: 'white',
              border: 'none',
              fontSize: '16px',
              padding: '8px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '40px',
              height: '40px',
              marginRight: '8px'
            }}
          >
            🔔
          </button>
          
          {/* <ThemeToggle /> - Dark mode disabled */}
          <LanguageSwitcher />
          <div className="user-info">
            <span className="user-name">{user?.displayName}</span>
            <span className="user-role">{getRoleDisplayName(user?.role || '')}</span>
          </div>
          <button onClick={handleLogout} className="logout-button">
            <span>🚪</span>
            <span>{t('auth.logout')}</span>
          </button>
        </div>
      </header>

      <nav className={`app-nav ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        {/* Sales Directors get simplified dashboard only */}
        {isSalesDirector(user?.role || '') ? (
          <>
            <button
              className={activeTab === 'dashboard' ? 'nav-button active' : 'nav-button'}
              onClick={() => {
                handleTabChange('dashboard');
                closeMobileMenu();
              }}
            >
              <span>🏢</span>
              <span>{t('navigation.dashboard')}</span>
            </button>
          </>
        ) : (
          <>
            {/* Regular users get full navigation - Evaluation Form first for Sales Leads and Regional Managers */}
            {canEvaluate(user?.role || '') && (
              <button
                className={activeTab === 'evaluation' ? 'nav-button active' : 'nav-button'}
                onClick={() => {
                  handleTabChange('evaluation');
                  closeMobileMenu();
                }}
              >
                <span>✏️</span>
                <span>{t('navigation.evaluation')}</span>
              </button>
            )}
            
            <button
              className={activeTab === 'history' ? 'nav-button active' : 'nav-button'}
              onClick={() => {
                handleTabChange('history');
                closeMobileMenu();
              }}
            >
              <span>📜</span>
              <span>{t('navigation.history')}</span>
            </button>

            {canViewAnalytics(user?.role || '') && (
              <button
                className={activeTab === 'analytics' ? 'nav-button active' : 'nav-button'}
                onClick={() => {
                  handleTabChange('analytics');
                  closeMobileMenu();
                }}
              >
                <span>📈</span>
                <span>{t('navigation.analytics')}</span>
              </button>
            )}
            
            <button
              className={activeTab === 'dashboard' ? 'nav-button active' : 'nav-button'}
              onClick={() => {
                handleTabChange('dashboard');
                closeMobileMenu();
              }}
            >
              <span>🏠</span>
              <span>{t('navigation.dashboard')}</span>
            </button>
            
            <button
              className={activeTab === 'team' ? 'nav-button active' : 'nav-button'}
              onClick={() => {
                handleTabChange('team');
                closeMobileMenu();
              }}
            >
              <span>👤</span>
              <span>{t('navigation.team')}</span>
            </button>

            {canManageTeams(user?.role || '') && (
              <button
                className={activeTab === 'teams' ? 'nav-button active' : 'nav-button'}
                onClick={() => {
                  handleTabChange('teams');
                  closeMobileMenu();
                }}
              >
                <span>👥</span>
                <span>{t('navigation.teams')}</span>
              </button>
            )}
            
            {/* Mobile Notification Settings */}
            <button
              className={activeTab === 'notifications' ? 'nav-button active mobile-notification-button' : 'nav-button mobile-notification-button'}
              onClick={() => {
                handleTabChange('notifications');
                closeMobileMenu();
              }}
            >
              <span>🔔</span>
              <span>Notifications</span>
            </button>
          </>
        )}
      </nav>

      {isMobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={closeMobileMenu}></div>
      )}

      <main className="app-content">
        <Suspense fallback={
          <div className="loading-container">
            <div className="loading-spinner">{t('common.loading')}</div>
          </div>
        }>
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'team' && <MyTeam />}
          {activeTab === 'evaluation' && (
            <EvaluationForm 
              onSuccess={handleEvaluationSuccess}
              onCancel={() => handleTabChange('dashboard')}
            />
          )}
          {activeTab === 'history' && <EvaluationHistory />}
          {activeTab === 'analytics' && <AnalyticsView />}
          {activeTab === 'teams' && <TeamManagementView />}
          {activeTab === 'notifications' && <Notifications />}
        </Suspense>
      </main>

      {/* Performance Dashboard */}
      <PerformanceDashboard 
        isVisible={showPerformanceDashboard}
        onClose={() => setShowPerformanceDashboard(false)}
      />

      {/* Install Prompt */}
      <InstallPrompt 
        onInstall={() => {
          notificationService.showNotification('🎉 App Installed!', {
            body: 'Sales Scorecard has been installed successfully'
          });
        }}
        onDismiss={() => {
          console.log('Install prompt dismissed');
        }}
      />

    </div>
  );
};

export default SalesApp;
