CREATE TABLE IF NOT EXISTS "inventory_category" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_item" ADD COLUMN IF NOT EXISTS "category_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_category_id_inventory_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."inventory_category"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
INSERT INTO "inventory_category" ("name", "sort_order")
SELECT v.name, v.sort_order
FROM (VALUES
  ('Maso / protein', 10),
  ('Pečivo / tortilly', 20),
  ('Zelenina / saláty', 30),
  ('Omáčky / dressingy', 40),
  ('Sýry / mléčné', 50),
  ('Nápoje', 60),
  ('Balení / spotřební', 70),
  ('Ostatní', 100)
) AS v(name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM "inventory_category" LIMIT 1);
--> statement-breakpoint
UPDATE "inventory_item" i
SET "category_id" = c.id
FROM "inventory_category" c
WHERE i."category_id" IS NULL
  AND c."name" = 'Ostatní';
