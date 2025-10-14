import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('vassilev.zahari@gmail.com');
  const [password, setPassword] = useState('test123');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    console.log('🔍 [MOBILE DEBUG] LoginForm handleSubmit started');
    console.log('🔍 [MOBILE DEBUG] Email:', email);
    console.log('🔍 [MOBILE DEBUG] Password length:', password.length);

    try {
      console.log('🔍 [MOBILE DEBUG] Calling login function...');
      await login(email, password);
      console.log('✅ [MOBILE DEBUG] Login function completed successfully');
    } catch (err) {
      console.error('❌ [MOBILE DEBUG] LoginForm caught error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      console.error('❌ [MOBILE DEBUG] Setting error message:', errorMessage);
      setError(errorMessage);
    } finally {
      console.log('🔍 [MOBILE DEBUG] LoginForm handleSubmit finished, setting loading to false');
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <h2>Sales Scorecard</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email:</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginForm;






