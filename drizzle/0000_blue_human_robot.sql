CREATE TYPE "public"."platform" AS ENUM('youtube', 'tiktok', 'facebook', 'instagram');--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" "platform" NOT NULL,
	"external_id" text NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"caption" text,
	"thumbnail_url" text,
	"published_at" timestamp with time zone NOT NULL,
	"duration_seconds" bigint,
	"is_reel" text DEFAULT 'true',
	"raw" jsonb,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_fetched_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"views" bigint,
	"likes" bigint,
	"comments" bigint,
	"shares" bigint,
	"saves" bigint,
	"reach" bigint,
	"impressions" bigint,
	"watch_time_seconds" bigint,
	"avg_view_duration_seconds" bigint,
	"raw" jsonb
);
--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_platform_external" ON "posts" USING btree ("platform","external_id");--> statement-breakpoint
CREATE INDEX "posts_published_idx" ON "posts" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "snapshots_post_captured_idx" ON "snapshots" USING btree ("post_id","captured_at");