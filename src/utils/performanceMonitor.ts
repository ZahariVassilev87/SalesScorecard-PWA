// Performance monitoring utility for Sales Scorecard PWA
// Tracks Core Web Vitals and custom performance metrics

export interface PerformanceMetrics {
  // Core Web Vitals
  fcp?: number; // First Contentful Paint
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte
  
  // Custom metrics
  pageLoadTime?: number;
  apiResponseTime?: number;
  componentRenderTime?: number;
  bundleSize?: number;
  
  // User experience metrics
  userInteractionTime?: number;
  formSubmissionTime?: number;
  navigationTime?: number;
}

export interface PerformanceReport {
  timestamp: number;
  url: string;
  userAgent: string;
  metrics: PerformanceMetrics;
  sessionId: string;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {};
  private sessionId: string;
  private reportQueue: PerformanceReport[] = [];
  private isOnline: boolean = navigator.onLine;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.initializeMonitoring();
    this.setupNetworkListeners();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeMonitoring(): void {
    // Monitor Core Web Vitals
    this.observeWebVitals();
    
    // Monitor page load performance
    this.observePageLoad();
    
    // Monitor API performance
    this.observeApiCalls();
    
    // Monitor component performance
    this.observeComponentPerformance();
  }

  private observeWebVitals(): void {
    // First Contentful Paint (FCP)
    if ('PerformanceObserver' in window) {
      try {
        const fcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
          if (fcpEntry) {
            this.metrics.fcp = fcpEntry.startTime;
          }
        });
        fcpObserver.observe({ entryTypes: ['paint'] });
      } catch (error) {
        console.warn('FCP monitoring not supported:', error);
      }

      // Largest Contentful Paint (LCP)
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          if (lastEntry) {
            this.metrics.lcp = lastEntry.startTime;
          }
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (error) {
        console.warn('LCP monitoring not supported:', error);
      }

      // First Input Delay (FID)
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach(entry => {
            const fidEntry = entry as any; // Type assertion for FID-specific properties
            if (fidEntry.processingStart && fidEntry.startTime) {
              this.metrics.fid = fidEntry.processingStart - fidEntry.startTime;
            }
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
      } catch (error) {
        console.warn('FID monitoring not supported:', error);
      }

      // Cumulative Layout Shift (CLS)
      try {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach(entry => {
            const clsEntry = entry as any; // Type assertion for CLS-specific properties
            if (!clsEntry.hadRecentInput) {
              clsValue += clsEntry.value;
            }
          });
          this.metrics.cls = clsValue;
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (error) {
        console.warn('CLS monitoring not supported:', error);
      }
    }
  }

