import { z } from "zod";

export const languageSchema = z.enum(["es", "en"]);
export const modeSchema = z.enum(["diagnostic", "shop", "diy"]);
export const uuidSchema = z.string().uuid();

export const vehicleInputSchema = z.object({
  year: z.number().int().min(1950).max(2100).nullable().optional(),
  make: z.string().trim().max(80).nullable().optional(),
  model: z.string().trim().max(80).nullable().optional(),
  engine: z.string().trim().max(80).nullable().optional(),
  drivetrain: z.string().trim().max(80).nullable().optional(),
  mileage: z.number().int().min(0).max(3000000).nullable().optional(),
  dtcCodes: z.array(z.string().trim().max(20)).max(20).optional(),
  symptomNotes: z.string().trim().max(3000).nullable().optional()
});

export type VehicleInput = z.infer<typeof vehicleInputSchema>;
