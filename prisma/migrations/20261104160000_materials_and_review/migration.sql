-- CreateEnum
CREATE TYPE "ReviewOutcome" AS ENUM ('AUTO_ACCEPT', 'BADGE', 'QUARANTINE', 'QUEUE', 'AUTO_REJECT');

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "provider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialLink" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewDecision" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "materialUrl" TEXT NOT NULL,
    "title" TEXT,
    "competencyId" TEXT,
    "outcome" "ReviewOutcome" NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "signalsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Material_canonicalUrl_key" ON "Material"("canonicalUrl");

-- CreateIndex
CREATE INDEX "Material_createdAt_idx" ON "Material"("createdAt");

-- CreateIndex
CREATE INDEX "MaterialLink_nodeId_idx" ON "MaterialLink"("nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialLink_materialId_nodeId_key" ON "MaterialLink"("materialId", "nodeId");

-- CreateIndex
CREATE INDEX "ReviewDecision_runId_idx" ON "ReviewDecision"("runId");

-- CreateIndex
CREATE INDEX "ReviewDecision_outcome_createdAt_idx" ON "ReviewDecision"("outcome", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewDecision_materialUrl_idx" ON "ReviewDecision"("materialUrl");

-- AddForeignKey
ALTER TABLE "MaterialLink" ADD CONSTRAINT "MaterialLink_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

