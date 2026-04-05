import { z } from "zod";

export const testPlanOverrideSchema = z.object({
  installId: z.string().trim().min(12).max(160),
  plan: z.enum(["free", "basic", "pro"])
});

export type TestPlanOverrideRequest = z.infer<typeof testPlanOverrideSchema>;
