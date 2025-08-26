import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';

interface RequestMetrics {
  method: string;
  url: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  statusCode?: number;
  contentLength?: number;
  userAgent?: string | undefined;
  ip?: string | undefined;
  userId?: number | undefined;
  apiKeyId?: number | undefined;
  memoryUsage?: NodeJS.MemoryUsage;
  error?: string;
}

class DebugUtils {
  private static requestMetrics: RequestMetrics[] = [];
  private static maxMetricsHistory = 1000;
  private static performanceThreshold = 1000; // Log requests taking over 1 second

  // Request timing and monitoring middleware
  static requestLogger() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = performance.now();
      const startMemory = process.memoryUsage();

      const requestMetric: RequestMetrics = {
        method: req.method,
        url: req.url,
        startTime,
        userAgent: req.headers['user-agent'] as string | undefined,
        ip: (req.ip || req.connection.remoteAddress) as string | undefined,
        userId: req.user?.id as number | undefined,
        memoryUsage: startMemory
      };

      // Capture original end function
      const originalEnd = res.end;

      res.end = function(chunk?: any, encoding?: any) {
        const endTime = performance.now();
        const duration = endTime - startTime;

        requestMetric.endTime = endTime;
        requestMetric.duration = duration;
        requestMetric.statusCode = res.statusCode;
        const contentLengthHeader = res.get('content-length');
        requestMetric.contentLength = contentLengthHeader ? 
          parseInt(contentLengthHeader) : undefined;

        // Log performance issues
        if (duration > DebugUtils.performanceThreshold) {
          console.warn(`🐌 SLOW REQUEST: ${req.method} ${req.url} took ${duration.toFixed(2)}ms`);
        }

        // Store metrics (keep only recent requests)
        DebugUtils.requestMetrics.push(requestMetric);
        if (DebugUtils.requestMetrics.length > DebugUtils.maxMetricsHistory) {
          DebugUtils.requestMetrics.shift();
        }

        // Call original end function
        return originalEnd.call(this, chunk, encoding);
      };

