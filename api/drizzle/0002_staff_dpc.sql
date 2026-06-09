CREATE TYPE "public"."worker_status" AS ENUM('draft', 'contract_pending', 'active', 'inactive');
--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('open', 'confirmed');
--> statement-breakpoint
CREATE TYPE "public"."document_sequence_kind" AS ENUM('vpp');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "worker" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"birth_date" date,
	"address" text,
	"position" text DEFAULT 'Barista' NOT NULL,
	"work_place" text DEFAULT 'PRAHA' NOT NULL,
	"hourly_rate_cents" integer NOT NULL,
	"contract_start" date,
	"contract_end" date,
	"status" "worker_status" DEFAULT 'draft' NOT NULL,
	"contract_pdf_key" text,
	"contract_signed_at" timestamptz,
	"contract_signature_worker_key" text,
	"contract_signature_employer_key" text,
	"deleted_at" timestamptz,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shift_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"worker_id" uuid NOT NULL,
	"business_date" date NOT NULL,
	"planned_start" time NOT NULL,
	"planned_end" time NOT NULL,
	"note" text,
	"cancelled_at" timestamptz,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD CONSTRAINT "shift_assignment_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shift_assignment_worker_date_active" ON "shift_assignment" ("worker_id", "business_date") WHERE "cancelled_at" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attendance_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_assignment_id" uuid NOT NULL,
	"actual_start" timestamptz,
	"actual_end" timestamptz,
	"worked_minutes" integer,
	"status" "attendance_status" DEFAULT 'open' NOT NULL,
	"confirmed_at" timestamptz,
	"confirmed_by" uuid,
	"signature_storage_key" text,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance_record" ADD CONSTRAINT "attendance_record_shift_assignment_id_shift_assignment_id_fk" FOREIGN KEY ("shift_assignment_id") REFERENCES "public"."shift_assignment"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "attendance_record" ADD CONSTRAINT "attendance_record_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_record_shift_assignment_id" ON "attendance_record" ("shift_assignment_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wage_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"worker_id" uuid NOT NULL,
	"vpp_number" text NOT NULL,
	"paid_at" timestamptz DEFAULT now() NOT NULL,
	"amount_cents" integer NOT NULL,
	"hourly_rate_cents_snapshot" integer NOT NULL,
	"worked_minutes_total" integer NOT NULL,
	"reason" text DEFAULT 'Výplata odměny DPC' NOT NULL,
	"recipient_signature_key" text,
	"issuer_signature_key" text,
	"pdf_storage_key" text,
	"note" text,
	"paid_by" uuid,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT "wage_payment_vpp_number_unique" UNIQUE("vpp_number")
);
--> statement-breakpoint
ALTER TABLE "wage_payment" ADD CONSTRAINT "wage_payment_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "wage_payment" ADD CONSTRAINT "wage_payment_paid_by_users_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wage_payment_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wage_payment_id" uuid NOT NULL,
	"attendance_record_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wage_payment_line" ADD CONSTRAINT "wage_payment_line_wage_payment_id_wage_payment_id_fk" FOREIGN KEY ("wage_payment_id") REFERENCES "public"."wage_payment"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "wage_payment_line" ADD CONSTRAINT "wage_payment_line_attendance_record_id_attendance_record_id_fk" FOREIGN KEY ("attendance_record_id") REFERENCES "public"."attendance_record"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "wage_payment_line_attendance_record_id" ON "wage_payment_line" ("attendance_record_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_sequence" (
	"kind" "document_sequence_kind" NOT NULL,
	"year" integer NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "document_sequence_kind_year" ON "document_sequence" ("kind", "year");
