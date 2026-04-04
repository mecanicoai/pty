import type { DiagnosticResponse } from "@/types/chat";

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  usedWebSearch?: boolean;
  diagnostic?: DiagnosticResponse;
  attachmentNames?: string[];
}