      next();
    };
  }

  // Error tracking middleware
  static errorTracker() {
    return (error: Error, req: Request, res: Response, next: NextFunction) => {
      const errorInfo = {
        message: error.message,
        stack: error.stack,
        method: req.method,
        url: req.url,
        timestamp: new Date().toISOString(),
        userId: req.user?.id,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      };

      // Log error details
      console.error('🚨 API ERROR:', errorInfo);

      // Update request metrics if exists
      const latestMetric = DebugUtils.requestMetrics[DebugUtils.requestMetrics.length - 1];
      if (latestMetric && latestMetric.url === req.url) {
        latestMetric.error = error.message;
      }

      next(error);
    };
  }

  // Get request metrics summary
  static getRequestMetrics() {
    const now = performance.now();
    const recentMetrics = DebugUtils.requestMetrics.filter(
      metric => now - metric.startTime < 300000 // Last 5 minutes
    );

    const totalRequests = recentMetrics.length;
    const errorCount = recentMetrics.filter(m => m.error || (m.statusCode && m.statusCode >= 400)).length;
    const averageResponseTime = totalRequests > 0 ? 
      recentMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / totalRequests : 0;
    
    const slowRequests = recentMetrics.filter(m => (m.duration || 0) > DebugUtils.performanceThreshold);
    
    // Group by endpoint
    const endpointStats: { [key: string]: any } = {};
    recentMetrics.forEach(metric => {
      const endpoint = `${metric.method} ${metric.url.split('?')[0]}`;
      if (!endpointStats[endpoint]) {
        endpointStats[endpoint] = {
          count: 0,
          totalDuration: 0,
          errors: 0,
          averageResponseTime: 0
        };
      }
      
      endpointStats[endpoint].count++;
      endpointStats[endpoint].totalDuration += metric.duration || 0;
      if (metric.error || (metric.statusCode && metric.statusCode >= 400)) {
        endpointStats[endpoint].errors++;
      }
    });

    // Calculate averages
    Object.keys(endpointStats).forEach(endpoint => {
      const stats = endpointStats[endpoint];
      stats.averageResponseTime = stats.totalDuration / stats.count;
      stats.errorRate = (stats.errors / stats.count) * 100;
    });

    return {
      totalRequests,
      errorCount,
      errorRate: totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0,
      averageResponseTime: parseFloat(averageResponseTime.toFixed(2)),
      slowRequestCount: slowRequests.length,
      endpointStats
    };
  }

  // Memory usage monitoring
  static getMemoryStats() {
    const usage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      memory: {
        rss: Math.round(usage.rss / 1024 / 1024), // MB
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
        external: Math.round(usage.external / 1024 / 1024), // MB
        heapUsagePercentage: ((usage.heapUsed / usage.heapTotal) * 100).toFixed(2)
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: process.uptime(),
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform
    };
  }

  // Database performance monitoring
  static async getDatabaseStats() {
    try {
      const { pooledDb } = await import('../database/connection-pool');
      return await pooledDb.healthCheck();
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown database error',
        stats: {}
      };
    }
  }

  // Email validation service statistics
  static getValidationStats() {
    try {
      // Import MxCache to get cache statistics
      const { MxCache } = require('../services/mx-cache.service');
      const cacheInstance = MxCache.getInstance();
      
      return {
        cacheStats: cacheInstance.getStats(),
        cacheSize: cacheInstance.size(),
        hitRate: cacheInstance.getHitRate()
      };
    } catch (error) {
      return {
        error: 'Failed to get validation stats',
        cacheStats: null
      };
    }
  }

  // System health check
  static async getSystemHealth() {
    const memoryStats = DebugUtils.getMemoryStats();
    const requestStats = DebugUtils.getRequestMetrics();
    const dbStats = await DebugUtils.getDatabaseStats();
    const validationStats = DebugUtils.getValidationStats();

    // Determine overall health
    let healthScore = 100;
    const issues = [];

    // Memory health check
    if (parseFloat(memoryStats.memory.heapUsagePercentage) > 90) {
      healthScore -= 30;
      issues.push('High memory usage detected');
    }

    // Request performance check
    if (requestStats.averageResponseTime > 2000) {
      healthScore -= 20;
      issues.push('High average response time');
    }

    // Error rate check
    if (requestStats.errorRate > 10) {
      healthScore -= 25;
      issues.push('High error rate detected');
    }

    // Database health check
    if (!dbStats.healthy) {
      healthScore -= 40;
      issues.push('Database issues detected');
    }

    const status = healthScore > 80 ? 'healthy' : healthScore > 50 ? 'degraded' : 'unhealthy';

    return {
      status,
      healthScore,
      issues,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      components: {
        memory: memoryStats,
        requests: requestStats,
        database: dbStats,
        validation: validationStats
      }
    };
  }

  // Performance profiler for specific operations
  static createProfiler(operationName: string) {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();

    return {
      end: () => {
        const endTime = performance.now();
        const endMemory = process.memoryUsage();
        const duration = endTime - startTime;
        const memoryDiff = endMemory.heapUsed - startMemory.heapUsed;

        const profile = {
          operation: operationName,
          duration: parseFloat(duration.toFixed(2)),
          memoryDelta: Math.round(memoryDiff / 1024), // KB
          timestamp: new Date().toISOString()
        };

        // Log slow operations
        if (duration > 500) {
          console.warn(`🐌 SLOW OPERATION: ${operationName} took ${duration.toFixed(2)}ms`);
        }

        return profile;
      }
    };
  }

  // Request debugger for specific user/endpoint
  static debugRequest(options: {
    userId?: number;
    endpoint?: string;
    method?: string;
    timeRange?: number; // minutes
  }) {
    const timeRange = options.timeRange || 60; // Default 1 hour
    const cutoff = performance.now() - (timeRange * 60 * 1000);

    let filteredMetrics = DebugUtils.requestMetrics.filter(metric => 
      metric.startTime > cutoff
    );

    if (options.userId) {
      filteredMetrics = filteredMetrics.filter(metric => 
        metric.userId === options.userId
      );
    }

    if (options.endpoint) {
      filteredMetrics = filteredMetrics.filter(metric => 
        metric.url.includes(options.endpoint!)
      );
    }

    if (options.method) {
      filteredMetrics = filteredMetrics.filter(metric => 
        metric.method === options.method
      );
    }

    return {
      matchingRequests: filteredMetrics.length,
      requests: filteredMetrics.map(metric => ({
        timestamp: new Date(Date.now() - (performance.now() - metric.startTime)).toISOString(),
        method: metric.method,
        url: metric.url,
        duration: metric.duration,
        statusCode: metric.statusCode,
        error: metric.error
      }))
    };
  }

  // Clear metrics history
  static clearMetrics() {
    DebugUtils.requestMetrics = [];
    console.log('📊 Request metrics cleared');
  }

  // Export metrics to file
  static exportMetrics() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `api-metrics-${timestamp}.json`;
    
    const exportData = {
      exportTimestamp: new Date().toISOString(),
      systemHealth: DebugUtils.getSystemHealth(),
      requestMetrics: DebugUtils.requestMetrics,
      memoryStats: DebugUtils.getMemoryStats()
    };

    require('fs').writeFileSync(filename, JSON.stringify(exportData, null, 2));
    console.log(`📄 Metrics exported to ${filename}`);
    
    return filename;
  }
}

export { DebugUtils };