import type { BusinessProfile, ProductStateSnapshot, ProWorkflowOutput, AppExperienceMode } from "@/types/product";
import type { VehicleContext } from "@/types/chat";

const STORAGE_KEYS = {
  selectedMode: "mecanico-selected-mode",
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
