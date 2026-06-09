ALTER TABLE "menu_category" ADD COLUMN IF NOT EXISTS "icon_key" text NOT NULL DEFAULT 'star';
--> statement-breakpoint
ALTER TABLE "menu_category" ADD COLUMN IF NOT EXISTS "image_url" text;
--> statement-breakpoint
UPDATE "menu_category" SET "icon_key" = CASE "slug"
  WHEN 'burgers' THEN 'beef'
  WHEN 'hotdogs' THEN 'soup'
  WHEN 'sandwiches' THEN 'sandwich'
  WHEN 'special' THEN 'star'
  WHEN 'sides' THEN 'wheat'
  WHEN 'sweets' THEN 'ice-cream'
  WHEN 'addons' THEN 'plus'
  ELSE 'star'
END
WHERE "icon_key" = 'star' OR "icon_key" IS NULL;
