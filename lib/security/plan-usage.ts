import { createEmptyUsageSnapshot, getPlanDefinition, type PlanUsageSnapshot, type SubscriptionPlan } from "@/lib/billing/plans";
import { ApiError } from "@/lib/security/api-error";

export interface UsageRecord {
  totalUsed: number;
  dayKey: string;
  dayUsed: number;
}

function getDayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function createEmptyUsageRecord(): UsageRecord {
  return {
    totalUsed: 0,
    dayKey: getDayKey(),
    dayUsed: 0
  };
}

export function normalizeUsageRecord(record?: Partial<UsageRecord> | null): UsageRecord {
  const today = getDayKey();
  const next: UsageRecord = {
    totalUsed: Number.isFinite(record?.totalUsed) ? Math.max(0, Number(record?.totalUsed)) : 0,
    dayKey: typeof record?.dayKey === "string" && record.dayKey ? record.dayKey : today,
    dayUsed: Number.isFinite(record?.dayUsed) ? Math.max(0, Number(record?.dayUsed)) : 0
  };

  if (next.dayKey !== today) {
    next.dayKey = today;
    next.dayUsed = 0;
  }

  return next;
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

export function getPlanUsageSnapshot(plan: SubscriptionPlan, record?: Partial<UsageRecord> | null): PlanUsageSnapshot {
  if (!record) {
    return createEmptyUsageSnapshot(plan);
  }
  return buildSnapshot(plan, normalizeUsageRecord(record));
}

export function assertPlanAllowsChat(plan: SubscriptionPlan, record?: Partial<UsageRecord> | null) {
  const snapshot = getPlanUsageSnapshot(plan, record);

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

export function assertPlanAllowsAttachments(plan: SubscriptionPlan, record: Partial<UsageRecord> | null | undefined, attachmentCount: number) {
  if (!attachmentCount) {
    return getPlanUsageSnapshot(plan, record);
  }

  const snapshot = getPlanUsageSnapshot(plan, record);
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

export function recordPlanUsage(plan: SubscriptionPlan, record?: Partial<UsageRecord> | null) {
  const nextRecord = normalizeUsageRecord(record);
  nextRecord.totalUsed += 1;
  nextRecord.dayUsed += 1;
  return {
    usage: buildSnapshot(plan, nextRecord),
    record: nextRecord
  };
}
