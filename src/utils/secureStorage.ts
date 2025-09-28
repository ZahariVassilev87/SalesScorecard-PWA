// Secure storage utility for sensitive data
// Uses simple encryption for localStorage data

// Simple encryption/decryption functions
// Note: This is basic obfuscation, not military-grade encryption
// For production, consider using a proper encryption library

const ENCRYPTION_KEY = 'sales-scorecard-2024-secure-key';

// Simple XOR encryption (basic obfuscation)
function simpleEncrypt(text: string, key: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(
      text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    );
  }
  return btoa(result); // Base64 encode
}

function simpleDecrypt(encryptedText: string, key: string): string {
  try {
    const decoded = atob(encryptedText); // Base64 decode
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(
        decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }
    return result;
  } catch (error) {
    console.error('Decryption failed:', error);
    return '';
  }
}

// Secure storage interface
export const secureStorage = {
  // Store encrypted data
  setItem: (key: string, value: string): void => {
    try {
      const encrypted = simpleEncrypt(value, ENCRYPTION_KEY);
      localStorage.setItem(key, encrypted);
    } catch (error) {
      console.error('Failed to store secure data:', error);
      // Fallback to regular storage if encryption fails
      localStorage.setItem(key, value);
    }
  },

  // Retrieve and decrypt data
  getItem: (key: string): string | null => {
    try {
      const encrypted = localStorage.getItem(key);
      if (!encrypted) return null;
      
      const decrypted = simpleDecrypt(encrypted, ENCRYPTION_KEY);
      return decrypted;
    } catch (error) {
      console.error('Failed to retrieve secure data:', error);
      // Fallback to regular storage
      return localStorage.getItem(key);
    }
  },

  // Remove data
  removeItem: (key: string): void => {
    localStorage.removeItem(key);
  },

  // Clear all secure data
  clear: (): void => {
    // Only clear our secure keys
    const secureKeys = ['userToken', 'user'];
    secureKeys.forEach(key => {
      localStorage.removeItem(key);
    });
  },

  // Check if data exists
  hasItem: (key: string): boolean => {
    return localStorage.getItem(key) !== null;
  }
};

// Token management
export const tokenStorage = {
  setToken: (token: string): void => {
    secureStorage.setItem('userToken', token);
  },

  getToken: (): string | null => {
    return secureStorage.getItem('userToken');
  },

  removeToken: (): void => {
    secureStorage.removeItem('userToken');
  },

  hasToken: (): boolean => {
    return secureStorage.hasItem('userToken');
  }
};

// User data management
export const userStorage = {
  setUser: (user: any): void => {
    secureStorage.setItem('user', JSON.stringify(user));
  },

  getUser: (): any | null => {
    const userStr = secureStorage.getItem('user');
    if (!userStr) return null;
    
    try {
      return JSON.parse(userStr);
    } catch (error) {
      console.error('Failed to parse user data:', error);
      return null;
    }
  },

  removeUser: (): void => {
    secureStorage.removeItem('user');
  },

  hasUser: (): boolean => {
    return secureStorage.hasItem('user');
  }
};

// Session management
export const sessionStorage = {
  // Set session data with expiration
  setSessionData: (key: string, data: any, expirationMinutes: number = 60): void => {
    const sessionData = {
      data,
      expires: Date.now() + (expirationMinutes * 60 * 1000)
    };
    secureStorage.setItem(`session_${key}`, JSON.stringify(sessionData));
  },

  // Get session data (returns null if expired)
  getSessionData: (key: string): any | null => {
    const sessionStr = secureStorage.getItem(`session_${key}`);
    if (!sessionStr) return null;

    try {
      const sessionData = JSON.parse(sessionStr);
      
      // Check if expired
      if (Date.now() > sessionData.expires) {
        secureStorage.removeItem(`session_${key}`);
        return null;
      }
      
      return sessionData.data;
    } catch (error) {
      console.error('Failed to parse session data:', error);
      return null;
    }
  },

  // Remove session data
  removeSessionData: (key: string): void => {
    secureStorage.removeItem(`session_${key}`);
  },

  // Clear all session data
  clearAllSessions: (): void => {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('session_')) {
        localStorage.removeItem(key);
      }
    });
  }
};

// Security utilities
export const securityUtils = {
  // Generate a secure random string
  generateSecureId: (length: number = 32): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  // Validate token format (basic JWT check)
  isValidToken: (token: string): boolean => {
    if (!token || typeof token !== 'string') return false;
    
    // Basic JWT format check (3 parts separated by dots)
    const parts = token.split('.');
    return parts.length === 3;
  },

  // Check if token is expired (basic check)
  isTokenExpired: (token: string): boolean => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return true;
      
      const payload = JSON.parse(atob(parts[1]));
      const now = Math.floor(Date.now() / 1000);
      
      return payload.exp && payload.exp < now;
    } catch (error) {
      console.error('Failed to check token expiration:', error);
      return true;
    }
  }
};

export default secureStorage;
