-- Prevents two ApplySession rows from being "queued"/"filling" for the same
-- job at once — mirrors AutomationRun_automationId_active_key
-- (see 20260710000001_automation_run_single_active) for the same reason:
-- SQLite doesn't serialize concurrent write transactions the way a
-- SELECT-then-INSERT guard would assume.
CREATE UNIQUE INDEX "ApplySession_jobId_active_key"
ON "ApplySession"("jobId")
WHERE "status" IN ('queued', 'filling');
