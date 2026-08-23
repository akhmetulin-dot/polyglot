CREATE TABLE "mindmap_nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"map_id" text NOT NULL,
	"parent_id" text,
	"text" text DEFAULT '' NOT NULL,
	"order" real DEFAULT 0 NOT NULL,
	"collapsed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mindmaps" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mindmap_nodes" ADD CONSTRAINT "mindmap_nodes_map_id_mindmaps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."mindmaps"("id") ON DELETE cascade ON UPDATE no action;