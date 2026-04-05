import type { ChatAttachment, VehicleContext } from "@/types/chat";

export type AppExperienceMode = "diy" | "pro";

export type ProWorkspaceView = "home" | "client_message" | "chat" | "quote" | "invoice" | "brief";

export interface BusinessProfile {
  business_name: string;
  mechanic_name: string;
  whatsapp_number: string;
  business_type: string;
  currency: string;
  payment_link: string;
  email?: string;
  business_address?: string;
  logo?: string;
  default_diagnostic_fee?: number | null;
  labor_rate?: number | null;
  default_disclaimer?: string;
}

export interface CustomerMessageDraft {
  customerMessage: string;
  customerName?: string;
  vehicleLabel?: string;
  attachments: ChatAttachment[];
}

export interface WorkflowQuoteDraft {
  title: string;
  lineItems: Array<{
    label: string;
    amount: number;
  }>;
  total: number;
  notes: string[];
}

export interface ProWorkflowOutput {
  sourceMessage: string;
  customerName?: string;
  vehicleLabel?: string;
  clientProblemSummary: string;
  suggestedReply: string;
  nextStepExplanation: string;
  quoteDraft: WorkflowQuoteDraft | null;
  internalJobBrief: string;
  likelyIssueCategory: string;
  unansweredQuestions: string[];
  recommendedNextDiagnosticStep: string;
  technicianNotes: string[];
  rawSummary: string;
}

export interface ProDocumentDraft {
  customerName: string;
  vehicleLabel: string;
  summary: string;
  notes: string;
  amount: number;
}

export interface ProductStateSnapshot {
  selectedMode: AppExperienceMode | null;
  businessProfile: BusinessProfile | null;
  lastWorkflowOutput: ProWorkflowOutput | null;
  lastVehicleContext: VehicleContext | null;
}
