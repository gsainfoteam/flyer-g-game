CREATE TYPE "public"."shuffleboard_venue" AS ENUM('old', 'new');--> statement-breakpoint
CREATE TABLE "shuffleboard_match_players" (
	"match_id" uuid NOT NULL,
	"seat" varchar(1) NOT NULL,
	"nickname" varchar(10) NOT NULL,
	"score" integer NOT NULL,
	"claim_hash" varchar(64),
	"user_id" uuid,
	"claimed_at" timestamp with time zone,
	CONSTRAINT "shuffleboard_match_players_match_id_seat_pk" PRIMARY KEY("match_id","seat"),
	CONSTRAINT "shuffleboard_match_players_seat" CHECK ("shuffleboard_match_players"."seat" in ('A', 'B')),
	CONSTRAINT "shuffleboard_match_players_score" CHECK ("shuffleboard_match_players"."score" >= 0)
);
--> statement-breakpoint
CREATE TABLE "shuffleboard_matches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"device_id" uuid,
	"venue" "shuffleboard_venue",
	"top_score" integer NOT NULL,
	"winner" varchar(4) NOT NULL,
	"shots" jsonb NOT NULL,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shuffleboard_matches_top_score_range" CHECK ("shuffleboard_matches"."top_score" >= 0),
	CONSTRAINT "shuffleboard_matches_winner" CHECK ("shuffleboard_matches"."winner" in ('A', 'B', 'DRAW'))
);
--> statement-breakpoint
CREATE TABLE "shuffleboard_rooms" (
	"device_id" uuid PRIMARY KEY NOT NULL,
	"venue" "shuffleboard_venue" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shuffleboard_survey_responses" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"answers" jsonb NOT NULL,
	"others" jsonb NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shuffleboard_match_players" ADD CONSTRAINT "shuffleboard_match_players_match_id_shuffleboard_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."shuffleboard_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shuffleboard_match_players" ADD CONSTRAINT "shuffleboard_match_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shuffleboard_matches" ADD CONSTRAINT "shuffleboard_matches_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shuffleboard_rooms" ADD CONSTRAINT "shuffleboard_rooms_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shuffleboard_survey_responses" ADD CONSTRAINT "shuffleboard_survey_responses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shuffleboard_match_players_match_user_uq" ON "shuffleboard_match_players" USING btree ("match_id","user_id") WHERE "shuffleboard_match_players"."user_id" is not null;--> statement-breakpoint
CREATE INDEX "shuffleboard_match_players_user_idx" ON "shuffleboard_match_players" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shuffleboard_matches_top_score_idx" ON "shuffleboard_matches" USING btree ("top_score" DESC NULLS LAST,"reported_at");