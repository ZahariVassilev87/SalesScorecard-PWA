import React from 'react';
import './App.css';
import './i18n';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginForm from './components/LoginForm';
import SalesApp from './components/SalesApp';
import { useTranslation } from 'react-i18next';

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner">{t('common.loading')}</div>
      </div>
    );
  }

  return isAuthenticated ? <SalesApp /> : <LoginForm />;
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
// Force rebuild Sat Sep 27 16:07:23 EEST 2025
