import { Router, Request, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../database/connection';
import { plans, planFeatures, userSubscriptions, usageQuotas, NewUserSubscription, NewUsageQuota } from '../database/schema';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { ResponseUtils } from '../utils/response.utils';

const router = Router();

// GET /api/plans - List all available plans (public)
router.get('/', async (req: Request, res: Response) => {
  try {
    const availablePlans = await db.select()
      .from(plans)
      .where(eq(plans.isActive, true))
      .orderBy(plans.price);

    // Get features for each plan
    const plansWithFeatures = await Promise.all(
      availablePlans.map(async (plan) => {
        const features = await db.select()
          .from(planFeatures)
          .where(and(
            eq(planFeatures.planId, plan.id),
            eq(planFeatures.isEnabled, true)
          ));

        return {
          ...plan,
          features: features.map(f => ({
            name: f.featureName,
            value: f.featureValue,
            enabled: f.isEnabled
          }))
        };
      })
    );

    return res.json(ResponseUtils.success({
      plans: plansWithFeatures
    }));
  } catch (error) {
    console.error('Plans fetch error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to fetch plans', error as Error)
    );
  }
});

// GET /api/plans/:id - Get specific plan details (public)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const planId = parseInt(id!);
    if (isNaN(planId)) {
      return res.status(400).json(
        ResponseUtils.validationError('Invalid plan ID')
      );
    }

    const planRecords = await db.select()
      .from(plans)
      .where(and(
        eq(plans.id, planId),
        eq(plans.isActive, true)
      ))
      .limit(1);

    const plan = planRecords[0];

    if (!plan) {
      return res.status(404).json(
        ResponseUtils.error('Plan not found', 404)
      );
    }

    // Get plan features
    const features = await db.select()
      .from(planFeatures)
      .where(and(
        eq(planFeatures.planId, plan.id),
        eq(planFeatures.isEnabled, true)
      ));

    return res.json(ResponseUtils.success({
      plan: {
        ...plan,
        features: features.map(f => ({
          name: f.featureName,
          value: f.featureValue,
          enabled: f.isEnabled
        }))
      }
    }));
  } catch (error) {
    console.error('Plan fetch error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to fetch plan', error as Error)
    );
  }
});

// All subscription routes require authentication
router.use(AuthMiddleware.authenticateToken);

// GET /api/plans/subscriptions - Get user's current subscription
router.get('/subscriptions', async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    // Get current active subscription
    const subscriptionRecords = await db.select({
      subscription: userSubscriptions,
      plan: plans
    })
    .from(userSubscriptions)
    .innerJoin(plans, eq(userSubscriptions.planId, plans.id))
    .where(and(
      eq(userSubscriptions.userId, user.id),
      eq(userSubscriptions.status, 'active')
    ))
    .orderBy(desc(userSubscriptions.createdAt))
    .limit(1);

    if (subscriptionRecords.length === 0) {
      return res.json(ResponseUtils.success({
        subscription: null,
        message: 'No active subscription found'
      }));
    }

    const { subscription, plan } = subscriptionRecords[0]!;

    // Get current usage quota
    const usageRecords = await db.select()
      .from(usageQuotas)
      .where(and(
        eq(usageQuotas.userId, user.id),
        eq(usageQuotas.planId, plan.id)
      ))
      .orderBy(desc(usageQuotas.createdAt))
      .limit(1);

    const usage = usageRecords[0];

    return res.json(ResponseUtils.success({
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
  } catch (error) {
    console.error('Subscription fetch error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to fetch subscription', error as Error)
    );
  }
});

