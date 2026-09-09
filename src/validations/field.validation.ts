import { z } from "zod";

/**
 * Helper to validate decimal precision up to 2 decimal places
 */
const decimalTwoPlaces = (val: number) => {
  const str = val.toString();
  if (!str.includes(".")) return true;
  const decimals = str.split(".")[1];
  return decimals.length <= 2;
};

/**
 * 1. Path Params Validation: Field ID
 */
export const fieldIdParamSchema = z.object({
  id: z
    .string({ message: "Field ID parameter is required" })
    .regex(/^\d+$/, "Field ID must be a positive integer")
    .transform(Number),
});

/**
 * 2. Query Validation: List Fields
 */
export const fieldListQuerySchema = z
  .object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? Number(val) : 1))
      .refine((val) => Number.isInteger(val) && val > 0, {
        message: "Page must be a positive integer",
      }),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? Number(val) : 10))
      .refine((val) => Number.isInteger(val) && val > 0 && val <= 100, {
        message: "Limit must be between 1 and 100",
      }),
    search: z
      .string()
      .optional()
      .transform((val) => val?.trim()),
    cropType: z
      .string()
      .optional()
      .transform((val) => val?.trim()),
    crop_type: z
      .string()
      .optional()
      .transform((val) => val?.trim()),
    district: z
      .string()
      .optional()
      .transform((val) => val?.trim()),
    province: z
      .string()
      .optional()
      .transform((val) => val?.trim()),
    farmerId: z
      .string()
      .optional()
      .transform((val) => (val ? Number(val) : undefined))
      .refine((val) => val === undefined || (Number.isInteger(val) && val > 0), {
        message: "farmerId must be a positive integer",
      }),
    farmer_id: z
      .string()
      .optional()
      .transform((val) => (val ? Number(val) : undefined))
      .refine((val) => val === undefined || (Number.isInteger(val) && val > 0), {
        message: "farmer_id must be a positive integer",
      }),
    sortBy: z
      .enum(["fieldName", "field_name", "area", "createdAt", "created_at", "cropType", "crop_type"])
      .optional()
      .default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  })
  .transform((data) => ({
    page: data.page ?? 1,
    limit: data.limit ?? 10,
    search: data.search,
    cropType: data.cropType ?? data.crop_type,
    district: data.district,
    province: data.province,
    farmerId: data.farmerId ?? data.farmer_id,
    sortBy:
      data.sortBy === "field_name"
        ? "fieldName"
        : data.sortBy === "crop_type"
        ? "cropType"
        : data.sortBy === "created_at"
        ? "createdAt"
        : data.sortBy ?? "createdAt",
    sortOrder: data.sortOrder ?? "desc",
  }));

/**
 * 3. Body Validation: Create Field
 */
