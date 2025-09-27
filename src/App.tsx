import React, { lazy, Suspense } from 'react';
import './App.css';
import './i18n';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useTranslation } from 'react-i18next';

// Lazy load components for better performance
const LoginForm = lazy(() => import('./components/LoginForm'));
const SalesApp = lazy(() => import('./components/SalesApp'));

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

  return (
    <Suspense fallback={
      <div className="app-loading">
        <div className="loading-spinner">{t('common.loading')}</div>
      </div>
    }>
      {isAuthenticated ? <SalesApp /> : <LoginForm />}
    </Suspense>
  );
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
