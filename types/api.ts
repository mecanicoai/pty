import type { PlanUsageSnapshot, SubscriptionPlan } from "@/lib/billing/plans";
import type { AppLanguage, AppMode, ChatAttachment, DiagnosticResponse, VehicleContext } from "@/types/chat";

export interface SessionSummary {
  id: string;
  title: string;
  language: AppLanguage;
  mode: AppMode;
  updatedAt: string;
}

export interface ChatHistoryItem {
  role: "user" | "assistant";
  text: string;
  createdAt?: string;
  usedWebSearch?: boolean;
}

export interface ChatResponse extends DiagnosticResponse {
  plan: SubscriptionPlan;
  usage: PlanUsageSnapshot;
  sessionId?: string;
  requestId?: string;
}

export interface InstallIntegrityBootstrap {
  challengeToken: string;
  requestHash: string;
  issuedAt: string;
  expiresAt: string;
}

export interface InstallBootstrapResponse {
  installId: string;
  plan?: SubscriptionPlan;
  usage?: PlanUsageSnapshot;
  token?: string;
  expiresAt?: string;
  integrityRequired?: boolean;
  integrity?: InstallIntegrityBootstrap;
  requestId?: string;
}

export interface ChatRequestPayload {
  sessionId?: string;
  message: string;
  vehicle?: VehicleContext | null;
  language?: AppLanguage;
  mode?: AppMode;
  attachments?: ChatAttachment[];
  recentMessages?: ChatHistoryItem[];
}

export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
  requestId?: string;
}
