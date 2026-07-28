ALTER TABLE "attachments" ADD COLUMN "channel_id" bigint;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "uploader_id" bigint;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "storage_key" text;--> statement-breakpoint
ALTER TABLE "custom_emojis" ADD COLUMN "storage_key" text;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachments_channel_id_idx" ON "attachments" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "attachments_uploader_id_idx" ON "attachments" USING btree ("uploader_id");