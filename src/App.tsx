import React, { lazy, Suspense } from 'react';
import './App.css';
import './i18n';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginForm from './components/LoginForm';
import SalesApp from './components/SalesApp';
import ErrorBoundary from './components/ErrorBoundary';
import { useTranslation } from 'react-i18next';

// Lazy load components for better performance
const LoginForm = lazy(() => import('./components/LoginForm'));
const SalesApp = lazy(() => import('./components/SalesApp'));

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { t } = useTranslation();

  console.log('🔍 [MOBILE DEBUG] AppContent render - isAuthenticated:', isAuthenticated, 'isLoading:', isLoading, 'user:', user);

  if (isLoading) {
    console.log('🔍 [MOBILE DEBUG] AppContent showing loading spinner');
    return (
      <div className="app-loading">
        <div className="loading-spinner">{t('common.loading')}</div>
      </div>
    );
  }

  if (isAuthenticated) {
    console.log('🔍 [MOBILE DEBUG] AppContent showing SalesApp - user authenticated');
    return <SalesApp />;
  } else {
    console.log('🔍 [MOBILE DEBUG] AppContent showing LoginForm - user not authenticated');
    return <LoginForm />;
  }
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
// Force rebuild Sat Sep 27 16:07:23 EEST 2025
