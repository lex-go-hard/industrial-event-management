ALTER TABLE "EventParticipation"
  ADD COLUMN IF NOT EXISTS "prizePlace" INTEGER,
  ADD COLUMN IF NOT EXISTS "ratingPoints" INTEGER;

CREATE INDEX IF NOT EXISTS "EventParticipation_eventId_prizePlace_idx"
  ON "EventParticipation" ("eventId", "prizePlace");

