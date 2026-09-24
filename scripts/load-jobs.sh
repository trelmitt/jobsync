#!/usr/bin/env bash
# Bulk-add hand-picked jobs from a JSON file, inside the container (only the
# container ever opens dev.db — see db-shell.sh). Mirrors createJobFromNames:
# canonical find-or-create for Company/JobTitle/Location/JobSource/Tag, skips
# duplicates by jobUrl or same company+title.
#
# Usage: ./scripts/load-jobs.sh jobs.json
#   jobs.json: [{company, title, url, location?, salary?, description, tags?[]}]
set -euo pipefail
[ $# -eq 1 ] || { echo "Usage: $0 jobs.json" >&2; exit 1; }

docker exec -i jobsync_app node -e '
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const jobs = JSON.parse(require("fs").readFileSync(0, "utf8"));
const canon = (s, co) => {
  let v = s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/,/g, " ").replace(/\s+/g, " ").trim();
  if (co) { let p; do { p = v; v = v.replace(/\s(?:inc|llc|ltd|limited|corp|corporation|co|company|gmbh|plc)\.?$/, "").trim(); } while (v !== p && v); }
  return v;
};
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
async function resolve(model, label, userId, co) {
  const value = canon(label.trim(), co);
  const hit = await prisma[model].findUnique({ where: { value_createdBy: { value, createdBy: userId } } });
  return hit ?? prisma[model].create({ data: { label: label.trim(), value, createdBy: userId } });
}
(async () => {
  const user = await prisma.user.findFirstOrThrow();
  const status = await prisma.jobStatus.findUniqueOrThrow({ where: { value: "new" } });
  const source = await resolve("jobSource", "Claude research", user.id);
  for (const j of jobs) {
    const [company, title] = await Promise.all([
      resolve("company", j.company, user.id, true), resolve("jobTitle", j.title, user.id)]);
    const dup = await prisma.job.findFirst({ where: { userId: user.id,
      OR: [{ jobUrl: j.url }, { companyId: company.id, jobTitleId: title.id }] } });
    if (dup) { console.log("SKIP dup:", j.company, "|", j.title); continue; }
    const location = j.location ? await resolve("location", j.location, user.id) : null;
    const tags = await Promise.all((j.tags ?? []).map((t) => resolve("tag", t, user.id)));
    await prisma.job.create({ data: {
      userId: user.id, companyId: company.id, jobTitleId: title.id, statusId: status.id,
      locationId: location?.id ?? null, jobSourceId: source.id, jobUrl: j.url,
      salaryRange: j.salary ?? null, jobType: "FT", workplaceType: "REMOTE",
      description: "<p>" + esc(j.description) + "</p>", createdVia: "claude-code",
      createdAt: new Date(),
      tags: { connect: tags.map((t) => ({ id: t.id })) } } });
    console.log("ADDED:", j.company, "|", j.title);
  }
})().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
' < "$1"
