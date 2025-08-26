"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.plansRoutes = void 0;
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const connection_1 = require("../database/connection");
const schema_1 = require("../database/schema");
const auth_middleware_1 = require("../middleware/auth.middleware");
const response_utils_1 = require("../utils/response.utils");
const router = (0, express_1.Router)();
exports.plansRoutes = router;
router.get('/', async (req, res) => {
    try {
        const availablePlans = await connection_1.db.select()
            .from(schema_1.plans)
            .where((0, drizzle_orm_1.eq)(schema_1.plans.isActive, true))
            .orderBy(schema_1.plans.price);
        const plansWithFeatures = await Promise.all(availablePlans.map(async (plan) => {
            const features = await connection_1.db.select()
                .from(schema_1.planFeatures)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.planFeatures.planId, plan.id), (0, drizzle_orm_1.eq)(schema_1.planFeatures.isEnabled, true)));
            return {
                ...plan,
                features: features.map(f => ({
                    name: f.featureName,
                    value: f.featureValue,
                    enabled: f.isEnabled
                }))
            };
        }));
        return res.json(response_utils_1.ResponseUtils.success({
            plans: plansWithFeatures
        }));
    }
    catch (error) {
        console.error('Plans fetch error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to fetch plans', error));
    }
});
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const planId = parseInt(id);
        if (isNaN(planId)) {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError('Invalid plan ID'));
        }
        const planRecords = await connection_1.db.select()
            .from(schema_1.plans)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.plans.id, planId), (0, drizzle_orm_1.eq)(schema_1.plans.isActive, true)))
            .limit(1);
        const plan = planRecords[0];
        if (!plan) {
            return res.status(404).json(response_utils_1.ResponseUtils.error('Plan not found', 404));
        }
        const features = await connection_1.db.select()
            .from(schema_1.planFeatures)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.planFeatures.planId, plan.id), (0, drizzle_orm_1.eq)(schema_1.planFeatures.isEnabled, true)));
        return res.json(response_utils_1.ResponseUtils.success({
            plan: {
                ...plan,
                features: features.map(f => ({
                    name: f.featureName,
                    value: f.featureValue,
                    enabled: f.isEnabled
                }))
            }
        }));
    }
    catch (error) {
        console.error('Plan fetch error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to fetch plan', error));
    }
});
router.use(auth_middleware_1.AuthMiddleware.authenticateToken);
router.get('/subscriptions', async (req, res) => {
    try {
        const user = req.user;
        const subscriptionRecords = await connection_1.db.select({
            subscription: schema_1.userSubscriptions,
            plan: schema_1.plans
        })
            .from(schema_1.userSubscriptions)
            .innerJoin(schema_1.plans, (0, drizzle_orm_1.eq)(schema_1.userSubscriptions.planId, schema_1.plans.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.userSubscriptions.userId, user.id), (0, drizzle_orm_1.eq)(schema_1.userSubscriptions.status, 'active')))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.userSubscriptions.createdAt))
            .limit(1);
        if (subscriptionRecords.length === 0) {
            return res.json(response_utils_1.ResponseUtils.success({
                subscription: null,
                message: 'No active subscription found'
            }));
        }
        const { subscription, plan } = subscriptionRecords[0];
        const usageRecords = await connection_1.db.select()
            .from(schema_1.usageQuotas)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.usageQuotas.userId, user.id), (0, drizzle_orm_1.eq)(schema_1.usageQuotas.planId, plan.id)))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.usageQuotas.createdAt))
            .limit(1);
        const usage = usageRecords[0];
        return res.json(response_utils_1.ResponseUtils.success({
            subscription: {
                ...subscription,
                plan: {
                    id: plan.id,
                    name: plan.name,
                    description: plan.description,
                    price: plan.price,
                    billingCycle: plan.billingCycle,
                    validationsPerMonth: plan.validationsPerMonth
                },
                usage: usage ? {
                    validationsUsed: usage.validationsUsed,
                    validationsLimit: usage.validationsLimit,
                    apiCallsUsed: usage.apiCallsUsed,
                    apiCallsLimit: usage.apiCallsLimit,
                    currentPeriodStart: usage.currentPeriodStart,
                    currentPeriodEnd: usage.currentPeriodEnd,
                    utilizationPercentage: (usage.validationsLimit && usage.validationsLimit > 0)
                        ? (((usage.validationsUsed || 0) / usage.validationsLimit) * 100).toFixed(2)
                        : '0.00'
                } : null
            }
        }));
    }
    catch (error) {
        console.error('Subscription fetch error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to fetch subscription', error));
    }
});
router.post('/:id/subscribe', async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const planId = parseInt(id);
        if (isNaN(planId)) {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError('Invalid plan ID'));
        }
        const planRecords = await connection_1.db.select()
            .from(schema_1.plans)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.plans.id, planId), (0, drizzle_orm_1.eq)(schema_1.plans.isActive, true)))
            .limit(1);
        const plan = planRecords[0];
        if (!plan) {
            return res.status(404).json(response_utils_1.ResponseUtils.error('Plan not found', 404));
        }
        const existingSubscription = await connection_1.db.select()
            .from(schema_1.userSubscriptions)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.userSubscriptions.userId, user.id), (0, drizzle_orm_1.eq)(schema_1.userSubscriptions.status, 'active')))
            .limit(1);
        if (existingSubscription.length > 0) {
            return res.status(400).json(response_utils_1.ResponseUtils.error('User already has an active subscription', 400));
        }
        const now = new Date();
        const currentPeriodStart = now;
        let currentPeriodEnd;
        if (plan.billingCycle === 'monthly') {
            currentPeriodEnd = new Date(now);
            currentPeriodEnd.setMonth(now.getMonth() + 1);
        }
        else {
            currentPeriodEnd = new Date(now);
            currentPeriodEnd.setFullYear(now.getFullYear() + 1);
        }
        const newSubscription = {
            userId: user.id,
            planId: plan.id,
            status: 'active',
            currentPeriodStart,
            currentPeriodEnd: currentPeriodEnd,
            cancelAtPeriodEnd: false,
            stripeSubscriptionId: null,
            stripeCustomerId: null
        };
        const createdSubscriptions = await connection_1.db.insert(schema_1.userSubscriptions)
            .values(newSubscription)
            .returning();
        const subscription = createdSubscriptions[0];
        if (!subscription) {
            throw new Error('Failed to create subscription');
        }
        const newUsageQuota = {
            userId: user.id,
            planId: plan.id,
            currentPeriodStart,
            currentPeriodEnd: currentPeriodEnd,
            validationsUsed: 0,
            validationsLimit: plan.validationsPerMonth,
            apiCallsUsed: 0,
            apiCallsLimit: plan.apiAccess ? -1 : 0,
            lastResetAt: now
        };
        await connection_1.db.insert(schema_1.usageQuotas).values(newUsageQuota);
        return res.status(201).json(response_utils_1.ResponseUtils.success({
            message: 'Successfully subscribed to plan',
            subscription: {
                ...subscription,
                plan: {
                    id: plan.id,
                    name: plan.name,
                    price: plan.price,
                    billingCycle: plan.billingCycle,
                    validationsPerMonth: plan.validationsPerMonth
                }
            },
            note: 'This is a demo subscription. In production, payment processing would be handled via Stripe.'
        }));
    }
    catch (error) {
        console.error('Subscription creation error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to create subscription', error));
    }
});
router.put('/subscriptions/:id', async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const { cancelAtPeriodEnd, status } = req.body;
        const subscriptionId = parseInt(id);
        if (isNaN(subscriptionId)) {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError('Invalid subscription ID'));
        }
        const subscriptionRecords = await connection_1.db.select()
            .from(schema_1.userSubscriptions)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.userSubscriptions.id, subscriptionId), (0, drizzle_orm_1.eq)(schema_1.userSubscriptions.userId, user.id)))
            .limit(1);
        if (subscriptionRecords.length === 0) {
            return res.status(404).json(response_utils_1.ResponseUtils.error('Subscription not found', 404));
        }
        const updates = {
            updatedAt: new Date()
        };
        if (cancelAtPeriodEnd !== undefined) {
            if (typeof cancelAtPeriodEnd === 'boolean') {
                updates.cancelAtPeriodEnd = cancelAtPeriodEnd;
            }
        }
        if (status !== undefined) {
            const validStatuses = ['active', 'cancelled', 'expired', 'pending'];
            if (validStatuses.includes(status)) {
                updates.status = status;
            }
            else {
                return res.status(400).json(response_utils_1.ResponseUtils.validationError('Invalid status. Must be one of: ' + validStatuses.join(', ')));
            }
        }
        const updatedSubscriptions = await connection_1.db.update(schema_1.userSubscriptions)
            .set(updates)
            .where((0, drizzle_orm_1.eq)(schema_1.userSubscriptions.id, subscriptionId))
            .returning();
        const updatedSubscription = updatedSubscriptions[0];
        if (!updatedSubscription) {
            throw new Error('Failed to update subscription');
        }
        return res.json(response_utils_1.ResponseUtils.success({
            message: 'Subscription updated successfully',
            subscription: updatedSubscription
        }));
    }
    catch (error) {
        console.error('Subscription update error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to update subscription', error));
    }
});
router.get('/usage', async (req, res) => {
    try {
        const user = req.user;
        const subscriptionData = await connection_1.db.select({
            subscription: schema_1.userSubscriptions,
            plan: schema_1.plans,
            usage: schema_1.usageQuotas
        })
            .from(schema_1.userSubscriptions)
            .innerJoin(schema_1.plans, (0, drizzle_orm_1.eq)(schema_1.userSubscriptions.planId, schema_1.plans.id))
            .leftJoin(schema_1.usageQuotas, (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.usageQuotas.userId, user.id), (0, drizzle_orm_1.eq)(schema_1.usageQuotas.planId, schema_1.plans.id)))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.userSubscriptions.userId, user.id), (0, drizzle_orm_1.eq)(schema_1.userSubscriptions.status, 'active')))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.userSubscriptions.createdAt))
            .limit(1);
        if (subscriptionData.length === 0) {
            return res.json(response_utils_1.ResponseUtils.success({
                usage: null,
                message: 'No active subscription found'
            }));
        }
        const { subscription, plan, usage } = subscriptionData[0];
        if (!usage) {
            return res.json(response_utils_1.ResponseUtils.success({
                usage: {
                    planName: plan.name,
                    validationsUsed: 0,
                    validationsLimit: plan.validationsPerMonth,
                    apiCallsUsed: 0,
                    apiCallsLimit: plan.apiAccess ? -1 : 0,
                    utilizationPercentage: '0.00',
                    daysRemaining: Math.ceil((new Date(subscription.currentPeriodEnd || '').getTime() - Date.now()) / (24 * 60 * 60 * 1000))
                }
            }));
        }
        const utilizationPercentage = (usage.validationsLimit && usage.validationsLimit > 0)
            ? (((usage.validationsUsed || 0) / usage.validationsLimit) * 100).toFixed(2)
            : '0.00';
        const daysRemaining = Math.max(0, Math.ceil((new Date(usage.currentPeriodEnd || '').getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
        return res.json(response_utils_1.ResponseUtils.success({
            usage: {
                planName: plan.name,
                validationsUsed: usage.validationsUsed || 0,
                validationsLimit: usage.validationsLimit,
                apiCallsUsed: usage.apiCallsUsed,
                apiCallsLimit: usage.apiCallsLimit,
                utilizationPercentage,
                daysRemaining,
                currentPeriodStart: usage.currentPeriodStart,
                currentPeriodEnd: usage.currentPeriodEnd,
                lastResetAt: usage.lastResetAt
            }
        }));
    }
    catch (error) {
        console.error('Usage fetch error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to fetch usage', error));
    }
});
//# sourceMappingURL=plans.routes.js.map