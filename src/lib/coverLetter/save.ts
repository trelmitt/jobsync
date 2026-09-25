import MarkdownIt from "markdown-it";
import prisma from "@/lib/db";
import { APP_CONSTANTS } from "@/lib/constants";
import { buildCoverLetterTitle } from "@/lib/coverLetterTitle";

// html:false escapes raw HTML in the model output before it is ever stored,
// so the saved document is the same shape a hand-written letter produces.
const md = new MarkdownIt({ html: false, linkify: false, breaks: true });

// Saves a generated letter and links it to the job. userId must come from
// the session or a server-side record, never from the client.
export async function saveCoverLetterForJob(userId: string, jobId: string, markdown: string) {
  if (
    !markdown ||
    markdown.trim().length < APP_CONSTANTS.MIN_COVER_LETTER_CHARS
  ) {
    throw new Error("Generated cover letter was too short to save.");
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId, userId },
    include: { JobTitle: true, Company: true },
  });

  if (!job) {
    throw new Error("Job not found");
  }

  const profile = await prisma.profile.findFirst({
    where: { userId },
  });

  if (!profile) {
    throw new Error("No profile found for this user.");
  }

  const existing = await prisma.coverLetter.findMany({
    where: { profile: { userId } },
    select: { title: true },
  });

  const title = buildCoverLetterTitle(
    job.JobTitle?.label ?? "Cover Letter",
    job.Company?.label ?? "",
    existing.map((letter) => letter.title)
  );

  const content = md.render(markdown);

  const created = await prisma.$transaction(async (tx) => {
    const letter = await tx.coverLetter.create({
      data: { profileId: profile.id, title, content },
    });

    await tx.job.update({
      where: { id: jobId, userId },
      data: { coverLetterId: letter.id },
    });

    return letter;
  });
  return created;
}
