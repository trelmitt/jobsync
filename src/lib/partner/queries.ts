import "server-only";
import prisma from "@/lib/db";

// Curated, read-only data for the partner dashboard. The partner is not a User,
// so these resolve the single owner (JobSync is single-tenant in practice) and
// return ONLY what the owner chose to surface: aggregate momentum (numbers, no
// titles) always; individual job cards only when sharedWithPartner is true.

export async function getOwnerId(): Promise<string | null> {
  const u = await prisma.user.findFirst({
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return u?.id ?? null;
}

export interface PartnerMomentum {
  totalTracked: number;
  addedThisWeek: number;
  companies: number;
  roles: number;
}

export async function getPartnerMomentum(): Promise<PartnerMomentum> {
  const uid = await getOwnerId();
  if (!uid) return { totalTracked: 0, addedThisWeek: 0, companies: 0, roles: 0 };
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [totalTracked, addedThisWeek, companies, roles] = await Promise.all([
    prisma.job.count({ where: { userId: uid } }),
    prisma.job.count({ where: { userId: uid, createdAt: { gte: weekAgo } } }),
    prisma.job.findMany({ where: { userId: uid }, distinct: ["companyId"], select: { companyId: true } }).then((r) => r.length),
    prisma.job.findMany({ where: { userId: uid }, distinct: ["jobTitleId"], select: { jobTitleId: true } }).then((r) => r.length),
  ]);
  return { totalTracked, addedThisWeek, companies, roles };
}

export async function getSharedJobs() {
  const uid = await getOwnerId();
  if (!uid) return [];
  return prisma.job.findMany({
    where: { userId: uid, sharedWithPartner: true },
    select: {
      id: true,
      jobUrl: true,
      createdAt: true,
      appliedDate: true,
      Company: { select: { label: true } },
      JobTitle: { select: { label: true } },
      Status: { select: { label: true, value: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getVentures() {
  return prisma.venture.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function getPartnerSuggestions() {
  const uid = await getOwnerId();
  if (!uid) return [];
  return prisma.suggestion.findMany({
    where: { userId: uid },
    select: {
      id: true,
      url: true,
      whyMe: true,
      status: true,
      replyNote: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 25,
  });
}
