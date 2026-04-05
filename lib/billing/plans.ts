export type SubscriptionPlan = "free" | "basic" | "pro";

export interface PlanFeatures {
  voice: boolean;
  attachments: boolean;
  unlimited: boolean;
}

export interface PlanUsageSnapshot {
  plan: SubscriptionPlan;
  totalUsed: number;
  totalLimit: number | null;
  totalRemaining: number | null;
  dayUsed: number;
  dayLimit: number | null;
  dayRemaining: number | null;
  features: PlanFeatures;
}

export interface PlanDefinition {
  id: SubscriptionPlan;
  name: string;
  priceLabel: string;
  features: PlanFeatures;
  totalLimit: number | null;
  dayLimit: number | null;
}

export const PLAN_DEFINITIONS: Record<SubscriptionPlan, PlanDefinition> = {
  free: {
    id: "free",
    name: "DIY Gratis",
    priceLabel: "$0",
    features: {
      voice: false,
      attachments: false,
      unlimited: false
    },
    totalLimit: 5,
    dayLimit: null
  },
  basic: {
    id: "basic",
    name: "DIY Plus",
    priceLabel: "$5/mes",
    features: {
      voice: false,
      attachments: false,
      unlimited: false
    },
    totalLimit: null,
    dayLimit: 10
  },
  pro: {
    id: "pro",
    name: "Para los Pros",
    priceLabel: "$25/mes",
    features: {
      voice: true,
      attachments: true,
      unlimited: true
    },
    totalLimit: null,
    dayLimit: null
  }
};

export function getPlanDefinition(plan: SubscriptionPlan) {
  return PLAN_DEFINITIONS[plan];
}

export function getDefaultPlan(): SubscriptionPlan {
  return "free";
}

export function resolvePlanFromProductId(productId?: string | null): SubscriptionPlan {
  const normalized = (productId || "").trim().toLowerCase();
  const basicProductId = process.env.GOOGLE_PLAY_BASIC_PRODUCT_ID?.trim().toLowerCase();
  const proProductId = process.env.GOOGLE_PLAY_PRO_PRODUCT_ID?.trim().toLowerCase();

  if (proProductId && normalized === proProductId) {
    return "pro";
  }

  if (basicProductId && normalized === basicProductId) {
    return "basic";
  }

  if (normalized.includes("pro")) {
    return "pro";
  }

  if (normalized.includes("basic") || normalized.includes("lite") || normalized.includes("plus")) {
    return "basic";
  }

  return getDefaultPlan();
}

export function createEmptyUsageSnapshot(plan: SubscriptionPlan): PlanUsageSnapshot {
  const definition = getPlanDefinition(plan);
  return {
    plan,
    totalUsed: 0,
    totalLimit: definition.totalLimit,
    totalRemaining: definition.totalLimit,
    dayUsed: 0,
    dayLimit: definition.dayLimit,
    dayRemaining: definition.dayLimit,
    features: definition.features
  };
}
