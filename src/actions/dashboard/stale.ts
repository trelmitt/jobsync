import { APP_CONSTANTS } from "@/lib/constants";
import prisma from "@/lib/db";
import { dueFollowUp } from "@/lib/followUp";
import { requireUser } from "../shared";

const TERMINAL_STATUSES = ["rejected", "expired", "archived"];
// Past "applied", the cadence is the interview loop's, not ours.
const PAST_APPLIED = ["interview", "offer", "offer-accepted", "offer-declined"];

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
        // Contact reaches Job only through JobContact now; the dashboard card
        // just needs one job to link to, so the most recently linked wins.
        jobLinks: {
          take: 1,
          orderBy: { createdAt: "desc" },
          include: { Job: { include: { Company: true, JobTitle: true } } },
        },
      },
      orderBy: {
        lastTouchedAt: "asc",
      },
      take: APP_CONSTANTS.RECENT_NUM_JOBS_ACTIVITIES,
    });
    return list.map(({ jobLinks, ...contact }) => ({
      ...contact,
      Job: jobLinks[0]?.Job ?? null,
    }));
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

export const getFollowUpsDue = async () => {
  try {
    const user = await requireUser();
    // ponytail: loads every open application and filters in JS; move the
    // step math into SQL if this ever runs over thousands of applied jobs.
    const jobs = await prisma.job.findMany({
      where: {
        userId: user.id,
        applied: true,
        appliedDate: { not: null },
        Status: { value: { notIn: [...TERMINAL_STATUSES, ...PAST_APPLIED] } },
        Interview: { none: {} },
      },
      include: {
        Company: true,
        JobTitle: true,
        // createdAt, not updatedAt: editing an old note isn't a follow-up.
        Notes: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { appliedDate: "asc" },
    });
    const now = new Date();
    return jobs
      .flatMap(({ Notes, ...job }) => {
        const step = dueFollowUp(job.appliedDate!, Notes[0]?.createdAt ?? null, now);
        return step === null ? [] : [{ ...job, step }];
      })
      .slice(0, APP_CONSTANTS.RECENT_NUM_JOBS_ACTIVITIES);
  } catch (error) {
    const msg = "Failed to fetch follow-ups due. ";
    console.error(msg, error);
    throw new Error(msg);
  }
};
