-- CreateTable
CREATE TABLE "ApplySession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "applicationUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "blockedReason" TEXT,
    "errorMessage" TEXT,
    "fieldsFilled" TEXT,
    "screenshotPaths" TEXT,
    "startedAt" DATETIME,
    "filledAt" DATETIME,
    "submittedAt" DATETIME,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApplySession_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApplySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ApplySession_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ApplySession_userId_status_idx" ON "ApplySession"("userId", "status");

-- CreateIndex
CREATE INDEX "ApplySession_jobId_idx" ON "ApplySession"("jobId");

-- CreateIndex
CREATE INDEX "ApplySession_status_createdAt_idx" ON "ApplySession"("status", "createdAt");
