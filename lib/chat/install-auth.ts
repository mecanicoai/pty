import { createEmptyUsageSnapshot, getDefaultPlan, type PlanUsageSnapshot, type SubscriptionPlan } from "@/lib/billing/plans";
import type { InstallBootstrapResponse, PlanActivationResponse } from "@/types/api";

const STORAGE_KEYS = {
  installId: "mecanico-install-id",
  installToken: "mecanico-install-token",
  installTokenExpiry: "mecanico-install-token-expiry",
  installBootstrap: "mecanico-install-bootstrap",
  installPlan: "mecanico-install-plan",
  installUsage: "mecanico-install-usage"
} as const;

declare global {
  interface Window {
    MecanicoWebApp?: {
      getInstallId?: () => string;
      getPendingIntegrityBootstrap?: () => InstallBootstrapResponse["integrity"] | null;
      setInstallToken?: (token: string, expiresAt?: string) => boolean;
      clearInstallToken?: () => void;
      receiveVoiceTranscript?: (payload: string | { text?: string }) => void;
      setVoiceRecording?: (recording: boolean) => void;
      receiveAttachments?: (payload: string | unknown[] | { attachments?: unknown[] }) => void;
      receiveBridgeError?: (payload: string | { message?: string }) => void;
      receiveSharedIntent?: (payload: string | Record<string, unknown>) => void;
    };
  }
}

function createInstallId() {
  return `install-${crypto.randomUUID()}`;
}

export function getOrCreateInstallId() {
  const existing = window.localStorage.getItem(STORAGE_KEYS.installId);
  if (existing) {
    return existing;
  }

  const next = createInstallId();
  window.localStorage.setItem(STORAGE_KEYS.installId, next);
  return next;
}

export function isTestPlanOverrideEnabled() {
  return process.env.NEXT_PUBLIC_ALLOW_TEST_PLAN_OVERRIDE === "true";
}

function decodeTokenPayload(token: string): { plan?: SubscriptionPlan } | null {
  const [encodedPayload] = token.split(".");
  if (!encodedPayload) {
    return null;
  }

  try {
    const base64 = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const decoded = atob(padded);
    return JSON.parse(decoded) as { plan?: SubscriptionPlan };
  } catch {
    return null;
  }
}

export function clearStoredInstallSession() {
  window.localStorage.removeItem(STORAGE_KEYS.installToken);
  window.localStorage.removeItem(STORAGE_KEYS.installTokenExpiry);
}

export function getStoredPlan() {
  const raw = window.localStorage.getItem(STORAGE_KEYS.installPlan);
  return raw === "basic" || raw === "pro" || raw === "free" ? raw : getDefaultPlan();
}

export function getStoredUsage() {
  const raw = window.localStorage.getItem(STORAGE_KEYS.installUsage);
  if (!raw) {
    return createEmptyUsageSnapshot(getStoredPlan());
  }

  try {
    const parsed = JSON.parse(raw) as PlanUsageSnapshot;
    if (!parsed || (parsed.plan !== "free" && parsed.plan !== "basic" && parsed.plan !== "pro")) {
      return createEmptyUsageSnapshot(getStoredPlan());
    }
    return parsed;
  } catch {
    return createEmptyUsageSnapshot(getStoredPlan());
  }
}

export function storeUsageSnapshot(usage?: PlanUsageSnapshot | null) {
  if (!usage) {
    window.localStorage.removeItem(STORAGE_KEYS.installUsage);
    return;
  }

  window.localStorage.setItem(STORAGE_KEYS.installUsage, JSON.stringify(usage));
  window.dispatchEvent(new CustomEvent("mecanico-install-usage-updated", { detail: usage }));
}

function saveInstallBootstrap(bootstrap: InstallBootstrapResponse["integrity"] | null) {
  if (!bootstrap) {
    window.localStorage.removeItem(STORAGE_KEYS.installBootstrap);
    return;
  }
  window.localStorage.setItem(STORAGE_KEYS.installBootstrap, JSON.stringify(bootstrap));
}

