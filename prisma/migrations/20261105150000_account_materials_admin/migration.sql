-- COS-EAR-013/014: аккаунт (смена email), просмотры материалов, решения владельца, audit.

-- LoginToken: назначение токена и новый адрес для смены email
ALTER TABLE "LoginToken" ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'login';
ALTER TABLE "LoginToken" ADD COLUMN "newEmail" TEXT;

-- Решение владельца по материалу
CREATE TYPE "MaterialDecisionAction" AS ENUM ('APPROVE', 'BLOCK');

-- Просмотры материалов
CREATE TABLE "SourceView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "firstViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SourceView_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SourceView_userId_sourceId_key" ON "SourceView"("userId", "sourceId");
CREATE INDEX "SourceView_sourceId_idx" ON "SourceView"("sourceId");
CREATE INDEX "SourceView_userId_lastViewedAt_idx" ON "SourceView"("userId", "lastViewedAt");
ALTER TABLE "SourceView" ADD CONSTRAINT "SourceView_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Финальное решение владельца
CREATE TABLE "MaterialDecision" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "action" "MaterialDecisionAction" NOT NULL,
    "reason" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "MaterialDecision_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MaterialDecision_sourceId_createdAt_idx" ON "MaterialDecision"("sourceId", "createdAt");
CREATE INDEX "MaterialDecision_action_createdAt_idx" ON "MaterialDecision"("action", "createdAt");
ALTER TABLE "MaterialDecision" ADD CONSTRAINT "MaterialDecision_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Журнал админ-действий
CREATE TABLE "AdminAudit" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminAudit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdminAudit_action_createdAt_idx" ON "AdminAudit"("action", "createdAt");
CREATE INDEX "AdminAudit_actorId_createdAt_idx" ON "AdminAudit"("actorId", "createdAt");
