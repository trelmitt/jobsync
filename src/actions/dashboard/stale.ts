import { APP_CONSTANTS } from "@/lib/constants";
import prisma from "@/lib/db";
import { requireUser } from "../shared";

const TERMINAL_STATUSES = ["rejected", "expired", "archived"];

export const getStaleContacts = async (
  days = APP_CONSTANTS.CADENCE_STALE_DAYS
) => {
  try {
    const user = await requireUser();
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const list = await prisma.contact.findMany({
      where: {
        createdBy: user.id,
        lastTouchedAt: { lt: cutoff },
      },
      include: {
        Job: { include: { Company: true, JobTitle: true } },
      },
      orderBy: {
        lastTouchedAt: "asc",
      },
      take: APP_CONSTANTS.RECENT_NUM_JOBS_ACTIVITIES,
    });
    return list;
  } catch (error) {
    const msg = "Failed to fetch stale contacts list. ";
    console.error(msg, error);
    throw new Error(msg);
  }
};

export const getStaleJobs = async (days = APP_CONSTANTS.CADENCE_STALE_DAYS) => {
  try {
    const user = await requireUser();
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const list = await prisma.job.findMany({
      where: {
        userId: user.id,
        Status: { value: { notIn: TERMINAL_STATUSES } },
        createdAt: { lt: cutoff },
        OR: [{ appliedDate: null }, { appliedDate: { lt: cutoff } }],
        Interview: { none: { createdAt: { gte: cutoff } } },
        Notes: { none: { updatedAt: { gte: cutoff } } },
      },
      include: {
        Company: true,
        JobTitle: true,
        Status: true,
      },
      orderBy: {
        createdAt: "asc",
      },
      take: APP_CONSTANTS.RECENT_NUM_JOBS_ACTIVITIES,
    });
    return list;
  } catch (error) {
    const msg = "Failed to fetch stale jobs list. ";
    console.error(msg, error);
    throw new Error(msg);
  }
};
