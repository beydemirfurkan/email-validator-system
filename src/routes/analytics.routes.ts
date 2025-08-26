import { Router, Request, Response } from 'express';
import { eq, and, desc, count, sum, sql } from 'drizzle-orm';
import { db } from '../database/connection';
import { validationLogs, contacts, contactLists } from '../database/schema';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { ResponseUtils } from '../utils/response.utils';
import { EmailValidationService } from '../services/email-validation.service';

const router = Router();

// All analytics routes require authentication
router.use(AuthMiddleware.authenticateToken);

// GET /api/analytics/dashboard - Get dashboard analytics
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { period = '30' } = req.query; // days

    const days = Math.min(365, Math.max(1, parseInt(period as string) || 30));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get validation logs count
    const validationStats = await db.select({
      totalValidations: count(),
      avgProcessingTime: sql<number>`AVG(${validationLogs.processingTimeMs})`
    })
    .from(validationLogs)
    .where(and(
      eq(validationLogs.userId, user.id),
      sql`${validationLogs.createdAt} >= ${startDate.toISOString()}`
    ));

    // Get contact lists count
    const contactListStats = await db.select({
      totalLists: count()
    })
    .from(contactLists)
    .where(and(
      eq(contactLists.userId, user.id),
      eq(contactLists.isActive, true)
    ));

    // Get contacts count by status
    const contactStats = await db.select({
      totalContacts: count(),
      validContacts: sql<number>`SUM(${contactLists.validContacts})`,
      invalidContacts: sql<number>`SUM(${contactLists.invalidContacts})`,
      riskyContacts: sql<number>`SUM(${contactLists.riskyContacts})`,
      unknownContacts: sql<number>`SUM(${contactLists.unknownContacts})`
    })
    .from(contactLists)
    .where(and(
      eq(contactLists.userId, user.id),
      eq(contactLists.isActive, true)
    ));

    // Get recent validation activity (last 7 days by day)
    const recentActivity = await db.select({
      date: sql<string>`DATE(${validationLogs.createdAt})`,
      validations: count()
    })
    .from(validationLogs)
    .where(and(
      eq(validationLogs.userId, user.id),
      sql`${validationLogs.createdAt} >= ${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}`
    ))
    .groupBy(sql`DATE(${validationLogs.createdAt})`)
    .orderBy(sql`DATE(${validationLogs.createdAt})`);

    const validationData = validationStats[0] || { totalValidations: 0, avgProcessingTime: 0 };
    const listData = contactListStats[0] || { totalLists: 0 };
    const contactData = contactStats[0] || { 
      totalContacts: 0, 
      validContacts: 0, 
      invalidContacts: 0, 
      riskyContacts: 0, 
      unknownContacts: 0 
    };

    return res.json(ResponseUtils.success({
      dashboard: {
        period: `${days} days`,
        validations: {
          total: validationData.totalValidations || 0,
          averageProcessingTime: Math.round(validationData.avgProcessingTime || 0)
        },
        contacts: {
          totalLists: listData.totalLists || 0,
          totalContacts: contactData.totalContacts || 0,
          valid: contactData.validContacts || 0,
          invalid: contactData.invalidContacts || 0,
          risky: contactData.riskyContacts || 0,
          unknown: contactData.unknownContacts || 0,
          validPercentage: contactData.totalContacts > 0 
            ? (((contactData.validContacts || 0) / contactData.totalContacts) * 100).toFixed(2)
            : '0.00'
        },
        recentActivity: recentActivity.map(activity => ({
          date: activity.date,
          validations: activity.validations || 0
        }))
      }
    }));
  } catch (error) {
    console.error('Dashboard analytics error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to fetch dashboard analytics', error as Error)
    );
  }
});

// GET /api/analytics/validation-logs - Get validation history
router.get('/validation-logs', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { page = '1', limit = '50', apiKeyId, startDate, endDate } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
    const offset = (pageNum - 1) * limitNum;

    // Build where conditions
    let whereConditions = [eq(validationLogs.userId, user.id)];

    if (apiKeyId && typeof apiKeyId === 'string') {
      const apiKeyIdNum = parseInt(apiKeyId);
      if (!isNaN(apiKeyIdNum)) {
        whereConditions.push(eq(validationLogs.apiKeyId, apiKeyIdNum));
      }
    }

    if (startDate && typeof startDate === 'string') {
      whereConditions.push(sql`${validationLogs.createdAt} >= ${startDate}`);
    }

    if (endDate && typeof endDate === 'string') {
      whereConditions.push(sql`${validationLogs.createdAt} <= ${endDate}`);
    }

    const logs = await db.select()
      .from(validationLogs)
      .where(and(...whereConditions))
      .orderBy(desc(validationLogs.createdAt))
      .limit(limitNum)
      .offset(offset);

    // Get total count
    const totalResult = await db.select({ count: count() })
      .from(validationLogs)
      .where(and(...whereConditions));

    const total = totalResult[0]?.count || 0;

    // Parse validation results
    const parsedLogs = logs.map(log => ({
      ...log,
      validationResult: log.validationResult ? JSON.parse(log.validationResult as string) : null
    }));

    return res.json(ResponseUtils.createPaginatedResponse(
      parsedLogs,
      pageNum,
      limitNum,
      total
    ));
  } catch (error) {
    console.error('Validation logs fetch error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to fetch validation logs', error as Error)
    );
  }
});