  private observePageLoad(): void {
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        this.metrics.pageLoadTime = navigation.loadEventEnd - navigation.fetchStart;
        this.metrics.ttfb = navigation.responseStart - navigation.fetchStart;
      }
    });
  }

  private observeApiCalls(): void {
    // Monitor fetch requests
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = performance.now();
      try {
        const response = await originalFetch(...args);
        const endTime = performance.now();
        this.metrics.apiResponseTime = endTime - startTime;
        return response;
      } catch (error) {
        const endTime = performance.now();
        this.metrics.apiResponseTime = endTime - startTime;
        throw error;
      }
    };
  }

  private observeComponentPerformance(): void {
    // This will be called by components to measure their render time
    this.measureComponentRender = this.measureComponentRender.bind(this);
  }

  public measureComponentRender(componentName: string, renderFunction: () => void): void {
    const startTime = performance.now();
    renderFunction();
    const endTime = performance.now();
    
    const renderTime = endTime - startTime;
    this.metrics.componentRenderTime = renderTime;
    
    console.log(`Component ${componentName} render time: ${renderTime.toFixed(2)}ms`);
  }

  public measureUserInteraction(action: string, actionFunction: () => void | Promise<void>): void {
    const startTime = performance.now();
    
    const result = actionFunction();
    
    if (result instanceof Promise) {
      result.then(() => {
        const endTime = performance.now();
        this.metrics.userInteractionTime = endTime - startTime;
        console.log(`User interaction ${action} time: ${(endTime - startTime).toFixed(2)}ms`);
      });
    } else {
      const endTime = performance.now();
      this.metrics.userInteractionTime = endTime - startTime;
      console.log(`User interaction ${action} time: ${(endTime - startTime).toFixed(2)}ms`);
    }
  }

  public measureFormSubmission(formName: string, submissionFunction: () => Promise<void>): void {
    const startTime = performance.now();
    
    submissionFunction().then(() => {
      const endTime = performance.now();
      this.metrics.formSubmissionTime = endTime - startTime;
      console.log(`Form ${formName} submission time: ${(endTime - startTime).toFixed(2)}ms`);
    }).catch((error) => {
      const endTime = performance.now();
      this.metrics.formSubmissionTime = endTime - startTime;
      console.error(`Form ${formName} submission failed after ${(endTime - startTime).toFixed(2)}ms:`, error);
    });
  }

  public measureNavigation(from: string, to: string, navigationFunction: () => void): void {
    const startTime = performance.now();
    navigationFunction();
    const endTime = performance.now();
    
    this.metrics.navigationTime = endTime - startTime;
    console.log(`Navigation from ${from} to ${to}: ${(endTime - startTime).toFixed(2)}ms`);
  }

  private setupNetworkListeners(): void {
    // TEMPORARILY DISABLED FOR PWA DEBUGGING - conflicts with offlineService
    // window.addEventListener('online', () => {
    //   this.isOnline = true;
    //   this.flushReportQueue();
    // });

    // window.addEventListener('offline', () => {
    //   this.isOnline = false;
    // });
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public generateReport(): PerformanceReport {
    return {
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      metrics: this.getMetrics(),
      sessionId: this.sessionId
    };
  }

  public sendReport(report?: PerformanceReport): void {
    const reportToSend = report || this.generateReport();
    
    // Store report locally for analytics
    this.storeReportLocally(reportToSend);
    
    if (this.isOnline) {
      this.sendReportToServer(reportToSend);
    } else {
      this.reportQueue.push(reportToSend);
    }
  }

  private storeReportLocally(report: PerformanceReport): void {
    try {
      // Import analytics service dynamically to avoid circular dependencies
      import('../services/performanceAnalytics').then(({ performanceAnalytics }) => {
        performanceAnalytics.storeReport(report);
      });
    } catch (error) {
      console.error('Failed to store report locally:', error);
    }
  }

  private async sendReportToServer(report: PerformanceReport): Promise<void> {
    try {
      // In production, you would send this to your analytics service
      console.log('Performance Report:', report);
      
      // Example: Send to analytics service
      // await fetch('/api/analytics/performance', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(report)
      // });
      
    } catch (error) {
      console.error('Failed to send performance report:', error);
      this.reportQueue.push(report);
    }
  }

  private flushReportQueue(): void {
    if (this.reportQueue.length > 0) {
      console.log(`Flushing ${this.reportQueue.length} queued performance reports`);
      this.reportQueue.forEach(report => this.sendReportToServer(report));
      this.reportQueue = [];
    }
  }

  public getPerformanceScore(): number {
    const metrics = this.getMetrics();
    let score = 100;

    // Deduct points for poor performance
    if (metrics.fcp && metrics.fcp > 1800) score -= 20; // FCP > 1.8s
    if (metrics.lcp && metrics.lcp > 2500) score -= 25; // LCP > 2.5s
    if (metrics.fid && metrics.fid > 100) score -= 15; // FID > 100ms
    if (metrics.cls && metrics.cls > 0.1) score -= 20; // CLS > 0.1
    if (metrics.pageLoadTime && metrics.pageLoadTime > 3000) score -= 20; // Page load > 3s

    return Math.max(0, score);
  }

  public getPerformanceRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.getMetrics();

    if (metrics.fcp && metrics.fcp > 1800) {
      recommendations.push('First Contentful Paint is slow. Consider optimizing critical CSS and reducing render-blocking resources.');
    }

    if (metrics.lcp && metrics.lcp > 2500) {
      recommendations.push('Largest Contentful Paint is slow. Optimize images and consider lazy loading.');
    }

    if (metrics.fid && metrics.fid > 100) {
      recommendations.push('First Input Delay is high. Consider code splitting and reducing JavaScript execution time.');
    }

    if (metrics.cls && metrics.cls > 0.1) {
      recommendations.push('Cumulative Layout Shift is high. Ensure images and ads have defined dimensions.');
    }

    if (metrics.pageLoadTime && metrics.pageLoadTime > 3000) {
      recommendations.push('Page load time is slow. Consider implementing service worker caching and optimizing bundle size.');
    }

    if (metrics.apiResponseTime && metrics.apiResponseTime > 1000) {
      recommendations.push('API response time is slow. Consider implementing caching and optimizing backend queries.');
    }

    return recommendations;
  }

  public startSession(): void {
    this.sessionId = this.generateSessionId();
    console.log('Performance monitoring session started:', this.sessionId);
  }

  public endSession(): void {
    this.sendReport();
    console.log('Performance monitoring session ended:', this.sessionId);
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Export for use in components
export const measureComponent = (componentName: string) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args: any[]) {
      performanceMonitor.measureComponentRender(componentName, () => {
        return originalMethod.apply(this, args);
      });
    };
    return descriptor;
  };
};

export default performanceMonitor;
