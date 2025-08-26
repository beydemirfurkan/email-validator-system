"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsRoutes = void 0;
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const connection_1 = require("../database/connection");
const schema_1 = require("../database/schema");
const auth_middleware_1 = require("../middleware/auth.middleware");
const response_utils_1 = require("../utils/response.utils");
const email_validation_service_1 = require("../services/email-validation.service");
const router = (0, express_1.Router)();
exports.analyticsRoutes = router;
router.use(auth_middleware_1.AuthMiddleware.authenticateToken);
router.get('/dashboard', async (req, res) => {
    try {
        const user = req.user;
        const { period = '30' } = req.query;
        const days = Math.min(365, Math.max(1, parseInt(period) || 30));
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const validationStats = await connection_1.db.select({
            totalValidations: (0, drizzle_orm_1.count)(),
            avgProcessingTime: (0, drizzle_orm_1.sql) `AVG(${schema_1.validationLogs.processingTimeMs})`
        })
            .from(schema_1.validationLogs)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.validationLogs.userId, user.id), (0, drizzle_orm_1.sql) `${schema_1.validationLogs.createdAt} >= ${startDate.toISOString()}`));
        const contactListStats = await connection_1.db.select({
            totalLists: (0, drizzle_orm_1.count)()
        })
            .from(schema_1.contactLists)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.contactLists.userId, user.id), (0, drizzle_orm_1.eq)(schema_1.contactLists.isActive, true)));
        const contactStats = await connection_1.db.select({
            totalContacts: (0, drizzle_orm_1.count)(),
            validContacts: (0, drizzle_orm_1.sql) `SUM(${schema_1.contactLists.validContacts})`,
            invalidContacts: (0, drizzle_orm_1.sql) `SUM(${schema_1.contactLists.invalidContacts})`,
            riskyContacts: (0, drizzle_orm_1.sql) `SUM(${schema_1.contactLists.riskyContacts})`,
            unknownContacts: (0, drizzle_orm_1.sql) `SUM(${schema_1.contactLists.unknownContacts})`
        })
            .from(schema_1.contactLists)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.contactLists.userId, user.id), (0, drizzle_orm_1.eq)(schema_1.contactLists.isActive, true)));
        const recentActivity = await connection_1.db.select({
            date: (0, drizzle_orm_1.sql) `DATE(${schema_1.validationLogs.createdAt})`,
            validations: (0, drizzle_orm_1.count)()
        })
            .from(schema_1.validationLogs)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.validationLogs.userId, user.id), (0, drizzle_orm_1.sql) `${schema_1.validationLogs.createdAt} >= ${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}`))
            .groupBy((0, drizzle_orm_1.sql) `DATE(${schema_1.validationLogs.createdAt})`)
            .orderBy((0, drizzle_orm_1.sql) `DATE(${schema_1.validationLogs.createdAt})`);
        const validationData = validationStats[0] || { totalValidations: 0, avgProcessingTime: 0 };
        const listData = contactListStats[0] || { totalLists: 0 };
        const contactData = contactStats[0] || {
            totalContacts: 0,
            validContacts: 0,
            invalidContacts: 0,
            riskyContacts: 0,
            unknownContacts: 0
        };
        return res.json(response_utils_1.ResponseUtils.success({
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
    }
    catch (error) {
        console.error('Dashboard analytics error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to fetch dashboard analytics', error));
    }
});
router.get('/validation-logs', async (req, res) => {
    try {
        const user = req.user;
        const { page = '1', limit = '50', apiKeyId, startDate, endDate } = req.query;
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
        const offset = (pageNum - 1) * limitNum;
        let whereConditions = [(0, drizzle_orm_1.eq)(schema_1.validationLogs.userId, user.id)];
        if (apiKeyId && typeof apiKeyId === 'string') {
            const apiKeyIdNum = parseInt(apiKeyId);
            if (!isNaN(apiKeyIdNum)) {
                whereConditions.push((0, drizzle_orm_1.eq)(schema_1.validationLogs.apiKeyId, apiKeyIdNum));
            }
        }
        if (startDate && typeof startDate === 'string') {
            whereConditions.push((0, drizzle_orm_1.sql) `${schema_1.validationLogs.createdAt} >= ${startDate}`);
        }
        if (endDate && typeof endDate === 'string') {
            whereConditions.push((0, drizzle_orm_1.sql) `${schema_1.validationLogs.createdAt} <= ${endDate}`);
        }
        const logs = await connection_1.db.select()
            .from(schema_1.validationLogs)
            .where((0, drizzle_orm_1.and)(...whereConditions))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.validationLogs.createdAt))
            .limit(limitNum)
            .offset(offset);
        const totalResult = await connection_1.db.select({ count: (0, drizzle_orm_1.count)() })
            .from(schema_1.validationLogs)
            .where((0, drizzle_orm_1.and)(...whereConditions));
        const total = totalResult[0]?.count || 0;
        const parsedLogs = logs.map(log => ({
            ...log,
            validationResult: log.validationResult ? JSON.parse(log.validationResult) : null
        }));
        return res.json(response_utils_1.ResponseUtils.createPaginatedResponse(parsedLogs, pageNum, limitNum, total));
    }
    catch (error) {
        console.error('Validation logs fetch error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to fetch validation logs', error));
    }
});
router.get('/top-domains', async (req, res) => {
    try {
        const user = req.user;
        const { limit = '10', period = '30' } = req.query;
        const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10));
        const days = Math.min(365, Math.max(1, parseInt(period) || 30));
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const topDomains = await connection_1.db.select({
            domain: (0, drizzle_orm_1.sql) `SUBSTR(${schema_1.validationLogs.emailValidated}, INSTR(${schema_1.validationLogs.emailValidated}, '@') + 1)`,
            validationCount: (0, drizzle_orm_1.count)()
        })
            .from(schema_1.validationLogs)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.validationLogs.userId, user.id), (0, drizzle_orm_1.sql) `${schema_1.validationLogs.createdAt} >= ${startDate.toISOString()}`))
            .groupBy((0, drizzle_orm_1.sql) `SUBSTR(${schema_1.validationLogs.emailValidated}, INSTR(${schema_1.validationLogs.emailValidated}, '@') + 1)`)
            .orderBy((0, drizzle_orm_1.desc)((0, drizzle_orm_1.count)()))
            .limit(limitNum);
        return res.json(response_utils_1.ResponseUtils.success({
            topDomains: topDomains.map(domain => ({
                domain: domain.domain,
                validationCount: domain.validationCount,
                percentage: '0.00'
            })),
            period: `${days} days`
        }));
    }
    catch (error) {
        console.error('Top domains fetch error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to fetch top domains', error));
    }
});
router.get('/validation-trends', async (req, res) => {
    try {
        const user = req.user;
        const { period = '30', groupBy = 'day' } = req.query;
        const days = Math.min(365, Math.max(1, parseInt(period) || 30));
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        let groupByClause;
        let dateFormat;
        switch (groupBy) {
            case 'hour':
                groupByClause = (0, drizzle_orm_1.sql) `strftime('%Y-%m-%d %H:00:00', ${schema_1.validationLogs.createdAt})`;
                dateFormat = '%Y-%m-%d %H:00:00';
                break;
            case 'week':
                groupByClause = (0, drizzle_orm_1.sql) `strftime('%Y-W%W', ${schema_1.validationLogs.createdAt})`;
                dateFormat = '%Y-W%W';
                break;
            case 'month':
                groupByClause = (0, drizzle_orm_1.sql) `strftime('%Y-%m', ${schema_1.validationLogs.createdAt})`;
                dateFormat = '%Y-%m';
                break;
            default:
                groupByClause = (0, drizzle_orm_1.sql) `strftime('%Y-%m-%d', ${schema_1.validationLogs.createdAt})`;
                dateFormat = '%Y-%m-%d';
                break;
        }
        const trends = await connection_1.db.select({
            period: groupByClause,
            totalValidations: (0, drizzle_orm_1.count)(),
            avgProcessingTime: (0, drizzle_orm_1.sql) `AVG(${schema_1.validationLogs.processingTimeMs})`
        })
            .from(schema_1.validationLogs)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.validationLogs.userId, user.id), (0, drizzle_orm_1.sql) `${schema_1.validationLogs.createdAt} >= ${startDate.toISOString()}`))
            .groupBy(groupByClause)
            .orderBy(groupByClause);
        return res.json(response_utils_1.ResponseUtils.success({
            trends: trends.map(trend => ({
                period: trend.period,
                validations: trend.totalValidations || 0,
                averageProcessingTime: Math.round(trend.avgProcessingTime || 0)
            })),
            groupBy,
            periodDays: days
        }));
    }
    catch (error) {
        console.error('Validation trends fetch error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to fetch validation trends', error));
    }
});
router.get('/system-stats', async (req, res) => {
    try {
        const emailValidator = new email_validation_service_1.EmailValidationService();
        const cacheStats = emailValidator.getCacheStatistics();
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
        return res.json(response_utils_1.ResponseUtils.success({
            systemStats
        }));
    }
    catch (error) {
        console.error('System stats fetch error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to fetch system stats', error));
    }
});
router.post('/cache/clear', async (req, res) => {
    try {
        const emailValidator = new email_validation_service_1.EmailValidationService();
        const beforeStats = emailValidator.getCacheStatistics();
        emailValidator.clearMxCache();
        const afterStats = emailValidator.getCacheStatistics();
        return res.json(response_utils_1.ResponseUtils.success({
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
    }
    catch (error) {
        console.error('Cache clear error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to clear cache', error));
    }
});
//# sourceMappingURL=analytics.routes.js.map