// GET /api/analytics/top-domains - Get most validated domains
router.get('/top-domains', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { limit = '10', period = '30' } = req.query;

    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string) || 10));
    const days = Math.min(365, Math.max(1, parseInt(period as string) || 30));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // This query would be more complex in practice, but for demo purposes:
    const topDomains = await db.select({
      domain: sql<string>`SUBSTR(${validationLogs.emailValidated}, INSTR(${validationLogs.emailValidated}, '@') + 1)`,
      validationCount: count()
    })
    .from(validationLogs)
    .where(and(
      eq(validationLogs.userId, user.id),
      sql`${validationLogs.createdAt} >= ${startDate.toISOString()}`
    ))
    .groupBy(sql`SUBSTR(${validationLogs.emailValidated}, INSTR(${validationLogs.emailValidated}, '@') + 1)`)
    .orderBy(desc(count()))
    .limit(limitNum);

    return res.json(ResponseUtils.success({
      topDomains: topDomains.map(domain => ({
        domain: domain.domain,
        validationCount: domain.validationCount,
        percentage: '0.00' // Would calculate based on total validations
      })),
      period: `${days} days`
    }));
  } catch (error) {
    console.error('Top domains fetch error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to fetch top domains', error as Error)
    );
  }
});

// GET /api/analytics/validation-trends - Get validation trends over time
router.get('/validation-trends', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { period = '30', groupBy = 'day' } = req.query;

    const days = Math.min(365, Math.max(1, parseInt(period as string) || 30));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let groupByClause: any;
    let dateFormat: string;

    switch (groupBy) {
      case 'hour':
        groupByClause = sql`strftime('%Y-%m-%d %H:00:00', ${validationLogs.createdAt})`;
        dateFormat = '%Y-%m-%d %H:00:00';
        break;
      case 'week':
        groupByClause = sql`strftime('%Y-W%W', ${validationLogs.createdAt})`;
        dateFormat = '%Y-W%W';
        break;
      case 'month':
        groupByClause = sql`strftime('%Y-%m', ${validationLogs.createdAt})`;
        dateFormat = '%Y-%m';
        break;
      default: // day
        groupByClause = sql`strftime('%Y-%m-%d', ${validationLogs.createdAt})`;
        dateFormat = '%Y-%m-%d';
        break;
    }

    const trends = await db.select({
      period: groupByClause,
      totalValidations: count(),
      avgProcessingTime: sql<number>`AVG(${validationLogs.processingTimeMs})`
    })
    .from(validationLogs)
    .where(and(
      eq(validationLogs.userId, user.id),
      sql`${validationLogs.createdAt} >= ${startDate.toISOString()}`
    ))
    .groupBy(groupByClause)
    .orderBy(groupByClause);

    return res.json(ResponseUtils.success({
      trends: trends.map(trend => ({
        period: trend.period,
        validations: trend.totalValidations || 0,
        averageProcessingTime: Math.round(trend.avgProcessingTime || 0)
      })),
      groupBy,
      periodDays: days
    }));
  } catch (error) {
    console.error('Validation trends fetch error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to fetch validation trends', error as Error)
    );
  }
});

// GET /api/analytics/system-stats - Get system-wide statistics (admin or general stats)
router.get('/system-stats', async (req: Request, res: Response) => {
  try {
    // Get email validation service cache statistics
    const emailValidator = new EmailValidationService();
    const cacheStats = emailValidator.getCacheStatistics();

    // Get basic system info
    const systemStats = {
      cache: {
        size: cacheStats.size,
        hitRate: cacheStats.hitRate.toFixed(2),
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        evictions: cacheStats.evictions
      },
      system: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        nodeVersion: process.version,
        platform: process.platform
      },
      api: {
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'development'
      }
    };

    return res.json(ResponseUtils.success({
      systemStats
    }));
  } catch (error) {
    console.error('System stats fetch error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to fetch system stats', error as Error)
    );
  }
});

// POST /api/analytics/cache/clear - Clear system cache
router.post('/cache/clear', async (req: Request, res: Response) => {
  try {
    const emailValidator = new EmailValidationService();
    
    // Get stats before clearing
    const beforeStats = emailValidator.getCacheStatistics();
    
    // Clear cache
    emailValidator.clearMxCache();
    
    // Get stats after clearing
    const afterStats = emailValidator.getCacheStatistics();

    return res.json(ResponseUtils.success({
      message: 'Cache cleared successfully',
      before: {
        size: beforeStats.size,
        hits: beforeStats.hits,
        misses: beforeStats.misses
      },
      after: {
        size: afterStats.size,
        hits: afterStats.hits,
        misses: afterStats.misses
      }
    }));
  } catch (error) {
    console.error('Cache clear error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to clear cache', error as Error)
    );
  }
});

export { router as analyticsRoutes };