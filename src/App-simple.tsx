import React from 'react';
import './App.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginForm from './components/LoginForm';
import SalesApp from './components/SalesApp';
import ErrorBoundary from './components/ErrorBoundary';

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();

  console.log('🔍 [MOBILE DEBUG] AppContent render - isAuthenticated:', isAuthenticated, 'isLoading:', isLoading, 'user:', user);

  if (isLoading) {
    console.log('🔍 [MOBILE DEBUG] AppContent showing loading spinner');
    return (
      <div className="app-loading">
        <div className="loading-spinner">Loading...</div>
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






