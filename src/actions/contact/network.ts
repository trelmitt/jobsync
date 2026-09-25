"use server";
import prisma from "@/lib/db";
import { handleError } from "@/lib/utils";
import { resolveCompany } from "@/lib/jobs/resolve";
import { parseLinkedInConnections } from "@/lib/contacts/linkedinCsv";
import { requireUser } from "../shared";

// Re-importing a newer export only adds people not already there (matched on
// profile URL); existing contacts, and anything edited on them, are left alone.
export const importLinkedInConnections = async (
  csv: string,
): Promise<any | undefined> => {
  try {
    const user = await requireUser();
    const rows = parseLinkedInConnections(csv);
    if (rows.length === 0) {
      throw new Error("No connections found. Upload LinkedIn's Connections.csv.");
    }

    const known = await prisma.contact.findMany({
      where: { createdBy: user.id, linkedinUrl: { not: null } },
      select: { linkedinUrl: true },
    });
    const seen = new Set(known.map((c) => c.linkedinUrl));
    const fresh = rows.filter((row) => {
      if (row.url && seen.has(row.url)) return false;
      if (row.url) seen.add(row.url);
      return true;
    });

    // Same canonical company rows the jobs use, so "who do I know at X" is
    // an id match rather than a fuzzy name match.
    const companyIds = new Map<string, string>();
    for (const company of new Set(fresh.map((r) => r.company).filter((c): c is string => !!c))) {
      companyIds.set(company, (await resolveCompany(company, user.id)).id);
    }

    const { count } = await prisma.contact.createMany({
      data: fresh.map((row) => ({
        name: row.name,
        title: row.position,
        email: row.email,
        linkedinUrl: row.url,
        companyId: row.company ? companyIds.get(row.company) : null,
        relationship: "LinkedIn connection",
        createdBy: user.id,
      })),
    });
    return { success: true, data: { created: count, skipped: rows.length - count } };
  } catch (error) {
    return handleError(error, "Failed to import connections.");
  }
};

// People who work (or used to work) at the job's company and aren't linked
// to this job yet.
export const getNetworkForJob = async (
  jobId: string,
): Promise<any | undefined> => {
  try {
    const user = await requireUser();
    const job = await prisma.job.findFirst({
      where: { id: jobId, userId: user.id },
      select: { companyId: true },
    });
    if (!job?.companyId) return [];
    return await prisma.contact.findMany({
      where: {
        createdBy: user.id,
        OR: [{ companyId: job.companyId }, { workedAtCompanyId: job.companyId }],
        jobLinks: { none: { jobId } },
      },
      select: { id: true, name: true, title: true, email: true, linkedinUrl: true, companyId: true },
      orderBy: { name: "asc" },
      take: 25,
    });
  } catch (error) {
    return handleError(error, "Failed to load your network.");
  }
};
