/**
 * Centralized logging utility
 * Automatically gates logs based on environment
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private isTest = process.env.NODE_ENV === 'test';

  /**
   * Debug-level logging (only in development)
   */
  debug(...args: any[]): void {
    if (this.isDevelopment && !this.isTest) {
      console.log('🔍 [DEBUG]', ...args);
    }
  }

  /**
   * Info-level logging (development and production)
   */
  info(...args: any[]): void {
    if (!this.isTest) {
      console.log('ℹ️ [INFO]', ...args);
    }
  }

  /**
   * Warning-level logging (always shown)
   */
  warn(...args: any[]): void {
    console.warn('⚠️ [WARN]', ...args);
  }

  /**
   * Error-level logging (always shown)
   */
  error(...args: any[]): void {
    console.error('❌ [ERROR]', ...args);
  }

  /**
   * Success-level logging (only in development)
   */
  success(...args: any[]): void {
    if (this.isDevelopment && !this.isTest) {
      console.log('✅ [SUCCESS]', ...args);
    }
  }

  /**
   * API-specific logging
   */
  api(method: string, endpoint: string, data?: any): void {
    if (this.isDevelopment && !this.isTest) {
      console.log(`📡 [API] ${method} ${endpoint}`, data || '');
    }
  }

  /**
   * Auth-specific logging
   */
  auth(...args: any[]): void {
    if (this.isDevelopment && !this.isTest) {
      console.log('🔐 [AUTH]', ...args);
    }
  }

  /**
   * Storage-specific logging
   */
  storage(...args: any[]): void {
    if (this.isDevelopment && !this.isTest) {
      console.log('💾 [STORAGE]', ...args);
    }
  }

  /**
   * Performance logging
   */
  perf(label: string, duration: number): void {
    if (this.isDevelopment && !this.isTest) {
      console.log(`⚡ [PERF] ${label}: ${duration.toFixed(2)}ms`);
    }
  }

  /**
   * Create a scoped logger with prefix
   */
  scope(prefix: string) {
    return {
      debug: (...args: any[]) => this.debug(`[${prefix}]`, ...args),
      info: (...args: any[]) => this.info(`[${prefix}]`, ...args),
      warn: (...args: any[]) => this.warn(`[${prefix}]`, ...args),
      error: (...args: any[]) => this.error(`[${prefix}]`, ...args),
      success: (...args: any[]) => this.success(`[${prefix}]`, ...args),
      api: (method: string, endpoint: string, data?: any) => 
        this.api(method, `[${prefix}] ${endpoint}`, data),
      auth: (...args: any[]) => this.auth(`[${prefix}]`, ...args),
      storage: (...args: any[]) => this.storage(`[${prefix}]`, ...args),
      perf: (label: string, duration: number) => 
        this.perf(`[${prefix}] ${label}`, duration)
    };
  }

  /**
   * Measure execution time of a function
   */
  async measure<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.perf(label, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.error(`${label} failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  }

  /**
   * Group related logs
   */
  group(label: string, collapsed = false): void {
    if (this.isDevelopment && !this.isTest) {
      if (collapsed) {
        console.groupCollapsed(label);
      } else {
        console.group(label);
      }
    }
  }

  groupEnd(): void {
    if (this.isDevelopment && !this.isTest) {
      console.groupEnd();
    }
  }

  /**
   * Table output for structured data
   */
  table(data: any): void {
    if (this.isDevelopment && !this.isTest) {
      console.table(data);
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export type for creating scoped loggers
export type ScopedLogger = ReturnType<typeof logger.scope>;

