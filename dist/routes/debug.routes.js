"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.debugRoutes = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const response_utils_1 = require("../utils/response.utils");
const debug_utils_1 = require("../utils/debug.utils");
const router = (0, express_1.Router)();
exports.debugRoutes = router;
router.use(auth_middleware_1.AuthMiddleware.authenticateToken);
router.get('/system-health', async (req, res) => {
    try {
        const healthData = await debug_utils_1.DebugUtils.getSystemHealth();
        return res.json(response_utils_1.ResponseUtils.success({
            health: healthData
        }));
    }
    catch (error) {
        console.error('System health check error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to get system health', error));
    }
});
router.get('/request-metrics', async (req, res) => {
    try {
        const metrics = debug_utils_1.DebugUtils.getRequestMetrics();
        return res.json(response_utils_1.ResponseUtils.success({
            metrics
        }));
    }
    catch (error) {
        console.error('Request metrics error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to get request metrics', error));
    }
});
router.get('/memory-stats', async (req, res) => {
    try {
        const memoryStats = debug_utils_1.DebugUtils.getMemoryStats();
        return res.json(response_utils_1.ResponseUtils.success({
            memory: memoryStats
        }));
    }
    catch (error) {
        console.error('Memory stats error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to get memory stats', error));
    }
});
router.get('/database-stats', async (req, res) => {
    try {
        const dbStats = await debug_utils_1.DebugUtils.getDatabaseStats();
        return res.json(response_utils_1.ResponseUtils.success({
            database: dbStats
        }));
    }
    catch (error) {
        console.error('Database stats error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to get database stats', error));
    }
});
router.get('/validation-stats', async (req, res) => {
    try {
        const validationStats = debug_utils_1.DebugUtils.getValidationStats();
        return res.json(response_utils_1.ResponseUtils.success({
            validation: validationStats
        }));
    }
    catch (error) {
        console.error('Validation stats error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to get validation stats', error));
    }
});
router.post('/search-requests', async (req, res) => {
    try {
        const { userId, endpoint, method, timeRange } = req.body;
        const debugResults = debug_utils_1.DebugUtils.debugRequest({
            userId,
            endpoint,
            method,
            timeRange
        });
        return res.json(response_utils_1.ResponseUtils.success({
            searchResults: debugResults
        }));
    }
    catch (error) {
        console.error('Request search error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to search requests', error));
    }
});
router.post('/export-metrics', async (req, res) => {
    try {
        const filename = debug_utils_1.DebugUtils.exportMetrics();
        return res.json(response_utils_1.ResponseUtils.success({
            message: 'Metrics exported successfully',
            filename
        }));
    }
    catch (error) {
        console.error('Metrics export error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to export metrics', error));
    }
});
router.delete('/clear-metrics', async (req, res) => {
    try {
        debug_utils_1.DebugUtils.clearMetrics();
        return res.json(response_utils_1.ResponseUtils.success({
            message: 'Request metrics cleared successfully'
        }));
    }
    catch (error) {
        console.error('Clear metrics error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to clear metrics', error));
    }
});
router.get('/performance-profile/:operation', async (req, res) => {
    try {
        const { operation } = req.params;
        const profiler = debug_utils_1.DebugUtils.createProfiler(`Manual profile: ${operation}`);
        await new Promise(resolve => setTimeout(resolve, 10));
        const profile = profiler.end();
        return res.json(response_utils_1.ResponseUtils.success({
            profile,
            note: 'This is a sample profile. Use DebugUtils.createProfiler() in your code to profile actual operations.'
        }));
    }
    catch (error) {
        console.error('Performance profile error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to create performance profile', error));
    }
});
router.post('/stress-test', async (req, res) => {
    try {
        const { operations = 100, concurrency = 10 } = req.body;
        const startTime = Date.now();
        const startMemory = process.memoryUsage();
        const promises = [];
        for (let i = 0; i < concurrency; i++) {
            promises.push((async () => {
                const results = [];
                for (let j = 0; j < Math.floor(operations / concurrency); j++) {
                    const profiler = debug_utils_1.DebugUtils.createProfiler(`stress-test-op-${i}-${j}`);
                    await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
                    results.push(profiler.end());
                }
                return results;
            })());
        }
        const concurrentResults = await Promise.all(promises);
        const allResults = concurrentResults.flat();
        const endTime = Date.now();
        const endMemory = process.memoryUsage();
        const totalDuration = endTime - startTime;
        const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed;
        const stressTestResults = {
            totalOperations: allResults.length,
            totalDuration,
            averageOperationTime: allResults.reduce((sum, r) => sum + r.duration, 0) / allResults.length,
            operationsPerSecond: (allResults.length / (totalDuration / 1000)),
            memoryIncrease: Math.round(memoryIncrease / 1024),
            concurrency,
            results: allResults.slice(0, 10)
        };
        return res.json(response_utils_1.ResponseUtils.success({
            stressTest: stressTestResults,
            message: `Completed ${allResults.length} operations in ${totalDuration}ms`
        }));
    }
    catch (error) {
        console.error('Stress test error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to run stress test', error));
    }
});
router.get('/endpoints', async (req, res) => {
    try {
        const endpoints = [
            'GET /api/debug/system-health - Comprehensive system health check',
            'GET /api/debug/request-metrics - API request performance metrics',
            'GET /api/debug/memory-stats - Memory and CPU usage statistics',
            'GET /api/debug/database-stats - Database connection pool statistics',
            'GET /api/debug/validation-stats - Email validation cache statistics',
            'POST /api/debug/search-requests - Search request history',
            'POST /api/debug/export-metrics - Export metrics to file',
            'DELETE /api/debug/clear-metrics - Clear metrics history',
            'GET /api/debug/performance-profile/:operation - Profile operation performance',
            'POST /api/debug/stress-test - Run mini stress test',
            'GET /api/debug/endpoints - List all debug endpoints (this endpoint)'
        ];
        return res.json(response_utils_1.ResponseUtils.success({
            debugEndpoints: endpoints,
            note: 'All debug endpoints require authentication'
        }));
    }
    catch (error) {
        console.error('Debug endpoints error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to list debug endpoints', error));
    }
});
//# sourceMappingURL=debug.routes.js.map