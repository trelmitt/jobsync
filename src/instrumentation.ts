export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // SQLite busy_timeout is per-connection and Prisma has no DATABASE_URL
    // param for it, so it's set once here at startup rather than as a
    // one-off PRAGMA. Lets a writer wait instead of throwing SQLITE_BUSY
    // when a script or the app itself holds a concurrent write lock.
    const db = (await import("@/lib/db")).default;
    // PRAGMA busy_timeout returns the set value as a row, which Prisma's
    // SQLite driver rejects from $executeRawUnsafe ("Execute returned
    // results, which is not allowed in SQLite") — needs $queryRawUnsafe.
    await db.$queryRawUnsafe("PRAGMA busy_timeout = 5000;");

    const { syncSchedulerState } = await import("@/lib/scheduler");
    await syncSchedulerState();
  }
}
