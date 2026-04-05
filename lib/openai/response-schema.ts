import { z } from "zod";

const customerQuoteLineItemSchema = z.object({
  label: z.string().min(1).max(200),
  why: z.string().min(1).max(400),
  labor_hours: z.string().min(1).max(120),
  labor_cost_range: z.string().min(1).max(120),
  parts_cost_range: z.string().min(1).max(120),
  total_range: z.string().min(1).max(120)
});

const customerQuoteSchema = z.object({
  ready: z.boolean(),
  intro: z.string().min(1).max(1200),
  total_estimate_range: z.string().min(1).max(200),
  line_items: z.array(customerQuoteLineItemSchema).max(8),
  notes: z.array(z.string().min(1).max(400)).max(8)
});

export const diagnosticResponseSchema = z.object({
  language: z.enum(["es", "en"]),
  summary: z.string().min(1).max(2000),
  urgency: z.enum(["safe_to_drive", "caution", "unsafe"]),
  likely_causes: z.array(z.string().min(1)).max(12),
  possible_causes: z.array(z.string().min(1)).max(12),
  safety_critical: z.array(z.string().min(1)).max(12),
  next_steps: z.array(z.string().min(1)).max(20),
  tools_needed: z.array(z.string().min(1)).max(20),
  follow_up_questions: z.array(z.string().min(1)).max(3),
  customer_quote: customerQuoteSchema.nullable(),
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
    "customer_quote",
    "used_web_search"
  ],
  properties: {
    language: { type: "string", enum: ["es", "en"] },
    summary: { type: "string" },
    urgency: { type: "string", enum: ["safe_to_drive", "caution", "unsafe"] },
    likely_causes: { type: "array", items: { type: "string" }, maxItems: 12 },
    possible_causes: { type: "array", items: { type: "string" }, maxItems: 12 },
    safety_critical: { type: "array", items: { type: "string" }, maxItems: 12 },
    next_steps: { type: "array", items: { type: "string" }, maxItems: 20 },
    tools_needed: { type: "array", items: { type: "string" }, maxItems: 20 },
    follow_up_questions: { type: "array", items: { type: "string" }, maxItems: 3 },
    customer_quote: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["ready", "intro", "total_estimate_range", "line_items", "notes"],
          properties: {
            ready: { type: "boolean" },
            intro: { type: "string" },
            total_estimate_range: { type: "string" },
            line_items: {
              type: "array",
              maxItems: 8,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["label", "why", "labor_hours", "labor_cost_range", "parts_cost_range", "total_range"],
                properties: {
                  label: { type: "string" },
                  why: { type: "string" },
                  labor_hours: { type: "string" },
                  labor_cost_range: { type: "string" },
                  parts_cost_range: { type: "string" },
                  total_range: { type: "string" }
                }
              }
            },
            notes: { type: "array", items: { type: "string" }, maxItems: 8 }
          }
        }
      ]
    },
    used_web_search: { type: "boolean" }
  }
} as const;
