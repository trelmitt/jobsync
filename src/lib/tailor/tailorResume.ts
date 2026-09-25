import "server-only";
import fs from "fs/promises";
import { generateText } from "ai";
import db from "@/lib/db";
import { getModel } from "@/lib/ai";
import { defaultUserSettings } from "@/models/userSettings.model";
import { saveResumeUpload } from "@/lib/resumeFiles";
import {
  applyEdits,
  loadDocumentXml,
  readStructure,
  validateEdits,
  writeDocumentXml,
} from "./docx";
import { TAILOR_SYSTEM_PROMPT, buildTailorPrompt, parseTailorJson } from "./prompt";

export interface TailorResult {
  resumeId: string;
  summaryChanged: boolean;
  groupsReordered: number;
  rejected: string[];
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
    include: { JobTitle: true, Company: true, automation: { select: { resumeId: true } } },
  });
  if (!job) throw new Error("Job not found");

  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const baseId = job.resumeId ?? job.automation?.resumeId ?? user.defaultResumeId;
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

  const settings = await db.userSettings.findUnique({ where: { userId } });
  const ai = settings
    ? { ...defaultUserSettings.ai, ...(JSON.parse(settings.settings).ai ?? {}) }
    : defaultUserSettings.ai;
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
  const { edits, rejected } = validateEdits(raw, structure);
  if (raw === null) rejected.push("model reply was not valid JSON; kept the original");

  const out = await writeDocumentXml(zip, applyEdits(xml, structure, edits));
  const safe = `${company} ${jobTitle}`.replace(/[^\w]+/g, "_").slice(0, 60);
  const upload = await saveResumeUpload(`Tailored_${safe}.docx`, out);

  const contact = base.ContactInfo;
  const tailored = await db.resume.create({
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
  });

  return {
    resumeId: tailored.id,
    summaryChanged: edits.summary !== undefined,
    groupsReordered: (edits.orders ?? []).filter((o) => o.some((v, i) => v !== i)).length,
    rejected,
  };
}
