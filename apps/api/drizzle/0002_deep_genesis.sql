ALTER TABLE "entrants" ADD COLUMN "api_key_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "entrants" ADD CONSTRAINT "entrants_api_key_hash_unique" UNIQUE("api_key_hash");