import { z } from "zod";

export const updateSystemSettingsSchema = z.object({
  pilotCommissionPercentage: z
    .number()
    .min(0, "Pilot commission percentage cannot be negative.")
    .max(100, "Pilot commission percentage cannot exceed 100%.")
    .optional(),
  costPerHectare: z
    .number()
    .positive("Cost per hectare must be greater than zero.")
    .optional(),
  minimumDispatchFee: z
    .number()
    .positive("Minimum dispatch fee must be greater than zero.")
    .optional(),
  operationRates: z
    .record(z.string(), z.number().positive("Rate must be positive."))
    .optional(),
});

export type UpdateSystemSettingsInput = z.infer<typeof updateSystemSettingsSchema>;