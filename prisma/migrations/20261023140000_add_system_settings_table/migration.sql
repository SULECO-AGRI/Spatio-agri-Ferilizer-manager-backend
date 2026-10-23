-- CreateTable
CREATE TABLE IF NOT EXISTS "system_settings" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "description" VARCHAR(255),
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "system_settings_key_key" ON "system_settings"("key");

-- AddForeignKey
DO $do$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'system_settings_updated_by_fkey'
    ) THEN
        ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $do$;

-- Insert initial dynamic settings for pilot commission and cost per hectare
INSERT INTO "system_settings" ("key", "value", "description")
VALUES 
  ('pilot_commission_percentage', '70', 'Percentage of mission cost allocated to the pilot (0-100)'),
  ('cost_per_hectare', '6200', 'Standard base cost per hectare in LKR for precision fertilizer spraying')
ON CONFLICT ("key") DO NOTHING;