import "server-only";
import fs from "fs/promises";
import { generateText } from "ai";
import db from "@/lib/db";
import { getModel } from "@/lib/ai";
import { getUserAiSettings } from "@/lib/scraper/automation-run/aiSettings";
import { removeResumeFile, saveResumeUpload } from "@/lib/resumeFiles";
import {
  applyOrders,
  loadDocumentXml,
  readStructure,
  ordersFromScores,
  writeDocumentXml,
} from "./docx";
import { TAILOR_SYSTEM_PROMPT, buildTailorPrompt, parseTailorJson } from "./prompt";

export interface TailorResult {
  resumeId: string;
  groupsReordered: number;
  rejected: string[];
}

// The job's own resume, else its automation's, else the user's default.
export async function baseResumeIdFor(jobId: string, userId: string): Promise<string | null> {
  const job = await db.job.findFirst({
    where: { id: jobId, userId },
    select: {
      resumeId: true,
      automation: { select: { resumeId: true } },
      User: { select: { defaultResumeId: true } },
    },
  });
  return job?.resumeId ?? job?.automation?.resumeId ?? job?.User.defaultResumeId ?? null;
}

// Writes a tailored copy of the job's resume (.docx) as a new Resume row —
// ContactInfo cloned so the apply engine can use it directly. The base resume
// and the job's own resumeId are never modified.
//
// ponytail: one Resume row per tailored job; move to a Job.tailoredFileId
// column if the resume list gets cluttered.
export async function tailorResumeForJob(jobId: string, userId: string): Promise<TailorResult> {
  const job = await db.job.findFirst({
    where: { id: jobId, userId },
    include: { JobTitle: true, Company: true },
  });
  if (!job) throw new Error("Job not found");

  const baseId = await baseResumeIdFor(jobId, userId);
  if (!baseId) throw new Error("No resume to tailor: set a default resume first");

  const base = await db.resume.findFirst({
    where: { id: baseId, profile: { userId } },
    include: { File: true, ContactInfo: true },
  });
  if (!base?.File?.filePath.toLowerCase().endsWith(".docx")) {
    throw new Error("Tailoring needs a .docx resume file");
  }

  const { zip, xml } = await loadDocumentXml(await fs.readFile(base.File.filePath));
  const structure = readStructure(xml);

  const ai = await getUserAiSettings(userId);
  const jobTitle = job.JobTitle?.label ?? "this role";
  const company = job.Company?.label ?? "";
  const description = (job.description ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  const result = await generateText({
    model: await getModel(ai.provider, ai.model || "llama3.2", userId),
    system: TAILOR_SYSTEM_PROMPT,
    prompt: buildTailorPrompt(structure, jobTitle, company, description),
    temperature: 0.3,
  });

  const raw = parseTailorJson(result.text);
  const { orders, rejected } = ordersFromScores(raw, structure);
  if (raw === null) rejected.push("model reply was not valid JSON; kept the original");

  const out = await writeDocumentXml(zip, applyOrders(xml, structure, orders));
  const safe = `${company} ${jobTitle}`.replace(/[^\w]+/g, "_").slice(0, 60);
  const upload = await saveResumeUpload(`Tailored_${safe}.docx`, out);

  const contact = base.ContactInfo;
  const tailored = await db.resume
    .create({
      data: {
        profile: { connect: { id: base.profileId } },
        title: `Tailored · ${company} · ${jobTitle}`,
        File: {
          create: { fileName: upload.fileName, filePath: upload.filePath, fileType: base.File.fileType },
        },
        ...(contact && {
          ContactInfo: {
            create: {
              firstName: contact.firstName,
              lastName: contact.lastName,
              headline: contact.headline,
              email: contact.email,
              phone: contact.phone,
              address: contact.address,
              url1: contact.url1,
              url1Label: contact.url1Label,
              url2: contact.url2,
              url2Label: contact.url2Label,
            },
          },
        }),
      },
    })
    .catch(async (error) => {
      // No Resume row points at the file, so nothing else would ever clean it up.
      await removeResumeFile(upload.filePath);
      throw error;
    });

  return {
    resumeId: tailored.id,
    groupsReordered: orders.filter((o) => o.some((v, i) => v !== i)).length,
    rejected,
  };
}
