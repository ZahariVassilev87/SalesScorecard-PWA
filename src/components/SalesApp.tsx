import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import Dashboard from './Dashboard';
import DirectorDashboard from './DirectorDashboardSimple';
import MyTeam from './MyTeam';
import EvaluationForm from './EvaluationForm';
import CoachingEvaluationForm from './CoachingEvaluationForm';
import SalespersonEvaluationForm from './SalespersonEvaluationForm';
import EvaluationHistory from './EvaluationHistory';
import AnalyticsView from './AnalyticsView';
import ExportView from './ExportView';
import TeamManagementView from './TeamManagementView';
import LanguageSwitcher from './LanguageSwitcher';
import MobileDebugPanel from './MobileDebugPanel';

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

  const canExport = (userRole: string) => {
    return ['ADMIN', 'SALES_DIRECTOR', 'REGIONAL_SALES_MANAGER', 'REGIONAL_MANAGER', 'SALES_LEAD'].includes(userRole);
  };

  const isSalesDirector = (userRole: string) => {
    return userRole === 'SALES_DIRECTOR';
  };

  // Set initial tab based on user role (only if no saved tab exists)
  useEffect(() => {
    if (user?.role) {
      if (user.role === 'SALES_DIRECTOR') {
        setActiveTab('director-dashboard');
      } else if (canEvaluate(user.role)) {
        // Sales Leads and Regional Managers start with Evaluation Form
        setActiveTab('evaluation');
      } else {
        setActiveTab('dashboard');
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
          <button 
            onClick={() => window.location.reload()} 
            className="refresh-button"
            title="Force refresh (fixes Chrome caching issues)"
          >
            <span>🔄</span>
            <span className="refresh-text">Refresh</span>
          </button>
          <div className="user-info">
            <span className="user-name">{user?.displayName}</span>
            <span className="user-role">{getRoleDisplayName(user?.role || '')}</span>
          </div>
          <button onClick={handleLogout} className="logout-button">
            <span>⏻</span>
            <span>{t('auth.logout')}</span>
          </button>
        </div>
      </header>

      <nav className={`app-nav ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        {/* Sales Directors get analytics dashboard */}
        {isSalesDirector(user?.role || '') ? (
          <>
            <button
              className={activeTab === 'director-dashboard' ? 'nav-button active' : 'nav-button'}
              onClick={() => {
                setActiveTab('director-dashboard');
                closeMobileMenu();
              }}
            >
              <span>📊</span>
              <span>Analytics Dashboard</span>
            </button>
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
            {canExport(user?.role || '') && (
              <button
                className={activeTab === 'export' ? 'nav-button active' : 'nav-button'}
                onClick={() => {
                  setActiveTab('export');
                  closeMobileMenu();
                }}
              >
                <span>📤</span>
                <span>Export</span>
              </button>
            )}
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
            
            {canExport(user?.role || '') && (
              <button
                className={activeTab === 'export' ? 'nav-button active' : 'nav-button'}
                onClick={() => {
                  setActiveTab('export');
                  closeMobileMenu();
                }}
              >
                <span>📤</span>
                <span>Export</span>
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
        {activeTab === 'director-dashboard' && <DirectorDashboard />}
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'team' && <MyTeam />}
        {activeTab === 'evaluation' && (
          user?.role === 'REGIONAL_MANAGER' || user?.role === 'REGIONAL_SALES_MANAGER' ? (
            <CoachingEvaluationForm 
              onSuccess={handleEvaluationSuccess}
              onCancel={() => setActiveTab('dashboard')}
            />
          ) : user?.role === 'SALES_LEAD' ? (
            <SalespersonEvaluationForm 
              onSuccess={handleEvaluationSuccess}
              onCancel={() => setActiveTab('dashboard')}
            />
          ) : (
            <EvaluationForm 
              onSuccess={handleEvaluationSuccess}
              onCancel={() => setActiveTab('dashboard')}
            />
          )
        )}
        {activeTab === 'history' && <EvaluationHistory />}
        {activeTab === 'analytics' && <AnalyticsView />}
        {activeTab === 'export' && <ExportView />}
        {activeTab === 'teams' && <TeamManagementView />}
      </main>

      {/* Mobile debug panel - shows on iOS PWA */}
      <MobileDebugPanel />
    </div>
  );
};

export default SalesApp;