// POST /api/plans/:id/subscribe - Subscribe to a plan
router.post('/:id/subscribe', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const planId = parseInt(id!);
    if (isNaN(planId)) {
      return res.status(400).json(
        ResponseUtils.validationError('Invalid plan ID')
      );
    }

    // Verify plan exists and is active
    const planRecords = await db.select()
      .from(plans)
      .where(and(
        eq(plans.id, planId),
        eq(plans.isActive, true)
      ))
      .limit(1);

    const plan = planRecords[0];

    if (!plan) {
      return res.status(404).json(
        ResponseUtils.error('Plan not found', 404)
      );
    }

    // Check for existing active subscription
    const existingSubscription = await db.select()
      .from(userSubscriptions)
      .where(and(
        eq(userSubscriptions.userId, user.id),
        eq(userSubscriptions.status, 'active')
      ))
      .limit(1);

    if (existingSubscription.length > 0) {
      return res.status(400).json(
        ResponseUtils.error('User already has an active subscription', 400)
      );
    }

    // Calculate period dates
    const now = new Date();
    const currentPeriodStart = now;
    let currentPeriodEnd: Date;

    if (plan.billingCycle === 'monthly') {
      currentPeriodEnd = new Date(now);
      currentPeriodEnd.setMonth(now.getMonth() + 1);
    } else {
      currentPeriodEnd = new Date(now);
      currentPeriodEnd.setFullYear(now.getFullYear() + 1);
    }

    // Create subscription (in real app, this would integrate with Stripe)
    const newSubscription: NewUserSubscription = {
      userId: user.id,
      planId: plan.id,
      status: 'active', // In real app, this would be 'pending' until payment confirms
      currentPeriodStart,
      currentPeriodEnd: currentPeriodEnd,
      cancelAtPeriodEnd: false,
      // In real implementation, add Stripe IDs
      stripeSubscriptionId: null,
      stripeCustomerId: null
    };

    const createdSubscriptions = await db.insert(userSubscriptions)
      .values(newSubscription)
      .returning();

    const subscription = createdSubscriptions[0];

    if (!subscription) {
      throw new Error('Failed to create subscription');
    }

    // Create usage quota for this period
    const newUsageQuota: NewUsageQuota = {
      userId: user.id,
      planId: plan.id,
      currentPeriodStart,
      currentPeriodEnd: currentPeriodEnd,
      validationsUsed: 0,
      validationsLimit: plan.validationsPerMonth,
      apiCallsUsed: 0,
      apiCallsLimit: plan.apiAccess ? -1 : 0, // -1 means unlimited
      lastResetAt: now
    };

    await db.insert(usageQuotas).values(newUsageQuota);

    return res.status(201).json(ResponseUtils.success({
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
  } catch (error) {
    console.error('Subscription creation error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to create subscription', error as Error)
    );
  }
});

// PUT /api/plans/subscriptions/:id - Update subscription (e.g., cancel)
router.put('/subscriptions/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { cancelAtPeriodEnd, status } = req.body;

    const subscriptionId = parseInt(id!);
    if (isNaN(subscriptionId)) {
      return res.status(400).json(
        ResponseUtils.validationError('Invalid subscription ID')
      );
    }

    // Verify subscription ownership
    const subscriptionRecords = await db.select()
      .from(userSubscriptions)
      .where(and(
        eq(userSubscriptions.id, subscriptionId),
        eq(userSubscriptions.userId, user.id)
      ))
      .limit(1);

    if (subscriptionRecords.length === 0) {
      return res.status(404).json(
        ResponseUtils.error('Subscription not found', 404)
      );
    }

    // Build update object
    const updates: Partial<NewUserSubscription> = {
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
        updates.status = status as any;
      } else {
        return res.status(400).json(
          ResponseUtils.validationError('Invalid status. Must be one of: ' + validStatuses.join(', '))
        );
      }
    }

    // Update subscription
    const updatedSubscriptions = await db.update(userSubscriptions)
      .set(updates)
      .where(eq(userSubscriptions.id, subscriptionId))
      .returning();

    const updatedSubscription = updatedSubscriptions[0];

    if (!updatedSubscription) {
      throw new Error('Failed to update subscription');
    }

    return res.json(ResponseUtils.success({
      message: 'Subscription updated successfully',
      subscription: updatedSubscription
    }));
  } catch (error) {
    console.error('Subscription update error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to update subscription', error as Error)
    );
  }
});

// GET /api/plans/usage - Get current usage statistics
router.get('/usage', async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    // Get current active subscription with usage
    const subscriptionData = await db.select({
      subscription: userSubscriptions,
      plan: plans,
      usage: usageQuotas
    })
    .from(userSubscriptions)
    .innerJoin(plans, eq(userSubscriptions.planId, plans.id))
    .leftJoin(usageQuotas, and(
      eq(usageQuotas.userId, user.id),
      eq(usageQuotas.planId, plans.id)
    ))
    .where(and(
      eq(userSubscriptions.userId, user.id),
      eq(userSubscriptions.status, 'active')
    ))
    .orderBy(desc(userSubscriptions.createdAt))
    .limit(1);

    if (subscriptionData.length === 0) {
      return res.json(ResponseUtils.success({
        usage: null,
        message: 'No active subscription found'
      }));
    }

    const { subscription, plan, usage } = subscriptionData[0]!;

    if (!usage) {
      return res.json(ResponseUtils.success({
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

    const daysRemaining = Math.max(0, Math.ceil(
      (new Date(usage.currentPeriodEnd || '').getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    ));

    return res.json(ResponseUtils.success({
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
  } catch (error) {
    console.error('Usage fetch error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to fetch usage', error as Error)
    );
  }
});

export { router as plansRoutes };