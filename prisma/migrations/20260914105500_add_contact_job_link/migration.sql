-- Plain ADD COLUMN (not a table redefinition) so this touches only Contact.
-- Contact has 0 rows in production today, but scoping this tightly avoids
-- any interaction with Note's pre-existing companyId/nullable-jobId drift
-- (a separate, already-applied "add_company_notes" migration not reflected
-- in schema.prisma) -- out of scope for this change, left untouched.
ALTER TABLE "Contact" ADD COLUMN "jobId" TEXT REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Contact" ADD COLUMN "lastTouchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Contact_jobId_idx" ON "Contact"("jobId");
