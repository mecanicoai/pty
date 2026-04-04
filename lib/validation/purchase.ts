import { z } from "zod";

export const purchaseVerificationSchema = z.object({
  installId: z.string().trim().min(12).max(160),
  packageName: z.string().trim().min(3).max(200),
  productId: z.string().trim().min(1).max(200),
  purchaseToken: z.string().trim().min(10).max(2000)
});

export type PurchaseVerificationRequest = z.infer<typeof purchaseVerificationSchema>;
