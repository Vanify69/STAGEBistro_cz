DO $$ BEGIN
  CREATE TYPE "purchase_order_status" AS ENUM ('draft', 'sent', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "supplier" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text,
  "note" text,
  "active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "supplier_item" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "supplier_id" uuid NOT NULL,
  "name" text NOT NULL,
  "unit" text DEFAULT 'ks' NOT NULL,
  "default_qty" text,
  "note" text,
  "active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_email_template" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text DEFAULT 'Výchozí' NOT NULL,
  "subject_template" text NOT NULL,
  "body_template" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_order" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "supplier_id" uuid NOT NULL,
  "status" "purchase_order_status" DEFAULT 'draft' NOT NULL,
  "note" text,
  "email_subject" text,
  "email_body" text,
  "error_message" text,
  "sent_at" timestamp with time zone,
  "sent_by" uuid,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_order_line" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "supplier_item_id" uuid,
  "name_snapshot" text NOT NULL,
  "unit_snapshot" text NOT NULL,
  "quantity" text NOT NULL,
  "line_note" text
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "supplier_item" ADD CONSTRAINT "supplier_item_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "purchase_order_line" ADD CONSTRAINT "purchase_order_line_order_id_purchase_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."purchase_order"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "purchase_order_line" ADD CONSTRAINT "purchase_order_line_supplier_item_id_supplier_item_id_fk" FOREIGN KEY ("supplier_item_id") REFERENCES "public"."supplier_item"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
INSERT INTO "order_email_template" ("name", "subject_template", "body_template")
SELECT
  'Výchozí',
  'Objednávka STAGE Bistro — {{datum}}',
  E'Dobrý den,\n\nprosíme o závoz pro Stage Bistro:\n\n{{polozky}}\n\n{{poznamka}}\n\nDěkujeme\n{{odeslal}}'
WHERE NOT EXISTS (SELECT 1 FROM "order_email_template" LIMIT 1);
