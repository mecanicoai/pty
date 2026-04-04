import { createEmptyUsageSnapshot, getPlanDefinition, type PlanUsageSnapshot, type SubscriptionPlan } from "@/lib/billing/plans";
import { ApiError } from "@/lib/security/api-error";

interface UsageRecord {
  totalUsed: number;
  dayKey: string;
  dayUsed: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __mecanicoPlanUsageStore: Map<string, UsageRecord> | undefined;
}

function getStore() {
  if (!globalThis.__mecanicoPlanUsageStore) {
    globalThis.__mecanicoPlanUsageStore = new Map<string, UsageRecord>();
  }
  return globalThis.__mecanicoPlanUsageStore;
}

function getDayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getRecord(installId: string): UsageRecord {
  const store = getStore();
  const today = getDayKey();
  const existing = store.get(installId);

  if (!existing) {
    const next: UsageRecord = {
      totalUsed: 0,
      dayKey: today,
      dayUsed: 0
    };
    store.set(installId, next);
    return next;
  }

  if (existing.dayKey !== today) {
    existing.dayKey = today;
    existing.dayUsed = 0;
  }

  return existing;
}

function buildSnapshot(plan: SubscriptionPlan, record: UsageRecord): PlanUsageSnapshot {
  const definition = getPlanDefinition(plan);
  return {
    plan,
    totalUsed: record.totalUsed,
    totalLimit: definition.totalLimit,
    totalRemaining: definition.totalLimit === null ? null : Math.max(definition.totalLimit - record.totalUsed, 0),
    dayUsed: record.dayUsed,
    dayLimit: definition.dayLimit,
    dayRemaining: definition.dayLimit === null ? null : Math.max(definition.dayLimit - record.dayUsed, 0),
    features: definition.features
  };
}

export function getPlanUsageSnapshot(plan: SubscriptionPlan, installId: string): PlanUsageSnapshot {
  if (!installId) {
    return createEmptyUsageSnapshot(plan);
  }
  return buildSnapshot(plan, getRecord(installId));
}

export function assertPlanAllowsChat(plan: SubscriptionPlan, installId: string) {
  const snapshot = getPlanUsageSnapshot(plan, installId);

  if (snapshot.totalLimit !== null && snapshot.totalRemaining !== null && snapshot.totalRemaining <= 0) {
    throw new ApiError({
      status: 402,
      code: "plan_limit_reached",
      message: "Ya usaste las 5 preguntas gratis. Sube a Basico o Pro para seguir.",
      details: { usage: snapshot, upgradeTarget: "basic" }
    });
  }

  if (snapshot.dayLimit !== null && snapshot.dayRemaining !== null && snapshot.dayRemaining <= 0) {
    throw new ApiError({
      status: 402,
      code: "plan_limit_reached",
      message: "Ya usaste tus 10 preguntas de hoy. Sube a Pro o espera al proximo dia.",
      details: { usage: snapshot, upgradeTarget: "pro" }
    });
  }

  return snapshot;
}

export function assertPlanAllowsAttachments(plan: SubscriptionPlan, installId: string, attachmentCount: number) {
  if (!attachmentCount) {
    return getPlanUsageSnapshot(plan, installId);
  }

  const snapshot = getPlanUsageSnapshot(plan, installId);
  if (!snapshot.features.attachments) {
    throw new ApiError({
      status: 402,
      code: "plan_feature_locked",
      message: "Las fotos y archivos solo estan disponibles en Pro.",
      details: { usage: snapshot, requiredPlan: "pro", feature: "attachments" }
    });
  }

  return snapshot;
}

export function recordPlanUsage(plan: SubscriptionPlan, installId: string): PlanUsageSnapshot {
  const record = getRecord(installId);
  record.totalUsed += 1;
  record.dayUsed += 1;
  return buildSnapshot(plan, record);
}
