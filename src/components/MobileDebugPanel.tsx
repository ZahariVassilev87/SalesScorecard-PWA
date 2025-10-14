import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';

const MobileDebugPanel: React.FC = () => {
  const { user } = useAuth();
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [isVisible, setIsVisible] = useState(false);
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Only load if user ID actually changed
    if (!user?.id || user.id === lastUserIdRef.current) {
      return;
    }
    
    lastUserIdRef.current = user.id;
    
    const loadDebugInfo = async () => {
      const info: any = {
        timestamp: new Date().toISOString(),
        isStandalone: window.matchMedia('(display-mode: standalone)').matches,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        online: navigator.onLine,
        currentUser: user,
        localStorage: {
          userToken: !!localStorage.getItem('userToken'),
          user: !!localStorage.getItem('user')
        }
      };

      // Test API call
      try {
        const users = await apiService.getEvaluatableUsers();
        info.evaluatableUsers = {
          count: users.length,
          users: users.map(u => ({ id: u.id, name: u.displayName, role: u.role }))
        };
      } catch (error) {
        info.evaluatableUsersError = error instanceof Error ? error.message : 'Unknown error';
      }

      setDebugInfo(info);
    };

    loadDebugInfo();
  }, [user]);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        style={{
          position: 'fixed',
          bottom: '10px',
          right: '10px',
          padding: '10px 15px',
          background: '#ff6b6b',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          fontSize: '20px',
          cursor: 'pointer',
          zIndex: 9999,
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
        }}
      >
        🐛
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.9)',
      color: 'white',
      padding: '20px',
      overflowY: 'auto',
      zIndex: 9999,
      fontFamily: 'monospace',
      fontSize: '12px'
    }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>🐛 Debug Panel</h2>
        <button
          onClick={() => setIsVisible(false)}
          style={{
            padding: '10px 20px',
            background: '#ff6b6b',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Close
        </button>
      </div>
      
      <pre style={{ 
        background: '#1e1e1e', 
        padding: '15px', 
        borderRadius: '8px',
        overflow: 'auto',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
      }}>
        {JSON.stringify(debugInfo, null, 2)}
      </pre>

      <button
        onClick={() => {
          const loadDebugInfo = async () => {
            const info: any = {
              timestamp: new Date().toISOString(),
              isStandalone: window.matchMedia('(display-mode: standalone)').matches,
              userAgent: navigator.userAgent,
              currentUser: user,
              localStorage: {
                userToken: !!localStorage.getItem('userToken'),
                user: !!localStorage.getItem('user')
              }
            };

            try {
              const users = await apiService.getEvaluatableUsers();
              info.evaluatableUsers = {
                count: users.length,
                users: users.map(u => ({ id: u.id, name: u.displayName, role: u.role }))
              };
            } catch (error) {
              info.evaluatableUsersError = error instanceof Error ? error.message : 'Unknown error';
            }

            setDebugInfo(info);
          };
          loadDebugInfo();
        }}
        style={{
          marginTop: '15px',
          padding: '10px 20px',
          background: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          width: '100%'
        }}
      >
        🔄 Refresh Debug Info
      </button>
    </div>
  );
};

export default MobileDebugPanel;


