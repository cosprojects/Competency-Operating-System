-- COS-EAR-017: отметки «усвоено» для знаний/навыков и «изучаю» для компетенций.

CREATE TYPE "StudyTarget" AS ENUM ('COMPETENCY', 'KNOWLEDGE', 'SKILL');

CREATE TABLE "StudyMark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" "StudyTarget" NOT NULL,
    "targetId" TEXT NOT NULL,
    "status" "StudyStatusValue" NOT NULL DEFAULT 'NOT_STARTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StudyMark_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudyMark_userId_targetType_targetId_key"
    ON "StudyMark"("userId", "targetType", "targetId");
CREATE INDEX "StudyMark_userId_status_idx" ON "StudyMark"("userId", "status");
CREATE INDEX "StudyMark_userId_updatedAt_idx" ON "StudyMark"("userId", "updatedAt");

ALTER TABLE "StudyMark" ADD CONSTRAINT "StudyMark_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
