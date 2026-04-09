import type { BusinessProfile, ProductStateSnapshot, ProWorkflowOutput, AppExperienceMode } from "@/types/product";
import type { SubscriptionPlan } from "@/lib/billing/plans";
import type { VehicleContext } from "@/types/chat";

const STORAGE_KEYS = {
  selectedMode: "mecanico-selected-mode",
  selectedPlan: "mecanico-selected-plan",
  localModelOverride: "mecanico-local-model-override",
  businessProfile: "mecanico-business-profile",
  lastWorkflowOutput: "mecanico-last-workflow-output",
  lastVehicleContext: "mecanico-last-vehicle-context"
} as const;

function canUseStorage() {
  return typeof window !== "undefined";
}

export function getSelectedMode(): AppExperienceMode | null {
  if (!canUseStorage()) {
    return null;
  }
  const raw = window.localStorage.getItem(STORAGE_KEYS.selectedMode);
  return raw === "diy" || raw === "pro" ? raw : null;
}

export function setSelectedMode(mode: AppExperienceMode) {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.setItem(STORAGE_KEYS.selectedMode, mode);
}

export function clearSelectedMode() {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.removeItem(STORAGE_KEYS.selectedMode);
}

export function getSelectedPlan(): SubscriptionPlan | null {
  if (!canUseStorage()) {
    return null;
  }
  const raw = window.localStorage.getItem(STORAGE_KEYS.selectedPlan);
  return raw === "free" || raw === "basic" || raw === "pro" ? raw : null;
}

export function setSelectedPlan(plan: SubscriptionPlan) {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.setItem(STORAGE_KEYS.selectedPlan, plan);
}

export function clearSelectedPlan() {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.removeItem(STORAGE_KEYS.selectedPlan);
}

export function getLocalModelOverride() {
  if (!canUseStorage()) {
    return "";
  }
  return window.localStorage.getItem(STORAGE_KEYS.localModelOverride) ?? "";
}

export function setLocalModelOverride(value: string) {
  if (!canUseStorage()) {
    return;
  }
  const clean = value.trim();
  if (!clean) {
    window.localStorage.removeItem(STORAGE_KEYS.localModelOverride);
    return;
  }
  window.localStorage.setItem(STORAGE_KEYS.localModelOverride, clean);
}

export function clearLocalModelOverride() {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.removeItem(STORAGE_KEYS.localModelOverride);
}

export function getBusinessProfile(): BusinessProfile | null {
  if (!canUseStorage()) {
    return null;
  }
  const raw = window.localStorage.getItem(STORAGE_KEYS.businessProfile);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as BusinessProfile;
    if (!parsed?.business_name || !parsed.mechanic_name || !parsed.whatsapp_number) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setBusinessProfile(profile: BusinessProfile) {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.setItem(STORAGE_KEYS.businessProfile, JSON.stringify(profile));
}

export function getLastWorkflowOutput(): ProWorkflowOutput | null {
  if (!canUseStorage()) {
    return null;
  }
  const raw = window.localStorage.getItem(STORAGE_KEYS.lastWorkflowOutput);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as ProWorkflowOutput;
  } catch {
    return null;
  }
}

export function setLastWorkflowOutput(output: ProWorkflowOutput | null) {
  if (!canUseStorage()) {
    return;
  }
  if (!output) {
    window.localStorage.removeItem(STORAGE_KEYS.lastWorkflowOutput);
    return;
  }
  window.localStorage.setItem(STORAGE_KEYS.lastWorkflowOutput, JSON.stringify(output));
}

export function getLastVehicleContext(): VehicleContext | null {
  if (!canUseStorage()) {
    return null;
  }
  const raw = window.localStorage.getItem(STORAGE_KEYS.lastVehicleContext);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as VehicleContext;
  } catch {
    return null;
  }
}

export function setLastVehicleContext(vehicle: VehicleContext | null) {
  if (!canUseStorage()) {
    return;
  }
  if (!vehicle) {
    window.localStorage.removeItem(STORAGE_KEYS.lastVehicleContext);
    return;
  }
  window.localStorage.setItem(STORAGE_KEYS.lastVehicleContext, JSON.stringify(vehicle));
}

export function loadProductStateSnapshot(): ProductStateSnapshot {
  return {
    selectedMode: getSelectedMode(),
    businessProfile: getBusinessProfile(),
    lastWorkflowOutput: getLastWorkflowOutput(),
    lastVehicleContext: getLastVehicleContext()
  };
}
