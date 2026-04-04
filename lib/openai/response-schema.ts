import { z } from "zod";

export const diagnosticResponseSchema = z.object({
  language: z.enum(["es", "en"]),
  summary: z.string().min(1).max(2000),
  urgency: z.enum(["safe_to_drive", "caution", "unsafe"]),
  likely_causes: z.array(z.string().min(1)).max(12),
  possible_causes: z.array(z.string().min(1)).max(12),
  safety_critical: z.array(z.string().min(1)).max(12),
  next_steps: z.array(z.string().min(1)).max(20),
  tools_needed: z.array(z.string().min(1)).max(20),
  follow_up_questions: z.array(z.string().min(1)).max(20),
  used_web_search: z.boolean()
});

export type DiagnosticStructuredOutput = z.infer<typeof diagnosticResponseSchema>;

export const diagnosticResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "language",
    "summary",
    "urgency",
    "likely_causes",
    "possible_causes",
    "safety_critical",
    "next_steps",
    "tools_needed",
    "follow_up_questions",
    "used_web_search"
  ],
  properties: {
    language: { type: "string", enum: ["es", "en"] },
    summary: { type: "string" },
    urgency: { type: "string", enum: ["safe_to_drive", "caution", "unsafe"] },
    likely_causes: { type: "array", items: { type: "string" } },
    possible_causes: { type: "array", items: { type: "string" } },
    safety_critical: { type: "array", items: { type: "string" } },
    next_steps: { type: "array", items: { type: "string" } },
    tools_needed: { type: "array", items: { type: "string" } },
    follow_up_questions: { type: "array", items: { type: "string" } },
    used_web_search: { type: "boolean" }
  }
} as const;
