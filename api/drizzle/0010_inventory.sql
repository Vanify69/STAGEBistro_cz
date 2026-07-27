DO $$ BEGIN
  ALTER TYPE "purchase_order_status" ADD VALUE IF NOT EXISTS 'partial';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TYPE "purchase_order_status" ADD VALUE IF NOT EXISTS 'received';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "stock_movement_kind" AS ENUM ('receive', 'inventory_adjust', 'waste', 'sale');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "stock_movement_source" AS ENUM ('manual', 'receive', 'inventory', 'pos');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_item" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "unit" text DEFAULT 'ks' NOT NULL,
  "qty_on_hand" numeric(18, 6) DEFAULT '0' NOT NULL,
  "min_qty" numeric(18, 6),
  "active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_movement" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "inventory_item_id" uuid NOT NULL,
  "kind" "stock_movement_kind" NOT NULL,
  "quantity_delta" numeric(18, 6) NOT NULL,
  "source" "stock_movement_source" NOT NULL,
  "ref_type" text,
  "ref_id" text,
  "note" text,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "goods_receipt" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "received_by" uuid,
  "note" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "goods_receipt_line" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "receipt_id" uuid NOT NULL,
  "order_line_id" uuid NOT NULL,
  "quantity_received" numeric(18, 6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "menu_recipe_line" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "menu_item_id" uuid NOT NULL,
  "inventory_item_id" uuid NOT NULL,
  "quantity_per_portion" numeric(18, 6) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "supplier_item" ADD COLUMN IF NOT EXISTS "inventory_item_id" uuid;
--> statement-breakpoint
ALTER TABLE "menu_item" ADD COLUMN IF NOT EXISTS "storyous_product_id" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "menu_recipe_line_menu_inventory" ON "menu_recipe_line" ("menu_item_id","inventory_item_id");
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_inventory_item_id_inventory_item_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_item"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "goods_receipt" ADD CONSTRAINT "goods_receipt_order_id_purchase_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."purchase_order"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "goods_receipt" ADD CONSTRAINT "goods_receipt_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "goods_receipt_line" ADD CONSTRAINT "goods_receipt_line_receipt_id_goods_receipt_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."goods_receipt"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "goods_receipt_line" ADD CONSTRAINT "goods_receipt_line_order_line_id_purchase_order_line_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."purchase_order_line"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "menu_recipe_line" ADD CONSTRAINT "menu_recipe_line_menu_item_id_menu_item_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_item"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "menu_recipe_line" ADD CONSTRAINT "menu_recipe_line_inventory_item_id_inventory_item_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_item"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "supplier_item" ADD CONSTRAINT "supplier_item_inventory_item_id_inventory_item_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_item"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
