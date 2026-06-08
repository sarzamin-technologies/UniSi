ALTER TABLE "audit_event" ADD COLUMN "seq" bigserial NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_event_submission_seq_idx" ON "audit_event" USING btree ("submission_id","seq");