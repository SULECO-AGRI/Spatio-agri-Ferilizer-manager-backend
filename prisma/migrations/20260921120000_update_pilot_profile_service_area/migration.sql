-- ==============================================================================
-- Migration: 20260921120000_update_pilot_profile_service_area
-- Description: Make licence_number optional/nullable and add service_area JSONB column
-- ==============================================================================

-- 1. Make licence_number nullable on pilot_profiles
ALTER TABLE "pilot_profiles" ALTER COLUMN "licence_number" DROP NOT NULL;

-- 2. Add service_area JSONB column to pilot_profiles
ALTER TABLE "pilot_profiles" ADD COLUMN IF NOT EXISTS "service_area" JSONB;

-- 3. Add GIN index on service_area for efficient spatial/JSON lookups
CREATE INDEX IF NOT EXISTS "idx_pilot_profiles_service_area_gin" ON "pilot_profiles" USING gin ("service_area");