export const createFieldBodySchema = z
  .object({
    farmer_id: z
      .number()
      .int("farmer_id must be an integer")
      .positive("farmer_id must be a positive integer")
      .optional(),
    farmerId: z
      .number()
      .int("farmerId must be an integer")
      .positive("farmerId must be a positive integer")
      .optional(),
    field_name: z
      .string()
      .min(1, "Field name cannot be empty")
      .max(255, "Field name cannot exceed 255 characters")
      .transform((val) => val.trim())
      .optional(),
    fieldName: z
      .string()
      .min(1, "Field name cannot be empty")
      .max(255, "Field name cannot exceed 255 characters")
      .transform((val) => val.trim())
      .optional(),
    crop_type: z
      .string()
      .min(1, "Crop type cannot be empty")
      .max(50, "Crop type cannot exceed 50 characters")
      .transform((val) => val.trim())
      .optional(),
    cropType: z
      .string()
      .min(1, "Crop type cannot be empty")
      .max(50, "Crop type cannot exceed 50 characters")
      .transform((val) => val.trim())
      .optional(),
    area: z
      .number({ message: "Area in acres is required" })
      .positive("Area must be a positive number")
      .max(999999.99, "Area exceeds maximum allowable value")
      .refine(decimalTwoPlaces, {
        message: "Area must have at most 2 decimal places",
      }),
    location_coordinates: z.any().optional(),
    locationCoordinates: z.any().optional(),
    province: z
      .string({ message: "Province is required" })
      .min(1, "Province cannot be empty")
      .max(50, "Province cannot exceed 50 characters")
      .transform((val) => val.trim()),
    district: z
      .string({ message: "District is required" })
      .min(1, "District cannot be empty")
      .max(50, "District cannot exceed 50 characters")
      .transform((val) => val.trim()),
    city: z
      .string({ message: "City is required" })
      .min(1, "City cannot be empty")
      .max(50, "City cannot exceed 50 characters")
      .transform((val) => val.trim()),
    village: z
      .string({ message: "Village is required" })
      .min(1, "Village cannot be empty")
      .max(50, "Village cannot exceed 50 characters")
      .transform((val) => val.trim()),
  })
  .refine(
    (data) => data.field_name !== undefined || data.fieldName !== undefined,
    {
      message: "field_name is required",
      path: ["field_name"],
    }
  )
  .refine(
    (data) => data.crop_type !== undefined || data.cropType !== undefined,
    {
      message: "crop_type is required",
      path: ["crop_type"],
    }
  )
  .refine(
    (data) =>
      data.location_coordinates !== undefined ||
      data.locationCoordinates !== undefined,
    {
      message: "location_coordinates is required",
      path: ["location_coordinates"],
    }
  )
  .transform((data) => {
    const fieldName = (data.field_name ?? data.fieldName)!;
    const cropType = (data.crop_type ?? data.cropType)!;
    const farmerId = data.farmer_id ?? data.farmerId;
    const locationCoordinates =
      data.location_coordinates ?? data.locationCoordinates;

    return {
      farmerId,
      farmer_id: farmerId,
      fieldName,
      field_name: fieldName,
      cropType,
      crop_type: cropType,
      area: data.area,
      locationCoordinates,
      location_coordinates: locationCoordinates,
      province: data.province,
      district: data.district,
      city: data.city,
      village: data.village,
    };
  });

/**
 * 4. Body Validation: Update Field
 */
export const updateFieldBodySchema = z
  .object({
    field_name: z
      .string()
      .min(1, "Field name cannot be empty")
      .max(255, "Field name cannot exceed 255 characters")
      .transform((val) => val.trim())
      .optional(),
    fieldName: z
      .string()
      .min(1, "Field name cannot be empty")
      .max(255, "Field name cannot exceed 255 characters")
      .transform((val) => val.trim())
      .optional(),
    crop_type: z
      .string()
      .min(1, "Crop type cannot be empty")
      .max(50, "Crop type cannot exceed 50 characters")
      .transform((val) => val.trim())
      .optional(),
    cropType: z
      .string()
      .min(1, "Crop type cannot be empty")
      .max(50, "Crop type cannot exceed 50 characters")
      .transform((val) => val.trim())
      .optional(),
    area: z
      .number()
      .positive("Area must be a positive number")
      .max(999999.99, "Area exceeds maximum allowable value")
      .refine(decimalTwoPlaces, {
        message: "Area must have at most 2 decimal places",
      })
      .optional(),
    location_coordinates: z.any().optional(),
    locationCoordinates: z.any().optional(),
    province: z
      .string()
      .min(1, "Province cannot be empty")
      .max(50, "Province cannot exceed 50 characters")
      .transform((val) => val.trim())
      .optional(),
    district: z
      .string()
      .min(1, "District cannot be empty")
      .max(50, "District cannot exceed 50 characters")
      .transform((val) => val.trim())
      .optional(),
    city: z
      .string()
      .min(1, "City cannot be empty")
      .max(50, "City cannot exceed 50 characters")
      .transform((val) => val.trim())
      .optional(),
    village: z
      .string()
      .min(1, "Village cannot be empty")
      .max(50, "Village cannot exceed 50 characters")
      .transform((val) => val.trim())
      .optional(),
  })
  .transform((data) => {
    const fieldName = data.field_name ?? data.fieldName;
    const cropType = data.crop_type ?? data.cropType;
    const locationCoordinates =
      data.location_coordinates ?? data.locationCoordinates;

    return {
      fieldName,
      field_name: fieldName,
      cropType,
      crop_type: cropType,
      area: data.area,
      locationCoordinates,
      location_coordinates: locationCoordinates,
      province: data.province,
      district: data.district,
      city: data.city,
      village: data.village,
    };
  });

