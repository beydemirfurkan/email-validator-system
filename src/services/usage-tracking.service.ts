import { eq, and, gte, lte } from 'drizzle-orm';
import { db } from '../database/connection';
import { usageQuotas, validationLogs, users, userSubscriptions, plans } from '../database/schema';

export class UsageTrackingService {
  // Check if user has available validations
  async checkValidationQuota(userId: number): Promise<{
    canValidate: boolean;
    validationsUsed: number;
    validationsLimit: number;
    message?: string;
  }> {
    try {
      // Get current usage quota for the user
      const currentQuota = await this.getCurrentUsageQuota(userId);
      
      if (!currentQuota) {
        return {
          canValidate: false,
          validationsUsed: 0,
          validationsLimit: 0,
          message: 'No active subscription found'
        };
      }

      const validationsUsed = currentQuota.validationsUsed || 0;
      const canValidate = validationsUsed < currentQuota.validationsLimit;
      
      return {
        canValidate,
        validationsUsed,
        validationsLimit: currentQuota.validationsLimit,
        message: canValidate ? undefined : 'Validation quota exceeded'
      };
    } catch (error) {
      console.error('Error checking validation quota:', error);
      return {
        canValidate: false,
        validationsUsed: 0,
        validationsLimit: 0,
        message: 'Error checking quota'
      };
    }
  }

  // Increment validation usage
  async incrementValidationUsage(userId: number, apiKeyId?: number): Promise<boolean> {
    try {
      const currentQuota = await this.getCurrentUsageQuota(userId);
      
      if (!currentQuota) {
        console.error('No usage quota found for user:', userId);
        return false;
      }

      const validationsUsed = currentQuota.validationsUsed || 0;
      
      // Check if user has remaining validations
      if (validationsUsed >= currentQuota.validationsLimit) {
        console.error('User has exceeded validation limit:', userId);
        return false;
      }

      // Increment usage count
      await db.update(usageQuotas)
        .set({ 
          validationsUsed: validationsUsed + 1,
          updatedAt: new Date()
        })
        .where(eq(usageQuotas.id, currentQuota.id));

      // Also increment API calls if tracking
      const apiCallsLimit = currentQuota.apiCallsLimit || -1;
      if (apiCallsLimit > -1) {
        await db.update(usageQuotas)
          .set({ 
            apiCallsUsed: (currentQuota.apiCallsUsed || 0) + 1,
            updatedAt: new Date()
          })
          .where(eq(usageQuotas.id, currentQuota.id));
      }

      return true;
    } catch (error) {
      console.error('Error incrementing validation usage:', error);
      return false;
    }
  }

  // Log validation request
  async logValidation(
    userId: number,
    email: string,
    validationResult: any,
    processingTimeMs: number,
    ipAddress?: string | null,
    userAgent?: string,
    apiKeyId?: number
  ): Promise<void> {
    try {
      await db.insert(validationLogs).values({
        userId,
        apiKeyId,
        emailValidated: email,
        validationResult,
        processingTimeMs,
        ipAddress,
        userAgent,
        createdAt: new Date()
      });
    } catch (error) {
      console.error('Error logging validation:', error);
    }
  }

  // Get current usage quota for a user
  private async getCurrentUsageQuota(userId: number) {
    const now = new Date();
    
    const quota = await db.select()
      .from(usageQuotas)
      .where(
        and(
          eq(usageQuotas.userId, userId),
          lte(usageQuotas.currentPeriodStart, now),
          gte(usageQuotas.currentPeriodEnd, now)
        )
      )
      .limit(1);

    return quota[0] || null;
  }

  // Ensure user has a usage quota (create if needed)
  async ensureUsageQuota(userId: number): Promise<void> {
    try {
      // Check if user already has a current usage quota
      const existingQuota = await this.getCurrentUsageQuota(userId);
      if (existingQuota) {
        return;
      }

      // Get user's current subscription
      const subscription = await db.select({
        planId: userSubscriptions.planId,
        plan: plans
      })
        .from(userSubscriptions)
        .leftJoin(plans, eq(userSubscriptions.planId, plans.id))
        .where(
          and(
            eq(userSubscriptions.userId, userId),
            eq(userSubscriptions.status, 'active')
          )
        )
        .limit(1);

      let planId: number;
      let validationsLimit: number;

      if (subscription[0]?.plan) {
        planId = subscription[0].plan.id;
        validationsLimit = subscription[0].plan.validationsPerMonth;
      } else {
        // Default free plan - get the free plan from DB or create default
        const freePlan = await db.select()
          .from(plans)
          .where(eq(plans.name, 'Free'))
          .limit(1);

        if (freePlan[0]) {
          planId = freePlan[0].id;
          validationsLimit = freePlan[0].validationsPerMonth;
        } else {
          // Fallback to default free limits
          planId = 1; // Assuming plan ID 1 is free plan
          validationsLimit = 1000;
        }
      }

      // Create new usage quota for current period
      const now = new Date();
      const currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1); // Start of current month
      const currentPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59); // End of current month

      await db.insert(usageQuotas).values({
        userId,
        planId,
        currentPeriodStart,
        currentPeriodEnd,
        validationsUsed: 0,
        validationsLimit,
        apiCallsUsed: 0,
        apiCallsLimit: -1, // Unlimited by default
        lastResetAt: now,
        createdAt: now,
        updatedAt: now
      });

    } catch (error) {
      console.error('Error ensuring usage quota:', error);
    }
  }

  // Get usage statistics for a user
  async getUserUsage(userId: number): Promise<{
    planName: string;
    validationsUsed: number;
    validationsLimit: number;
    utilizationPercentage: string;
    daysRemaining: number;
  } | null> {
    try {
      const quota = await db.select({
        usageQuota: usageQuotas,
        plan: plans
      })
        .from(usageQuotas)
        .leftJoin(plans, eq(usageQuotas.planId, plans.id))
        .where(
          and(
            eq(usageQuotas.userId, userId),
            lte(usageQuotas.currentPeriodStart, new Date()),
            gte(usageQuotas.currentPeriodEnd, new Date())
          )
        )
        .limit(1);

      if (!quota[0]) {
        return null;
      }

      const { usageQuota, plan } = quota[0];
      const validationsUsed = usageQuota.validationsUsed || 0;
      const utilizationPercentage = ((validationsUsed / usageQuota.validationsLimit) * 100).toFixed(1);
      
      const now = new Date();
      const daysRemaining = Math.ceil((usageQuota.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        planName: plan?.name || 'Free Plan',
        validationsUsed,
        validationsLimit: usageQuota.validationsLimit,
        utilizationPercentage,
        daysRemaining: Math.max(0, daysRemaining)
      };
    } catch (error) {
      console.error('Error getting user usage:', error);
      return null;
    }
  }
}