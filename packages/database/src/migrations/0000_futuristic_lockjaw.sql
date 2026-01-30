CREATE TABLE "checkpoint" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"source_message_id" uuid NOT NULL,
	"parent_checkpoint_id" uuid,
	"storyboard_json" jsonb NOT NULL,
	"script_json" jsonb NOT NULL,
	"brand_kit_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_key" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"project_id" uuid NOT NULL,
	"operation" text NOT NULL,
	"key" text NOT NULL,
	"result_ref" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_key_user_id_operation_key_unique" UNIQUE("user_id","operation","key")
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"role" text NOT NULL,
	"type" text NOT NULL,
	"content_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"active_checkpoint_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "render_job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"source_checkpoint_id" uuid NOT NULL,
	"source_message_id" uuid NOT NULL,
	"format" text NOT NULL,
	"status" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"output_s3_key" text,
	"cancel_requested" boolean DEFAULT false NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checkpoint" ADD CONSTRAINT "checkpoint_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkpoint" ADD CONSTRAINT "checkpoint_source_message_id_message_id_fk" FOREIGN KEY ("source_message_id") REFERENCES "public"."message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_key" ADD CONSTRAINT "idempotency_key_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "render_job" ADD CONSTRAINT "render_job_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "render_job" ADD CONSTRAINT "render_job_source_checkpoint_id_checkpoint_id_fk" FOREIGN KEY ("source_checkpoint_id") REFERENCES "public"."checkpoint"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "render_job" ADD CONSTRAINT "render_job_source_message_id_message_id_fk" FOREIGN KEY ("source_message_id") REFERENCES "public"."message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checkpoint_project_id_idx" ON "checkpoint" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "checkpoint_source_message_id_idx" ON "checkpoint" USING btree ("source_message_id");--> statement-breakpoint
CREATE INDEX "idempotency_key_user_id_idx" ON "idempotency_key" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "message_project_id_idx" ON "message" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "message_created_at_idx" ON "message" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "project_user_id_idx" ON "project" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_active_checkpoint_id_idx" ON "project" USING btree ("active_checkpoint_id");--> statement-breakpoint
CREATE INDEX "render_job_project_id_idx" ON "render_job" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "render_job_status_idx" ON "render_job" USING btree ("status");--> statement-breakpoint
CREATE INDEX "render_job_created_at_idx" ON "render_job" USING btree ("created_at");