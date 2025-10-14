// Performance Analytics Service
// Handles real-time performance data collection, storage, and reporting

import { PerformanceReport, PerformanceMetrics } from '../utils/performanceMonitor';

export interface PerformanceStats {
  totalSessions: number;
  averageScore: number;
  scoreDistribution: { [score: string]: number };
  topIssues: Array<{ metric: string; count: number; severity: string }>;
  trends: Array<{ date: string; score: number; metrics: PerformanceMetrics }>;
  lastUpdated: number;
}

export interface PerformanceAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: number;
  resolved: boolean;
}

class PerformanceAnalytics {
  private storageKey = 'sales_scorecard_performance_data';
  private alertsKey = 'sales_scorecard_performance_alerts';
  private maxStoredReports = 100; // Keep last 100 reports
  private alertThresholds = {
    fcp: 3000, // 3 seconds
    lcp: 4000, // 4 seconds
    fid: 300,  // 300ms
    cls: 0.25, // 0.25
    pageLoadTime: 5000, // 5 seconds
    apiResponseTime: 2000, // 2 seconds
    score: 70 // Below 70 is concerning
  };

  // Store performance report locally
  public storeReport(report: PerformanceReport): void {
    try {
      const existingReports = this.getStoredReports();
      const updatedReports = [report, ...existingReports].slice(0, this.maxStoredReports);
      
      localStorage.setItem(this.storageKey, JSON.stringify(updatedReports));
      
      // Check for performance alerts
      this.checkPerformanceAlerts(report);
      
      console.log('Performance report stored successfully');
    } catch (error) {
      console.error('Failed to store performance report:', error);
    }
  }

