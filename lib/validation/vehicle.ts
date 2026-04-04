import { z } from "zod";

import { uuidSchema, vehicleInputSchema } from "@/lib/validation/shared";

export const upsertVehicleSchema = z.object({
  sessionId: uuidSchema,
  vehicle: vehicleInputSchema
});

export type UpsertVehiclePayload = z.infer<typeof upsertVehicleSchema>;
