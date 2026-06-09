ALTER TABLE "worker" ADD COLUMN IF NOT EXISTS "contract_source" text;
ALTER TABLE "worker" ADD COLUMN IF NOT EXISTS "contract_accounting_seen_at" timestamp with time zone;
