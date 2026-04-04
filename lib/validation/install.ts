import { z } from "zod";

export const installRequestSchema = z.object({
  installId: z.string().trim().min(12).max(160),
  platform: z.enum(["web", "android", "ios"]).default("web"),
  appVersion: z.string().trim().min(1).max(40).optional()
});

export type InstallRequest = z.infer<typeof installRequestSchema>;
