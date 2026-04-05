export type AppLanguage = "es" | "en";

export type AppMode = "diagnostic" | "shop" | "diy";

export type Urgency = "safe_to_drive" | "caution" | "unsafe";

export interface VehicleContext {
  year?: number | null;
  make?: string | null;
  model?: string | null;
  engine?: string | null;
  drivetrain?: string | null;
  mileage?: number | null;
  dtcCodes?: string[];
  symptomNotes?: string | null;
}

export interface ChatAttachment {
  name: string;
  mimeType: string;
  kind: "image" | "file";
  dataBase64: string;
}

export interface CustomerQuoteLineItem {
  label: string;
  why: string;
  labor_hours: string;
  labor_cost_range: string;
  parts_cost_range: string;
  total_range: string;
}

export interface CustomerQuote {
  ready: boolean;
  intro: string;
  total_estimate_range: string;
  line_items: CustomerQuoteLineItem[];
  notes: string[];
}

export interface DiagnosticResponse {
  language: AppLanguage;
  summary: string;
  urgency: Urgency;
  likely_causes: string[];
  possible_causes: string[];
  safety_critical: string[];
  next_steps: string[];
  tools_needed: string[];
  follow_up_questions: string[];
  customer_quote: CustomerQuote | null;
  used_web_search: boolean;
}

export interface PersistedMessage {
  id: string;
  role: "user" | "assistant";
  createdAt: string;
  usedWebSearch: boolean;
  content: unknown;
}
