-- MVP «План»: снимки самооценки матрицы компетенций.

CREATE TABLE "MatrixRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "professionSlug" TEXT NOT NULL,
    "gradeCode" TEXT NOT NULL,
    "levelsJson" TEXT NOT NULL,
    "contentVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MatrixRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MatrixRun_userId_createdAt_idx" ON "MatrixRun"("userId", "createdAt");
CREATE INDEX "MatrixRun_professionSlug_gradeCode_idx" ON "MatrixRun"("professionSlug", "gradeCode");

ALTER TABLE "MatrixRun" ADD CONSTRAINT "MatrixRun_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
