import { z } from "zod";

import { languageSchema, modeSchema, uuidSchema } from "@/lib/validation/shared";

export const createSessionSchema = z.object({
  email: z.string().trim().email().optional(),
  userId: uuidSchema.optional(),
  language: languageSchema.default("es"),
  mode: modeSchema.default("diagnostic"),
  title: z.string().trim().min(1).max(120).optional()
});

export type CreateSessionPayload = z.infer<typeof createSessionSchema>;
