CREATE TABLE "words" (
	"id" serial PRIMARY KEY NOT NULL,
	"russian" text NOT NULL,
	"polish" text,
	"german" text,
	"english" text,
	"mnemonic" text,
	"frequency_rank" integer,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"hint_count" integer DEFAULT 0 NOT NULL,
	"next_review_at" timestamp,
	"next_review_session" integer,
	"review_interval" integer DEFAULT 0 NOT NULL,
	"word_type" text,
	"word_group" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"consecutive_correct" integer DEFAULT 0 NOT NULL,
	"graduated_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"error_repeat_after" integer DEFAULT 5 NOT NULL,
	"review_intervals" text DEFAULT '3,5,9,13' NOT NULL,
	"session_size" integer DEFAULT 20 NOT NULL,
	"review_session_size" integer DEFAULT 20 NOT NULL,
	"total_sessions" integer DEFAULT 0 NOT NULL,
	"trace_session_size" integer DEFAULT 10 NOT NULL,
	"trace_new" integer DEFAULT 3 NOT NULL,
	"trace_review" integer DEFAULT 2 NOT NULL,
	"trace_error" integer DEFAULT 5 NOT NULL,
	"trace_error_review" integer DEFAULT 5 NOT NULL,
	"graduation_threshold" integer DEFAULT 7 NOT NULL,
	"app_name" text DEFAULT 'Полиглот' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "word_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"word_id" integer NOT NULL,
	"event_type" text NOT NULL,
	"session_number" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "word_events" ADD CONSTRAINT "word_events_word_id_words_id_fk" FOREIGN KEY ("word_id") REFERENCES "public"."words"("id") ON DELETE cascade ON UPDATE no action;