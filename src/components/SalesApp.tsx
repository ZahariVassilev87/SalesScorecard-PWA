import React, { useState, useEffect } from 'react';
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
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  // Set initial tab based on user role
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
                setActiveTab('dashboard');
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