export function getPendingIntegrityBootstrap() {
  const raw = window.localStorage.getItem(STORAGE_KEYS.installBootstrap);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as InstallBootstrapResponse["integrity"];
    if (!parsed?.challengeToken || !parsed.requestHash || !parsed.expiresAt) {
      return null;
    }
    if (Date.parse(parsed.expiresAt) <= Date.now() + 10_000) {
      saveInstallBootstrap(null);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function storeInstallToken(token: string, expiresAt?: string) {
  if (!token) {
    return false;
  }

  const nextExpiry = expiresAt && Number.isFinite(Date.parse(expiresAt))
    ? expiresAt
    : new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

  window.localStorage.setItem(STORAGE_KEYS.installToken, token);
  window.localStorage.setItem(STORAGE_KEYS.installTokenExpiry, nextExpiry);
  const payload = decodeTokenPayload(token);
  const plan = payload?.plan ?? getDefaultPlan();
  const previousPlan = window.localStorage.getItem(STORAGE_KEYS.installPlan);
  window.localStorage.setItem(STORAGE_KEYS.installPlan, plan);
  if (previousPlan !== plan || !window.localStorage.getItem(STORAGE_KEYS.installUsage)) {
    storeUsageSnapshot(createEmptyUsageSnapshot(plan));
  }
  saveInstallBootstrap(null);
  window.dispatchEvent(new CustomEvent("mecanico-install-token-ready", { detail: { expiresAt: nextExpiry, plan } }));
  return true;
}

export async function activateTestPlan(plan: SubscriptionPlan) {
  const installId = getOrCreateInstallId();
  const response = await fetch("/api/testing/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      installId,
      plan
    })
  });

  const data = (await response.json().catch(() => ({}))) as PlanActivationResponse & Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "No se pudo activar el plan de prueba.");
  }

  storeInstallToken(data.token, data.expiresAt);
  storeUsageSnapshot(data.usage);
  return data;
}

export function registerNativeInstallBridge() {
  window.MecanicoWebApp = {
    ...(window.MecanicoWebApp ?? {}),
    getInstallId: () => getOrCreateInstallId(),
    getPendingIntegrityBootstrap: () => getPendingIntegrityBootstrap(),
    setInstallToken: (token: string, expiresAt?: string) => storeInstallToken(token, expiresAt),
    clearInstallToken: () => clearStoredInstallSession()
  };
}

function getStoredToken() {
  const token = window.localStorage.getItem(STORAGE_KEYS.installToken);
  const expiry = window.localStorage.getItem(STORAGE_KEYS.installTokenExpiry);
  if (!token || !expiry) {
    return null;
  }

  const expiryMs = Date.parse(expiry);
  if (!Number.isFinite(expiryMs) || expiryMs <= Date.now() + 60_000) {
    clearStoredInstallSession();
    return null;
  }

  return token;
}

export async function ensureInstallToken() {
  const stored = getStoredToken();
  if (stored) {
    return stored;
  }

  const installId = getOrCreateInstallId();
  registerNativeInstallBridge();
  const response = await fetch("/api/install", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      installId,
      platform: "web"
    })
  });

  const data = (await response.json().catch(() => ({}))) as InstallBootstrapResponse & Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "No se pudo iniciar la sesion del dispositivo.");
  }

  if (typeof data.token !== "string" || typeof data.expiresAt !== "string") {
    if (data.integrityRequired === true && data.integrity) {
      saveInstallBootstrap(data.integrity);
      throw new Error("Esta version requiere validacion de Google Play desde la app Android.");
    }
    throw new Error("No se pudo iniciar la sesion del dispositivo.");
  }

  storeInstallToken(data.token, data.expiresAt);
  if (data.usage) {
    storeUsageSnapshot(data.usage);
  }

  return data.token;
}
