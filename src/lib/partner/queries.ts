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
  applicationsThisWeek: number;
  activeApplications: number;
  interviewing: number;
  offers: number;
}

export async function getPartnerMomentum(): Promise<PartnerMomentum> {
  const uid = await getOwnerId();
  if (!uid) return { applicationsThisWeek: 0, activeApplications: 0, interviewing: 0, offers: 0 };
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [applicationsThisWeek, activeApplications, interviewing, offers] = await Promise.all([
    prisma.job.count({ where: { userId: uid, appliedDate: { gte: weekAgo } } }),
    prisma.job.count({ where: { userId: uid, Status: { value: { in: ["applied", "interview"] } } } }),
    prisma.job.count({ where: { userId: uid, Status: { value: "interview" } } }),
    prisma.job.count({ where: { userId: uid, Status: { value: "offer" } } }),
  ]);
  return { applicationsThisWeek, activeApplications, interviewing, offers };
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
