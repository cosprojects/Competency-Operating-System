-- Подтверждение и блокировка учебных материалов пользователями (COS-REL-009)
CREATE TYPE "SourceReviewAction" AS ENUM ('CONFIRM', 'BLOCK');
CREATE TYPE "SourceReviewReason" AS ENUM ('OFF_TOPIC', 'UNRELIABLE', 'BROKEN', 'LOCKED', 'OTHER');

CREATE TABLE "SourceReview" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'competency',
    "action" "SourceReviewAction" NOT NULL,
    "reason" "SourceReviewReason",
    "comment" TEXT,
    "userId" TEXT NOT NULL,
    "actorKey" TEXT NOT NULL,
    "pagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SourceReview_sourceId_competencyId_actorKey_key" ON "SourceReview"("sourceId", "competencyId", "actorKey");
CREATE INDEX "SourceReview_sourceId_competencyId_action_idx" ON "SourceReview"("sourceId", "competencyId", "action");
CREATE INDEX "SourceReview_createdAt_idx" ON "SourceReview"("createdAt");

ALTER TABLE "SourceReview" ADD CONSTRAINT "SourceReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
