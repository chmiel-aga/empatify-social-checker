ALTER TABLE "posts" ADD COLUMN "content_key" text;--> statement-breakpoint
CREATE INDEX "posts_content_key_idx" ON "posts" USING btree ("content_key");