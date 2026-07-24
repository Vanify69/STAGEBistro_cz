ALTER TABLE "expense_receipt" ADD COLUMN IF NOT EXISTS "accounting_emailed_at" timestamp with time zone;
