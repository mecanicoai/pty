import type { ChatAttachment, VehicleContext } from "@/types/chat";

export type AppExperienceMode = "diy" | "pro";

export type ProWorkspaceView = "client_message" | "chat" | "quote" | "invoice" | "brief";

export type ProCaseStatus = "new" | "missing_info" | "waiting_customer" | "quoted" | "approved" | "in_progress" | "delivered";

export interface ProSentRecord {
  kind: "questions" | "reply" | "quote" | "invoice" | "brief" | "reminder";
  channel: "copy" | "whatsapp" | "pdf" | "generated";
  label: string;
  at: string;
}

export interface ProCaseRecord {
  status: ProCaseStatus;
  quoteVersion: number;
  pendingQuestions: string[];
  missingFields: string[];
  approvedAt?: string;
  lastQuoteAt?: string;
  lastQuoteNumber?: string;
  lastSentAt?: string;
  lastSentLabel?: string;
  sentHistory: ProSentRecord[];
}

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
  intro: string;
  totalLabel: string;
  lineItems: Array<{
    label: string;
    why: string;
    laborHours: string;
    laborCostRange: string;
    partsCostRange: string;
    totalRange: string;
  }>;
  notes: string[];
}

export interface ProWorkflowOutput {
  sourceMessage: string;
  customerName?: string;
  vehicleLabel?: string;
  customerPhone?: string;
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
  documentType?: "quote" | "invoice" | "brief";
  customerName: string;
  vehicleLabel: string;
  customerPhone?: string;
  summary: string;
  notes: string;
  amount: number;
  amountLabel?: string;
  quoteDate?: string;
  quoteNumber?: string;
  customerComplaint?: string;
  recommendedService?: string;
  serviceDescription?: string;
  diagnosticFeeLabel?: string;
  laborTotalLabel?: string;
  partsTotalLabel?: string;
  otherTotalLabel?: string;
  subtotalLabel?: string;
  taxTotalLabel?: string;
  estimatedTime?: string;
  availabilityEstimate?: string;
  depositAmountLabel?: string;
  paymentMethod?: string;
  importantNotes?: string[];
  vehicleYear?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleEngine?: string;
  vehicleIdentifier?: string;
}

export interface ProductStateSnapshot {
  selectedMode: AppExperienceMode | null;
  businessProfile: BusinessProfile | null;
  lastWorkflowOutput: ProWorkflowOutput | null;
  lastVehicleContext: VehicleContext | null;
}
