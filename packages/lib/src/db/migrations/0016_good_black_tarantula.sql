CREATE TABLE "explorer_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" text NOT NULL,
	"brand_name" text NOT NULL,
	"window_days" integer NOT NULL,
	"language" text NOT NULL,
	"model" text,
	"status" "report_status" DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"html" text,
	"narrative" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "explorer_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "explorer_reports" ADD CONSTRAINT "explorer_reports_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "explorer_reports_brand_id_created_at_idx" ON "explorer_reports" USING btree ("brand_id","created_at");