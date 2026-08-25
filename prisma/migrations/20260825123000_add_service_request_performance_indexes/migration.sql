-- ==============================================================================
-- Migration: 20260825123000_add_service_request_performance_indexes
-- Description: Composite ESR indexes, partial active queue index, and GIN geo index
-- ==============================================================================

-- Drop old single-column indexes superseded by composite ESR indexes
DROP INDEX IF EXISTS "missions_assigned_by_idx";
DROP INDEX IF EXISTS "missions_pilot_id_idx";
DROP INDEX IF EXISTS "missions_request_id_idx";
DROP INDEX IF EXISTS "missions_status_idx";
DROP INDEX IF EXISTS "service_requests_field_id_idx";
DROP INDEX IF EXISTS "service_requests_preferred_date_idx";
DROP INDEX IF EXISTS "service_requests_priority_idx";
DROP INDEX IF EXISTS "service_requests_status_idx";

-- 1. Fields Performance Indexes
CREATE INDEX IF NOT EXISTS "fields_farmer_id_created_at_idx" ON "fields"("farmer_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_fields_location_coords_gin" ON "fields" USING gin ("location_coordinates");

-- 2. Service Requests Composite & Sorted ESR Indexes
CREATE INDEX IF NOT EXISTS "service_requests_status_created_at_idx" ON "service_requests"("status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "service_requests_field_id_status_created_at_idx" ON "service_requests"("field_id", "status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "service_requests_field_id_created_at_idx" ON "service_requests"("field_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "service_requests_preferred_date_status_created_at_idx" ON "service_requests"("preferred_date", "status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "service_requests_priority_status_created_at_idx" ON "service_requests"("priority", "status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "service_requests_service_type_status_created_at_idx" ON "service_requests"("service_type", "status", "created_at" DESC);

-- 3. Partial Index for High-Traffic Active Request Queue
CREATE INDEX IF NOT EXISTS "idx_service_requests_active_queue" ON "service_requests"("status", "priority", "created_at" DESC) WHERE "status" IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS');

-- 4. Missions Composite Performance Indexes
CREATE INDEX IF NOT EXISTS "missions_pilot_id_status_created_at_idx" ON "missions"("pilot_id", "status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "missions_request_id_status_idx" ON "missions"("request_id", "status");
CREATE INDEX IF NOT EXISTS "missions_assigned_by_created_at_idx" ON "missions"("assigned_by", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "missions_status_created_at_idx" ON "missions"("status", "created_at" DESC);
