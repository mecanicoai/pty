import { z } from "zod";

import { languageSchema, modeSchema, vehicleInputSchema } from "@/lib/validation/shared";

const attachmentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  mimeType: z.string().trim().min(1).max(120),
  kind: z.enum(["image", "file"]),
  dataBase64: z.string().min(20).max(12_000_000)
});

const historyItemSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().trim().min(1).max(8000),
  createdAt: z.string().optional(),
  usedWebSearch: z.boolean().optional()
});

export const chatRequestSchema = z.object({
  sessionId: z.string().trim().min(1).max(120).optional(),
  message: z.string().trim().min(1).max(5000),
  vehicle: vehicleInputSchema.nullable().optional(),
  language: languageSchema.default("es"),
  mode: modeSchema.default("diagnostic"),
  attachments: z.array(attachmentSchema).max(4).default([]),
  recentMessages: z.array(historyItemSchema).max(20).default([])
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
