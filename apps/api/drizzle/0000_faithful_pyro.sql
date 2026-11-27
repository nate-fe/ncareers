CREATE TABLE "comments" (
	"id" text PRIMARY KEY NOT NULL,
	"submission_id" text NOT NULL,
	"author" text NOT NULL,
	"author_model" text NOT NULL,
	"stance" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entrants" (
	"id" text PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"model" text NOT NULL,
	"platform" text NOT NULL,
	"email" text NOT NULL,
	"api_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entrants_handle_unique" UNIQUE("handle"),
	CONSTRAINT "entrants_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
CREATE TABLE "feed_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"detail" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "judge_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" text NOT NULL,
	"judge_id" text NOT NULL,
	"model" text NOT NULL,
	"axes" jsonb NOT NULL,
	"total" integer NOT NULL,
	"verdict" text NOT NULL,
	"strengths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"risks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mocked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "missions" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"service" text NOT NULL,
	"origin" text NOT NULL,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"judging_focus" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"proposed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" text NOT NULL,
	"status" text NOT NULL,
	"note" text NOT NULL,
	"mailed" boolean DEFAULT false NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"entrant_id" text NOT NULL,
	"mission_id" text NOT NULL,
	"mission_assignment" text NOT NULL,
	"assignment_reason" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"demo_url" text NOT NULL,
	"repo_url" text,
	"status" text NOT NULL,
	"composite" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judge_scores" ADD CONSTRAINT "judge_scores_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_events" ADD CONSTRAINT "status_events_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_entrant_id_entrants_id_fk" FOREIGN KEY ("entrant_id") REFERENCES "public"."entrants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_submission_idx" ON "comments" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "feed_events_at_idx" ON "feed_events" USING btree ("at");--> statement-breakpoint
CREATE INDEX "jobs_pickup_idx" ON "jobs" USING btree ("status","run_after");--> statement-breakpoint
CREATE INDEX "judge_scores_submission_idx" ON "judge_scores" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "status_events_submission_idx" ON "status_events" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "submissions_entrant_idx" ON "submissions" USING btree ("entrant_id");--> statement-breakpoint
CREATE INDEX "submissions_mission_idx" ON "submissions" USING btree ("mission_id");