CREATE TABLE "attachments" (
	"id" bigint PRIMARY KEY NOT NULL,
	"message_id" bigint NOT NULL,
	"filename" varchar(255) NOT NULL,
	"content_type" varchar(127) NOT NULL,
	"size" integer NOT NULL,
	"url" text NOT NULL,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_emojis" (
	"id" bigint PRIMARY KEY NOT NULL,
	"server_id" bigint NOT NULL,
	"name" varchar(32) NOT NULL,
	"image_url" text NOT NULL,
	"creator_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "embeds" (
	"id" bigint PRIMARY KEY NOT NULL,
	"message_id" bigint NOT NULL,
	"url" text NOT NULL,
	"title" varchar(256),
	"description" varchar(4096),
	"thumbnail_url" text,
	"site_name" varchar(256),
	"color" varchar(7),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_emojis" ADD CONSTRAINT "custom_emojis_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_emojis" ADD CONSTRAINT "custom_emojis_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "embeds" ADD CONSTRAINT "embeds_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachments_message_id_idx" ON "attachments" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_emojis_server_name_idx" ON "custom_emojis" USING btree ("server_id","name");--> statement-breakpoint
CREATE INDEX "custom_emojis_server_id_idx" ON "custom_emojis" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "embeds_message_id_idx" ON "embeds" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "embeds_message_url_idx" ON "embeds" USING btree ("message_id","url");