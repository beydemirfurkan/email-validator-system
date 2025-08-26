import 'dotenv/config';
import { db } from '../database/connection';
import { plans, planFeatures, NewPlan, NewPlanFeature } from '../database/schema';

async function seedPlans() {
  try {
    console.log('🌱 Seeding plans...');

    const defaultPlans: NewPlan[] = [
      {
        name: 'Free',
        description: 'Perfect for testing and small projects',
        price: 0,
        billingCycle: 'monthly',
        validationsPerMonth: 100,
        maxApiKeys: 1,
        maxContactLists: 1,
        bulkValidation: false,
        apiAccess: true,
        prioritySupport: false,
        isActive: true
      },
      {
        name: 'Starter',
        description: 'Great for small businesses',
        price: 19.99,
        billingCycle: 'monthly',
        validationsPerMonth: 5000,
        maxApiKeys: 3,
        maxContactLists: 5,
        bulkValidation: true,
        apiAccess: true,
        prioritySupport: false,
        isActive: true
      },
      {
        name: 'Professional',
        description: 'Perfect for growing businesses',
        price: 49.99,
        billingCycle: 'monthly',
        validationsPerMonth: 25000,
        maxApiKeys: 10,
        maxContactLists: 20,
        bulkValidation: true,
        apiAccess: true,
        prioritySupport: true,
        isActive: true
      },
      {
        name: 'Enterprise',
        description: 'For large scale operations',
        price: 199.99,
        billingCycle: 'monthly',
        validationsPerMonth: 100000,
        maxApiKeys: -1,
        maxContactLists: -1,
        bulkValidation: true,
        apiAccess: true,
        prioritySupport: true,
        isActive: true
      }
    ];

    // Clear existing plans first
    await db.delete(planFeatures);
    await db.delete(plans);

    // Insert plans
    const insertedPlans = await db.insert(plans).values(defaultPlans).returning();
    console.log(`✅ Inserted ${insertedPlans.length} plans`);

    // Insert plan features
    const planFeaturesData: NewPlanFeature[] = [
      // Free plan features
      { planId: insertedPlans[0]!.id, featureName: 'Email Validation', featureValue: '100/month', isEnabled: true },
      { planId: insertedPlans[0]!.id, featureName: 'API Access', featureValue: 'Basic', isEnabled: true },
      { planId: insertedPlans[0]!.id, featureName: 'Rate Limiting', featureValue: '100 req/hour', isEnabled: true },

      // Starter plan features
      { planId: insertedPlans[1]!.id, featureName: 'Email Validation', featureValue: '5,000/month', isEnabled: true },
      { planId: insertedPlans[1]!.id, featureName: 'API Access', featureValue: 'Full', isEnabled: true },
      { planId: insertedPlans[1]!.id, featureName: 'Bulk Validation', featureValue: 'Up to 1,000 emails', isEnabled: true },
      { planId: insertedPlans[1]!.id, featureName: 'Rate Limiting', featureValue: '1,000 req/hour', isEnabled: true },

      // Professional plan features
      { planId: insertedPlans[2]!.id, featureName: 'Email Validation', featureValue: '25,000/month', isEnabled: true },
      { planId: insertedPlans[2]!.id, featureName: 'API Access', featureValue: 'Full', isEnabled: true },
      { planId: insertedPlans[2]!.id, featureName: 'Bulk Validation', featureValue: 'Up to 10,000 emails', isEnabled: true },
      { planId: insertedPlans[2]!.id, featureName: 'Priority Support', featureValue: '24/7 support', isEnabled: true },
      { planId: insertedPlans[2]!.id, featureName: 'Rate Limiting', featureValue: '5,000 req/hour', isEnabled: true },

      // Enterprise plan features
      { planId: insertedPlans[3]!.id, featureName: 'Email Validation', featureValue: '100,000/month', isEnabled: true },
      { planId: insertedPlans[3]!.id, featureName: 'API Access', featureValue: 'Full', isEnabled: true },
      { planId: insertedPlans[3]!.id, featureName: 'Bulk Validation', featureValue: 'Unlimited', isEnabled: true },
      { planId: insertedPlans[3]!.id, featureName: 'Priority Support', featureValue: 'Dedicated support', isEnabled: true },
      { planId: insertedPlans[3]!.id, featureName: 'Rate Limiting', featureValue: 'Custom', isEnabled: true },
      { planId: insertedPlans[3]!.id, featureName: 'Custom Integration', featureValue: 'Available', isEnabled: true }
    ];

    const insertedFeatures = await db.insert(planFeatures).values(planFeaturesData).returning();
    console.log(`✅ Inserted ${insertedFeatures.length} plan features`);

    console.log('🎉 Plans seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding plans:', error);
    process.exit(1);
  }
}

seedPlans();