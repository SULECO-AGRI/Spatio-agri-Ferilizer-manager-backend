-- CreateEnum
CREATE TYPE "PilotStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ON_MISSION', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('FERTILIZING');

-- CreateEnum
CREATE TYPE "RequestPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MissionStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'SETTLED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CASH', 'CARD_GATEWAY', 'ONLINE_QR');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PayoutSettlementStatus" AS ENUM ('UNSETTLED', 'QUEUED', 'SETTLED');

-- CreateTable
CREATE TABLE "roles" (
    "role_id" SERIAL NOT NULL,
    "name" VARCHAR(20) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("role_id")
);

-- CreateTable
CREATE TABLE "users" (
    "user_id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "first_name" VARCHAR(50) NOT NULL,
    "last_name" VARCHAR(50) NOT NULL,
    "mobile" VARCHAR(15) NOT NULL,
    "role_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "farmer_profiles" (
    "user_id" INTEGER NOT NULL,
    "nic" VARCHAR(20),
    "address" TEXT,
    "member_since" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "farmer_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "admin_profiles" (
    "user_id" INTEGER NOT NULL,
    "department" VARCHAR(50),
    "access_level" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "pilot_profiles" (
    "user_id" INTEGER NOT NULL,
    "licence_number" VARCHAR(50) NOT NULL,
    "status" "PilotStatus" NOT NULL DEFAULT 'ACTIVE',
    "ratings" DECIMAL(3,2) DEFAULT 5.00,
    "completed_missions" INTEGER NOT NULL DEFAULT 0,
    "total_flight_hours" DECIMAL(8,2) NOT NULL DEFAULT 0.00,

    CONSTRAINT "pilot_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "fields" (
    "id" SERIAL NOT NULL,
    "farmer_id" INTEGER NOT NULL,
    "field_name" VARCHAR(255) NOT NULL,
    "crop_type" VARCHAR(50) NOT NULL,
    "location_coordinates" JSONB NOT NULL,
    "area" DECIMAL(8,2) NOT NULL,
    "province" VARCHAR(50) NOT NULL,
    "district" VARCHAR(50) NOT NULL,
    "city" VARCHAR(50) NOT NULL,
    "village" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_requests" (
    "request_id" SERIAL NOT NULL,
    "request_code" VARCHAR(20) NOT NULL,
    "field_id" INTEGER NOT NULL,
    "service_type" "ServiceType" NOT NULL,
    "preferred_date" DATE NOT NULL,
    "priority" "RequestPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "estimated_cost" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("request_id")
);

-- CreateTable
CREATE TABLE "missions" (
    "mission_id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "pilot_id" INTEGER,
    "assigned_by" INTEGER,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "status" "MissionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "area_spread" DECIMAL(8,2),
    "pilot_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "missions_pkey" PRIMARY KEY ("mission_id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "review_id" SERIAL NOT NULL,
    "mission_id" INTEGER NOT NULL,
    "pilot_id" INTEGER NOT NULL,
    "farmer_id" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("review_id"),
    CONSTRAINT "reviews_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5)
);

-- CreateTable
CREATE TABLE "payouts" (
    "payout_id" SERIAL NOT NULL,
    "pilot_id" INTEGER NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "bank_name" VARCHAR(150) NOT NULL,
    "bank_account_no" VARCHAR(50) NOT NULL,
    "transaction_ref" VARCHAR(100),
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "settled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("payout_id"),
    CONSTRAINT "payouts_amount_check" CHECK ("amount" > 0.00)
);

-- CreateTable
CREATE TABLE "payments" (
    "payment_id" SERIAL NOT NULL,
    "mission_id" INTEGER NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "company_commission" DECIMAL(10,2) NOT NULL,
    "pilot_earnings" DECIMAL(10,2) NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "payout_id" INTEGER,
    "payout_status" "PayoutSettlementStatus" NOT NULL DEFAULT 'UNSETTLED',
    "transaction_reference" VARCHAR(100),
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("payment_id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "log_id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "action" VARCHAR(50) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" VARCHAR(50),
    "details" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("log_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_mobile_key" ON "users"("mobile");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_mobile_idx" ON "users"("mobile");

-- CreateIndex
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "farmer_profiles_nic_key" ON "farmer_profiles"("nic");

-- CreateIndex
CREATE INDEX "farmer_profiles_nic_idx" ON "farmer_profiles"("nic");

-- CreateIndex
CREATE UNIQUE INDEX "pilot_profiles_licence_number_key" ON "pilot_profiles"("licence_number");

-- CreateIndex
CREATE INDEX "pilot_profiles_status_idx" ON "pilot_profiles"("status");

-- CreateIndex
CREATE INDEX "pilot_profiles_licence_number_idx" ON "pilot_profiles"("licence_number");

-- CreateIndex
CREATE INDEX "fields_farmer_id_idx" ON "fields"("farmer_id");

-- CreateIndex
CREATE INDEX "fields_district_province_idx" ON "fields"("district", "province");

-- CreateIndex
CREATE UNIQUE INDEX "service_requests_request_code_key" ON "service_requests"("request_code");

-- CreateIndex
CREATE INDEX "service_requests_field_id_idx" ON "service_requests"("field_id");

-- CreateIndex
CREATE INDEX "service_requests_status_idx" ON "service_requests"("status");

-- CreateIndex
CREATE INDEX "service_requests_preferred_date_idx" ON "service_requests"("preferred_date");

-- CreateIndex
CREATE INDEX "service_requests_priority_idx" ON "service_requests"("priority");

-- CreateIndex
CREATE INDEX "missions_request_id_idx" ON "missions"("request_id");

-- CreateIndex
CREATE INDEX "missions_pilot_id_idx" ON "missions"("pilot_id");

-- CreateIndex
CREATE INDEX "missions_assigned_by_idx" ON "missions"("assigned_by");

-- CreateIndex
CREATE INDEX "missions_status_idx" ON "missions"("status");

-- CreateIndex
CREATE INDEX "missions_started_at_idx" ON "missions"("started_at");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_mission_id_key" ON "reviews"("mission_id");

-- CreateIndex
CREATE INDEX "reviews_pilot_id_idx" ON "reviews"("pilot_id");

-- CreateIndex
CREATE INDEX "reviews_farmer_id_idx" ON "reviews"("farmer_id");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_transaction_ref_key" ON "payouts"("transaction_ref");

-- CreateIndex
CREATE INDEX "payouts_pilot_id_idx" ON "payouts"("pilot_id");

-- CreateIndex
CREATE INDEX "payouts_status_idx" ON "payouts"("status");

-- CreateIndex
CREATE INDEX "payouts_period_start_period_end_idx" ON "payouts"("period_start", "period_end");

-- CreateIndex
CREATE UNIQUE INDEX "payments_mission_id_key" ON "payments"("mission_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_transaction_reference_key" ON "payments"("transaction_reference");

-- CreateIndex
CREATE INDEX "payments_payout_id_idx" ON "payments"("payout_id");

-- CreateIndex
CREATE INDEX "payments_payment_status_idx" ON "payments"("payment_status");

-- CreateIndex
CREATE INDEX "payments_payout_status_idx" ON "payments"("payout_status");

-- CreateIndex
CREATE INDEX "activity_logs_user_id_idx" ON "activity_logs"("user_id");

-- CreateIndex
CREATE INDEX "activity_logs_entity_type_entity_id_idx" ON "activity_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farmer_profiles" ADD CONSTRAINT "farmer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_profiles" ADD CONSTRAINT "admin_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pilot_profiles" ADD CONSTRAINT "pilot_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fields" ADD CONSTRAINT "fields_farmer_id_fkey" FOREIGN KEY ("farmer_id") REFERENCES "farmer_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missions" ADD CONSTRAINT "missions_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "service_requests"("request_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missions" ADD CONSTRAINT "missions_pilot_id_fkey" FOREIGN KEY ("pilot_id") REFERENCES "pilot_profiles"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missions" ADD CONSTRAINT "missions_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("mission_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_pilot_id_fkey" FOREIGN KEY ("pilot_id") REFERENCES "pilot_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_farmer_id_fkey" FOREIGN KEY ("farmer_id") REFERENCES "farmer_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_pilot_id_fkey" FOREIGN KEY ("pilot_id") REFERENCES "pilot_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("mission_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "payouts"("payout_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
