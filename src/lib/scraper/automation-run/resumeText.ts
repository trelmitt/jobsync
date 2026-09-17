import { removeHtmlTags } from "@/lib/ai";
import type { ResumeWithSections } from "./types";

export function extractResumeSkills(resume: ResumeWithSections): string[] {
  const labels: string[] = [];
  for (const section of resume.ResumeSections) {
    if (section.sectionType === "skills") {
      for (const skill of section.skills) {
        if (skill.Tag?.label) labels.push(skill.Tag.label);
      }
    }
  }
  return labels;
}

// Distinct job titles held across a resume's work experience, for seeding an
// automation's target-titles field from whatever resume is actually in use
// instead of a hand-typed guess.
export function extractResumeTitles(resume: ResumeWithSections): string[] {
  const labels: string[] = [];
  for (const section of resume.ResumeSections) {
    if (section.sectionType === "experience") {
      for (const exp of section.workExperiences) {
        if (exp.jobTitle?.label) labels.push(exp.jobTitle.label);
      }
    }
  }
  return [...new Set(labels)];
}

export async function convertResumeForMatch(
  resume: ResumeWithSections,
): Promise<string> {
  const parts: string[] = [`# ${resume.title}`];

  if (resume.ContactInfo) {
    const contact = resume.ContactInfo;
    parts.push(
      "## CONTACT",
      `Name: ${contact.firstName} ${contact.lastName}`,
      contact.headline ? `Headline: ${contact.headline}` : "",
      contact.email ? `Email: ${contact.email}` : "",
      contact.phone ? `Phone: ${contact.phone}` : "",
    );
  }

  for (const section of resume.ResumeSections) {
    if (section.sectionType === "summary" && section.summary?.content) {
      parts.push("## SUMMARY", removeHtmlTags(section.summary.content));
    }

    if (
      section.sectionType === "experience" &&
      section.workExperiences.length > 0
    ) {
      parts.push("## EXPERIENCE");
      for (const exp of section.workExperiences) {
        parts.push(
          `Company: ${exp.Company.label}`,
          `Job Title: ${exp.jobTitle.label}`,
          `Location: ${exp.location.label}`,
          `Description: ${removeHtmlTags(exp.description)}`,
          "",
        );
      }
    }

    if (section.sectionType === "education" && section.educations.length > 0) {
      parts.push("## EDUCATION");
      for (const edu of section.educations) {
        parts.push(
          `Institution: ${edu.institution}`,
          `Degree: ${edu.degree}`,
          `Field: ${edu.fieldOfStudy}`,
          edu.description ? `Description: ${removeHtmlTags(edu.description)}` : "",
          "",
        );
      }
    }

    if (
      (section.sectionType === "certification" ||
        section.sectionType === "license") &&
      section.licenseOrCertifications.length > 0
    ) {
      parts.push(`## ${section.sectionType.toUpperCase()}S`);
      for (const cert of section.licenseOrCertifications) {
        parts.push(
          `Title: ${cert.title}`,
          `Organization: ${cert.organization}`,
          cert.issueDate
            ? `Issue Date: ${new Date(cert.issueDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
            : "",
          cert.expirationDate
            ? `Expiration Date: ${new Date(cert.expirationDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
            : "No Expiration",
          "",
        );
      }
    }

    if (section.sectionType === "skills" && section.skills.length > 0) {
      const sorted = [...section.skills].sort((a, b) => a.order - b.order);
      const grouped = new Map<string, typeof sorted>();
      for (const s of sorted) {
        const key = s.category ?? "";
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(s);
      }
      parts.push("## SKILLS");
      for (const [cat, items] of grouped.entries()) {
        const labels = items.map((s) => s.Tag.label).join(", ");
        parts.push(cat ? `${cat}: ${labels}` : labels);
      }
      parts.push("");
    }
  }

  return parts.filter(Boolean).join("\n");
}
