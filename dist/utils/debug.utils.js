"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebugUtils = void 0;
const perf_hooks_1 = require("perf_hooks");
class DebugUtils {
    static requestMetrics = [];
    static maxMetricsHistory = 1000;
    static performanceThreshold = 1000;
    static requestLogger() {
        return (req, res, next) => {
            const startTime = perf_hooks_1.performance.now();
            const startMemory = process.memoryUsage();
            const requestMetric = {
                method: req.method,
                url: req.url,
                startTime,
                userAgent: req.headers['user-agent'],
                ip: (req.ip || req.connection.remoteAddress),
                userId: req.user?.id,
                memoryUsage: startMemory
            };
            const originalEnd = res.end;
            res.end = function (chunk, encoding) {
                const endTime = perf_hooks_1.performance.now();
                const duration = endTime - startTime;
                requestMetric.endTime = endTime;
                requestMetric.duration = duration;
                requestMetric.statusCode = res.statusCode;
                const contentLengthHeader = res.get('content-length');
                requestMetric.contentLength = contentLengthHeader ?
                    parseInt(contentLengthHeader) : undefined;
                if (duration > DebugUtils.performanceThreshold) {
                    console.warn(`🐌 SLOW REQUEST: ${req.method} ${req.url} took ${duration.toFixed(2)}ms`);
                }
                DebugUtils.requestMetrics.push(requestMetric);
                if (DebugUtils.requestMetrics.length > DebugUtils.maxMetricsHistory) {
                    DebugUtils.requestMetrics.shift();
                }
                return originalEnd.call(this, chunk, encoding);
            };
            next();
        };
    }
    static errorTracker() {
        return (error, req, res, next) => {
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
            console.error('🚨 API ERROR:', errorInfo);
            const latestMetric = DebugUtils.requestMetrics[DebugUtils.requestMetrics.length - 1];
            if (latestMetric && latestMetric.url === req.url) {
                latestMetric.error = error.message;
            }
            next(error);
        };
    }
    static getRequestMetrics() {
        const now = perf_hooks_1.performance.now();
        const recentMetrics = DebugUtils.requestMetrics.filter(metric => now - metric.startTime < 300000);
        const totalRequests = recentMetrics.length;
        const errorCount = recentMetrics.filter(m => m.error || (m.statusCode && m.statusCode >= 400)).length;
        const averageResponseTime = totalRequests > 0 ?
            recentMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / totalRequests : 0;
        const slowRequests = recentMetrics.filter(m => (m.duration || 0) > DebugUtils.performanceThreshold);
        const endpointStats = {};
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
    static getMemoryStats() {
        const usage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        return {
            memory: {
                rss: Math.round(usage.rss / 1024 / 1024),
                heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
                heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
                external: Math.round(usage.external / 1024 / 1024),
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
    static async getDatabaseStats() {
        try {
            const { pooledDb } = await Promise.resolve().then(() => __importStar(require('../database/connection-pool')));
            return await pooledDb.healthCheck();
        }
        catch (error) {
            return {
                healthy: false,
                error: error instanceof Error ? error.message : 'Unknown database error',
                stats: {}
            };
        }
    }
    static getValidationStats() {
        try {
            const { MxCache } = require('../services/mx-cache.service');
            const cacheInstance = MxCache.getInstance();
            return {
                cacheStats: cacheInstance.getStats(),
                cacheSize: cacheInstance.size(),
                hitRate: cacheInstance.getHitRate()
            };
        }
        catch (error) {
            return {
                error: 'Failed to get validation stats',
                cacheStats: null
            };
        }
    }
    static async getSystemHealth() {
        const memoryStats = DebugUtils.getMemoryStats();
        const requestStats = DebugUtils.getRequestMetrics();
        const dbStats = await DebugUtils.getDatabaseStats();
        const validationStats = DebugUtils.getValidationStats();
        let healthScore = 100;
        const issues = [];
        if (parseFloat(memoryStats.memory.heapUsagePercentage) > 90) {
            healthScore -= 30;
            issues.push('High memory usage detected');
        }
        if (requestStats.averageResponseTime > 2000) {
            healthScore -= 20;
            issues.push('High average response time');
        }
        if (requestStats.errorRate > 10) {
            healthScore -= 25;
            issues.push('High error rate detected');
        }
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
    static createProfiler(operationName) {
        const startTime = perf_hooks_1.performance.now();
        const startMemory = process.memoryUsage();
        return {
            end: () => {
                const endTime = perf_hooks_1.performance.now();
                const endMemory = process.memoryUsage();
                const duration = endTime - startTime;
                const memoryDiff = endMemory.heapUsed - startMemory.heapUsed;
                const profile = {
                    operation: operationName,
                    duration: parseFloat(duration.toFixed(2)),
                    memoryDelta: Math.round(memoryDiff / 1024),
                    timestamp: new Date().toISOString()
                };
                if (duration > 500) {
                    console.warn(`🐌 SLOW OPERATION: ${operationName} took ${duration.toFixed(2)}ms`);
                }
                return profile;
            }
        };
    }
    static debugRequest(options) {
        const timeRange = options.timeRange || 60;
        const cutoff = perf_hooks_1.performance.now() - (timeRange * 60 * 1000);
        let filteredMetrics = DebugUtils.requestMetrics.filter(metric => metric.startTime > cutoff);
        if (options.userId) {
            filteredMetrics = filteredMetrics.filter(metric => metric.userId === options.userId);
        }
        if (options.endpoint) {
            filteredMetrics = filteredMetrics.filter(metric => metric.url.includes(options.endpoint));
        }
        if (options.method) {
            filteredMetrics = filteredMetrics.filter(metric => metric.method === options.method);
        }
        return {
            matchingRequests: filteredMetrics.length,
            requests: filteredMetrics.map(metric => ({
                timestamp: new Date(Date.now() - (perf_hooks_1.performance.now() - metric.startTime)).toISOString(),
                method: metric.method,
                url: metric.url,
                duration: metric.duration,
                statusCode: metric.statusCode,
                error: metric.error
            }))
        };
    }
    static clearMetrics() {
        DebugUtils.requestMetrics = [];
        console.log('📊 Request metrics cleared');
    }
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
exports.DebugUtils = DebugUtils;
//# sourceMappingURL=debug.utils.js.map