  // Get all stored reports
  public getStoredReports(): PerformanceReport[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to retrieve stored reports:', error);
      return [];
    }
  }

  // Generate comprehensive performance statistics
  public generateStats(): PerformanceStats {
    const reports = this.getStoredReports();
    
    if (reports.length === 0) {
      return {
        totalSessions: 0,
        averageScore: 0,
        scoreDistribution: {},
        topIssues: [],
        trends: [],
        lastUpdated: Date.now()
      };
    }

    // Calculate average score
    const scores = reports.map(report => this.calculateScore(report.metrics));
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

    // Score distribution
    const scoreDistribution: { [score: string]: number } = {};
    scores.forEach(score => {
      const range = this.getScoreRange(score);
      scoreDistribution[range] = (scoreDistribution[range] || 0) + 1;
    });

    // Top issues
    const topIssues = this.identifyTopIssues(reports);

    // Trends (last 30 days)
    const trends = this.generateTrends(reports);

    return {
      totalSessions: reports.length,
      averageScore: Math.round(averageScore * 100) / 100,
      scoreDistribution,
      topIssues,
      trends,
      lastUpdated: Date.now()
    };
  }

  // Calculate performance score from metrics
  private calculateScore(metrics: PerformanceMetrics): number {
    let score = 100;

    // Deduct points for poor performance
    if (metrics.fcp && metrics.fcp > 1800) score -= 20;
    if (metrics.lcp && metrics.lcp > 2500) score -= 25;
    if (metrics.fid && metrics.fid > 100) score -= 15;
    if (metrics.cls && metrics.cls > 0.1) score -= 20;
    if (metrics.pageLoadTime && metrics.pageLoadTime > 3000) score -= 20;

    return Math.max(0, score);
  }

  // Get score range for distribution
  private getScoreRange(score: number): string {
    if (score >= 90) return '90-100';
    if (score >= 80) return '80-89';
    if (score >= 70) return '70-79';
    if (score >= 60) return '60-69';
    return '0-59';
  }

  // Identify top performance issues
  private identifyTopIssues(reports: PerformanceReport[]): Array<{ metric: string; count: number; severity: string }> {
    const issues: { [key: string]: { count: number; severity: string } } = {};

    reports.forEach(report => {
      const metrics = report.metrics;
      
      if (metrics.fcp && metrics.fcp > this.alertThresholds.fcp) {
        issues.fcp = { count: (issues.fcp?.count || 0) + 1, severity: 'high' };
      }
      if (metrics.lcp && metrics.lcp > this.alertThresholds.lcp) {
        issues.lcp = { count: (issues.lcp?.count || 0) + 1, severity: 'high' };
      }
      if (metrics.fid && metrics.fid > this.alertThresholds.fid) {
        issues.fid = { count: (issues.fid?.count || 0) + 1, severity: 'medium' };
      }
      if (metrics.cls && metrics.cls > this.alertThresholds.cls) {
        issues.cls = { count: (issues.cls?.count || 0) + 1, severity: 'medium' };
      }
      if (metrics.pageLoadTime && metrics.pageLoadTime > this.alertThresholds.pageLoadTime) {
        issues.pageLoadTime = { count: (issues.pageLoadTime?.count || 0) + 1, severity: 'high' };
      }
      if (metrics.apiResponseTime && metrics.apiResponseTime > this.alertThresholds.apiResponseTime) {
        issues.apiResponseTime = { count: (issues.apiResponseTime?.count || 0) + 1, severity: 'medium' };
      }
    });

    return Object.entries(issues)
      .map(([metric, data]) => ({ metric, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  // Generate performance trends
  private generateTrends(reports: PerformanceReport[]): Array<{ date: string; score: number; metrics: PerformanceMetrics }> {
    const last30Days = reports
      .filter(report => Date.now() - report.timestamp < 30 * 24 * 60 * 60 * 1000)
      .sort((a, b) => a.timestamp - b.timestamp);

    // Group by day and calculate daily averages
    const dailyData: { [date: string]: { scores: number[]; metrics: PerformanceMetrics[] } } = {};

    last30Days.forEach(report => {
      const date = new Date(report.timestamp).toISOString().split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = { scores: [], metrics: [] };
      }
      dailyData[date].scores.push(this.calculateScore(report.metrics));
      dailyData[date].metrics.push(report.metrics);
    });

    return Object.entries(dailyData).map(([date, data]) => ({
      date,
      score: data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length,
      metrics: this.averageMetrics(data.metrics)
    }));
  }

  // Calculate average metrics
  private averageMetrics(metricsArray: PerformanceMetrics[]): PerformanceMetrics {
    const result: PerformanceMetrics = {};
    const keys = Object.keys(metricsArray[0] || {}) as (keyof PerformanceMetrics)[];

    keys.forEach(key => {
      const values = metricsArray.map(m => m[key]).filter(v => v !== undefined) as number[];
      if (values.length > 0) {
        result[key] = values.reduce((sum, val) => sum + val, 0) / values.length;
      }
    });

    return result;
  }

  // Check for performance alerts
  private checkPerformanceAlerts(report: PerformanceReport): void {
    const alerts: PerformanceAlert[] = [];
    const metrics = report.metrics;

    // Check each metric against thresholds
    if (metrics.fcp && metrics.fcp > this.alertThresholds.fcp) {
      alerts.push({
        id: `fcp_${report.timestamp}`,
        type: 'error',
        message: `First Contentful Paint is very slow: ${metrics.fcp.toFixed(0)}ms`,
        metric: 'fcp',
        value: metrics.fcp,
        threshold: this.alertThresholds.fcp,
        timestamp: report.timestamp,
        resolved: false
      });
    }

    if (metrics.lcp && metrics.lcp > this.alertThresholds.lcp) {
      alerts.push({
        id: `lcp_${report.timestamp}`,
        type: 'error',
        message: `Largest Contentful Paint is very slow: ${metrics.lcp.toFixed(0)}ms`,
        metric: 'lcp',
        value: metrics.lcp,
        threshold: this.alertThresholds.lcp,
        timestamp: report.timestamp,
        resolved: false
      });
    }

    if (metrics.fid && metrics.fid > this.alertThresholds.fid) {
      alerts.push({
        id: `fid_${report.timestamp}`,
        type: 'warning',
        message: `First Input Delay is high: ${metrics.fid.toFixed(0)}ms`,
        metric: 'fid',
        value: metrics.fid,
        threshold: this.alertThresholds.fid,
        timestamp: report.timestamp,
        resolved: false
      });
    }

    if (metrics.cls && metrics.cls > this.alertThresholds.cls) {
      alerts.push({
        id: `cls_${report.timestamp}`,
        type: 'warning',
        message: `Cumulative Layout Shift is high: ${metrics.cls.toFixed(3)}`,
        metric: 'cls',
        value: metrics.cls,
        threshold: this.alertThresholds.cls,
        timestamp: report.timestamp,
        resolved: false
      });
    }

    const score = this.calculateScore(metrics);
    if (score < this.alertThresholds.score) {
      alerts.push({
        id: `score_${report.timestamp}`,
        type: 'error',
        message: `Overall performance score is low: ${score.toFixed(0)}/100`,
        metric: 'score',
        value: score,
        threshold: this.alertThresholds.score,
        timestamp: report.timestamp,
        resolved: false
      });
    }

    // Store alerts
    if (alerts.length > 0) {
      this.storeAlerts(alerts);
    }
  }

  // Store performance alerts
  private storeAlerts(newAlerts: PerformanceAlert[]): void {
    try {
      const existingAlerts = this.getStoredAlerts();
      const updatedAlerts = [...newAlerts, ...existingAlerts].slice(0, 50); // Keep last 50 alerts
      localStorage.setItem(this.alertsKey, JSON.stringify(updatedAlerts));
    } catch (error) {
      console.error('Failed to store performance alerts:', error);
    }
  }

  // Get stored alerts
  public getStoredAlerts(): PerformanceAlert[] {
    try {
      const stored = localStorage.getItem(this.alertsKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to retrieve stored alerts:', error);
      return [];
    }
  }

  // Generate downloadable report
  public generateDownloadableReport(): string {
    const stats = this.generateStats();
    const reports = this.getStoredReports();
    const alerts = this.getStoredAlerts();

    const reportData = {
      generatedAt: new Date().toISOString(),
      summary: stats,
      recentReports: reports.slice(0, 10), // Last 10 reports
      activeAlerts: alerts.filter(alert => !alert.resolved),
      recommendations: this.generateRecommendations(stats)
    };

    return JSON.stringify(reportData, null, 2);
  }

  // Generate performance recommendations
  private generateRecommendations(stats: PerformanceStats): string[] {
    const recommendations: string[] = [];

    if (stats.averageScore < 70) {
      recommendations.push('Overall performance is poor. Consider a comprehensive performance audit.');
    }

    if (stats.topIssues.some(issue => issue.metric === 'fcp')) {
      recommendations.push('Optimize First Contentful Paint by reducing render-blocking resources.');
    }

    if (stats.topIssues.some(issue => issue.metric === 'lcp')) {
      recommendations.push('Improve Largest Contentful Paint by optimizing images and critical resources.');
    }

    if (stats.topIssues.some(issue => issue.metric === 'fid')) {
      recommendations.push('Reduce First Input Delay by implementing code splitting and reducing JavaScript execution time.');
    }

    if (stats.topIssues.some(issue => issue.metric === 'cls')) {
      recommendations.push('Fix Cumulative Layout Shift by ensuring images and ads have defined dimensions.');
    }

    if (stats.topIssues.some(issue => issue.metric === 'apiResponseTime')) {
      recommendations.push('Optimize API response times by implementing caching and backend optimizations.');
    }

    return recommendations;
  }

  // Clear all stored data
  public clearAllData(): void {
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.alertsKey);
    console.log('All performance data cleared');
  }

  // Export data for backup
  public exportData(): string {
    const data = {
      reports: this.getStoredReports(),
      alerts: this.getStoredAlerts(),
      stats: this.generateStats(),
      exportedAt: new Date().toISOString()
    };
    return JSON.stringify(data, null, 2);
  }
}

// Create singleton instance
export const performanceAnalytics = new PerformanceAnalytics();
export default performanceAnalytics;



