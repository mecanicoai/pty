import type { InstallBootstrapResponse } from "@/types/api";

const STORAGE_KEYS = {
  installId: "mecanico-install-id",
  installToken: "mecanico-install-token",
  installTokenExpiry: "mecanico-install-token-expiry",
  installBootstrap: "mecanico-install-bootstrap"
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

export function clearStoredInstallSession() {
  window.localStorage.removeItem(STORAGE_KEYS.installToken);
  window.localStorage.removeItem(STORAGE_KEYS.installTokenExpiry);
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
  saveInstallBootstrap(null);
  window.dispatchEvent(new CustomEvent("mecanico-install-token-ready", { detail: { expiresAt: nextExpiry } }));
  return true;
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

  return data.token;
}
