-- Add consent version to login tokens
ALTER TABLE "LoginToken" ADD COLUMN "consentVersion" TEXT;

-- Prevent duplicate consent records per user/kind/version
CREATE UNIQUE INDEX "ConsentRecord_userId_kind_version_key" ON "ConsentRecord"("userId", "kind", "version");
