import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Dashboard from './Dashboard';
import MyTeam from './MyTeam';
import EvaluationForm from './EvaluationForm';
import EvaluationHistory from './EvaluationHistory';
import AnalyticsView from './AnalyticsView';
import TeamManagementView from './TeamManagementView';

const SalesApp: React.FC = () => {
  const { user, logout } = useAuth();
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
    switch (role) {
      case 'SALES_DIRECTOR': return 'Sales Director';
      case 'REGIONAL_SALES_MANAGER': 
      case 'REGIONAL_MANAGER': return 'Regional Manager';
      case 'SALES_LEAD': return 'Sales Lead';
      case 'SALESPERSON': return 'Salesperson';
      case 'ADMIN': return 'Administrator';
      default: return role;
    }
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
          <div className="user-info">
            <span className="user-name">{user?.displayName}</span>
            <span className="user-role">{getRoleDisplayName(user?.role || '')}</span>
          </div>
          <button onClick={handleLogout} className="logout-button">
            <span>🚪</span>
            <span>Sign Out</span>
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
              <span>Director Dashboard</span>
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
                <span>Evaluation Form</span>
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
              <span>Evaluation History</span>
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
                <span>Analytics</span>
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
              <span>Dashboard</span>
            </button>
            
            <button
              className={activeTab === 'team' ? 'nav-button active' : 'nav-button'}
              onClick={() => {
                setActiveTab('team');
                closeMobileMenu();
              }}
            >
              <span>👤</span>
              <span>My Team</span>
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
                <span>Teams</span>
              </button>
            )}
          </>
        )}
      </nav>

      {isMobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={closeMobileMenu}></div>
      )}

      <main className="app-content">
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
      </main>
    </div>
  );
};

export default SalesApp;
