import type { DiagnosticResponse } from "@/types/chat";
import type { BusinessProfile, ProDocumentDraft, ProWorkflowOutput } from "@/types/product";

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  usedWebSearch?: boolean;
  diagnostic?: DiagnosticResponse;
  workflowOutput?: ProWorkflowOutput;
  documentPreview?: {
    title: string;
    draft: ProDocumentDraft;
    business: BusinessProfile;
  };
  attachmentNames?: string[];
}
