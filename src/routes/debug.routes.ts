import { Router, Request, Response } from 'express';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { ResponseUtils } from '../utils/response.utils';
import { DebugUtils } from '../utils/debug.utils';
import { upstashCache } from '../services/upstash-cache.service';

const router = Router();

// All debug routes require authentication
router.use(AuthMiddleware.authenticateToken);

// GET /api/debug/system-health - Get comprehensive system health
router.get('/system-health', async (req: Request, res: Response) => {
  try {
    const systemHealth = await DebugUtils.getSystemHealth();
    const cacheStats = await upstashCache.getStats();
    const memoryStats = DebugUtils.getMemoryStats();
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      security: {
        helmet: process.env.NODE_ENV === 'production',
        cors: true,
        rateLimit: true,
        cache: cacheStats.connected
      },
      cache: {
        provider: 'upstash-redis',
        connected: cacheStats.connected,
        secure: true,
        stats: cacheStats
      },
      memory: memoryStats,
      database: {
        type: 'sqlite',
        connected: true,
        pooled: true
      },
      systemHealth
    };
    
    return res.json(ResponseUtils.success({
      health: health
    }));
  } catch (error) {
    console.error('System health check error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to get system health', error as Error)
    );
  }
});

// GET /api/debug/request-metrics - Get API request metrics
router.get('/request-metrics', async (req: Request, res: Response) => {
  try {
    const metrics = DebugUtils.getRequestMetrics();
    
    return res.json(ResponseUtils.success({
      metrics
    }));
  } catch (error) {
    console.error('Request metrics error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to get request metrics', error as Error)
    );
  }
});

// GET /api/debug/memory-stats - Get memory and CPU usage
router.get('/memory-stats', async (req: Request, res: Response) => {
  try {
    const memoryStats = DebugUtils.getMemoryStats();
    
    return res.json(ResponseUtils.success({
      memory: memoryStats
    }));
  } catch (error) {
    console.error('Memory stats error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to get memory stats', error as Error)
    );
  }
});

// GET /api/debug/database-stats - Get database connection pool stats
router.get('/database-stats', async (req: Request, res: Response) => {
  try {
    const dbStats = await DebugUtils.getDatabaseStats();
    
    return res.json(ResponseUtils.success({
      database: dbStats
    }));
  } catch (error) {
    console.error('Database stats error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to get database stats', error as Error)
    );
  }
});

// GET /api/debug/validation-stats - Get email validation cache statistics
router.get('/validation-stats', async (req: Request, res: Response) => {
  try {
    const validationStats = DebugUtils.getValidationStats();
    
    return res.json(ResponseUtils.success({
      validation: validationStats
    }));
  } catch (error) {
    console.error('Validation stats error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to get validation stats', error as Error)
    );
  }
});

// POST /api/debug/search-requests - Search request history
router.post('/search-requests', async (req: Request, res: Response) => {
  try {
    const { userId, endpoint, method, timeRange } = req.body;
    
    const debugResults = DebugUtils.debugRequest({
      userId,
      endpoint,
      method,
      timeRange
    });
    
    return res.json(ResponseUtils.success({
      searchResults: debugResults
    }));
  } catch (error) {
    console.error('Request search error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to search requests', error as Error)
    );
  }
});

// POST /api/debug/export-metrics - Export metrics to file
router.post('/export-metrics', async (req: Request, res: Response) => {
  try {
    const filename = DebugUtils.exportMetrics();
    
    return res.json(ResponseUtils.success({
      message: 'Metrics exported successfully',
      filename
    }));
  } catch (error) {
    console.error('Metrics export error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to export metrics', error as Error)
    );
  }
});

// DELETE /api/debug/clear-metrics - Clear request metrics history
router.delete('/clear-metrics', async (req: Request, res: Response) => {
  try {
    DebugUtils.clearMetrics();
    
    return res.json(ResponseUtils.success({
      message: 'Request metrics cleared successfully'
    }));
  } catch (error) {
    console.error('Clear metrics error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to clear metrics', error as Error)
    );
  }
});

// GET /api/debug/performance-profile/:operation - Get performance profile for operation
router.get('/performance-profile/:operation', async (req: Request, res: Response) => {
  try {
    const { operation } = req.params;
    
    // Create a profiler and simulate the operation
    const profiler = DebugUtils.createProfiler(`Manual profile: ${operation}`);
    
    // Simulate work (in real usage, this would wrap actual operations)
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const profile = profiler.end();
    
    return res.json(ResponseUtils.success({
      profile,
      note: 'This is a sample profile. Use DebugUtils.createProfiler() in your code to profile actual operations.'
    }));
  } catch (error) {
    console.error('Performance profile error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to create performance profile', error as Error)
    );
  }
});

// POST /api/debug/stress-test - Run a mini stress test
router.post('/stress-test', async (req: Request, res: Response) => {
  try {
    const { operations = 100, concurrency = 10 } = req.body;
    
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    
    // Simulate concurrent operations
    const promises = [];
    for (let i = 0; i < concurrency; i++) {
      promises.push(
        (async () => {
          const results = [];
          for (let j = 0; j < Math.floor(operations / concurrency); j++) {
            // Simulate work
            const profiler = DebugUtils.createProfiler(`stress-test-op-${i}-${j}`);
            await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
            results.push(profiler.end());
          }
          return results;
        })()
      );
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
      memoryIncrease: Math.round(memoryIncrease / 1024), // KB
      concurrency,
      results: allResults.slice(0, 10) // First 10 results as sample
    };
    
    return res.json(ResponseUtils.success({
      stressTest: stressTestResults,
      message: `Completed ${allResults.length} operations in ${totalDuration}ms`
    }));
  } catch (error) {
    console.error('Stress test error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to run stress test', error as Error)
    );
  }
});

// GET /api/debug/endpoints - List all available debug endpoints
router.get('/endpoints', async (req: Request, res: Response) => {
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
    
    return res.json(ResponseUtils.success({
      debugEndpoints: endpoints,
      note: 'All debug endpoints require authentication'
    }));
  } catch (error) {
    console.error('Debug endpoints error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to list debug endpoints', error as Error)
    );
  }
});

export { router as debugRoutes };