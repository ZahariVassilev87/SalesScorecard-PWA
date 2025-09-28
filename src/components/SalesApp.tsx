import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import PerformanceDashboard from './PerformanceDashboard';

// Lazy load components for better performance
const Dashboard = lazy(() => import('./Dashboard'));
const MyTeam = lazy(() => import('./MyTeam'));
const EvaluationForm = lazy(() => import('./EvaluationForm'));
const EvaluationHistory = lazy(() => import('./EvaluationHistory'));
const AnalyticsView = lazy(() => import('./AnalyticsView'));
const TeamManagementView = lazy(() => import('./TeamManagementView'));

const SalesApp: React.FC = () => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showPerformanceDashboard, setShowPerformanceDashboard] = useState(false);

  // Debug logging
  console.log('SalesApp rendered, user:', user);
  console.log('showPerformanceDashboard:', showPerformanceDashboard);
  console.log('PerformanceDashboard component:', PerformanceDashboard);

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

  // Set initial tab based on user role
  useEffect(() => {
    if (user?.role) {
      if (user.role === 'SALES_DIRECTOR') {
        setActiveTab('dashboard');
      } else if (canEvaluate(user.role)) {
        // Sales Leads and Regional Managers start with Evaluation Form
        setActiveTab('evaluation');
      } else {
        setActiveTab('dashboard');
      }
    }
  }, [user?.role]);

  const handleEvaluationSuccess = () => {
    setActiveTab('history');
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
          {/* Performance Dashboard - Debug Mode (All Users) */}
          <button 
            onClick={() => {
              console.log('Performance button clicked!');
              setShowPerformanceDashboard(true);
            }} 
            className="performance-button"
            title="Performance Dashboard (Debug Mode)"
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
                setActiveTab('dashboard');
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
                  setActiveTab('evaluation');
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
                setActiveTab('history');
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
                  setActiveTab('analytics');
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
                setActiveTab('dashboard');
                closeMobileMenu();
              }}
            >
              <span>🏠</span>
              <span>{t('navigation.dashboard')}</span>
            </button>
            
            <button
              className={activeTab === 'team' ? 'nav-button active' : 'nav-button'}
              onClick={() => {
                setActiveTab('team');
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
                  setActiveTab('teams');
                  closeMobileMenu();
                }}
              >
                <span>👥</span>
                <span>{t('navigation.teams')}</span>
              </button>
            )}
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
              onCancel={() => setActiveTab('dashboard')}
            />
          )}
          {activeTab === 'history' && <EvaluationHistory />}
          {activeTab === 'analytics' && <AnalyticsView />}
          {activeTab === 'teams' && <TeamManagementView />}
        </Suspense>
      </main>

      {/* Performance Dashboard */}
      <PerformanceDashboard 
        isVisible={showPerformanceDashboard}
        onClose={() => setShowPerformanceDashboard(false)}
      />

      {/* Debug Test Button - Always Visible */}
      <button 
        onClick={() => {
          console.log('Test button clicked!');
          setShowPerformanceDashboard(true);
        }}
        style={{
          position: 'fixed',
          top: '10px',
          left: '10px',
          background: '#00ff00',
          color: 'black',
          border: '2px solid #000000',
          padding: '10px',
          borderRadius: '5px',
          cursor: 'pointer',
          zIndex: 10000,
          fontSize: '14px',
          fontWeight: 'bold',
          display: 'block',
          visibility: 'visible',
          opacity: '1'
        }}
      >
        🧪 TEST PERFORMANCE
      </button>

      {/* Additional Debug Info */}
      <div style={{
        position: 'fixed',
        top: '60px',
        left: '10px',
        background: 'yellow',
        color: 'black',
        padding: '5px',
        border: '1px solid black',
        fontSize: '12px',
        zIndex: 10000
      }}>
        Debug: showPerformanceDashboard = {showPerformanceDashboard.toString()}
      </div>
    </div>
  );
};

export default SalesApp;
