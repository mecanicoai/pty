import { z } from "zod";

export const integrityVerificationSchema = z.object({
  installId: z.string().trim().min(12).max(160),
  integrityToken: z.string().trim().min(20).max(12000),
  challengeToken: z.string().trim().min(20).max(2000)
});

export type IntegrityVerificationRequest = z.infer<typeof integrityVerificationSchema>;
