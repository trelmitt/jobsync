import {
  extractResumeSkills,
  extractResumeTitles,
} from "@/lib/scraper/automation-run/resumeText";
import type { ResumeWithSections } from "@/lib/scraper/automation-run/types";

function experienceSection(
  titles: string[],
): ResumeWithSections["ResumeSections"][number] {
  return {
    sectionType: "experience",
    workExperiences: titles.map((title) => ({
      description: "",
      startDate: new Date("2020-01-01"),
      endDate: null,
      Company: { label: "Acme" },
      jobTitle: { label: title },
      location: { label: "Remote" },
    })),
    educations: [],
    licenseOrCertifications: [],
    skills: [],
  };
}

function resume(
  sections: ResumeWithSections["ResumeSections"],
): ResumeWithSections {
  return { ResumeSections: sections } as ResumeWithSections;
}

describe("extractResumeTitles", () => {
  it("returns distinct job titles from experience sections", () => {
    const titles = extractResumeTitles(
      resume([experienceSection(["Account Executive", "Sales Engineer"])]),
    );
    expect(titles).toEqual(["Account Executive", "Sales Engineer"]);
  });

  it("de-duplicates repeated titles across positions", () => {
    const titles = extractResumeTitles(
      resume([
        experienceSection(["Account Executive"]),
        experienceSection(["Account Executive", "Sales Engineer"]),
      ]),
    );
    expect(titles).toEqual(["Account Executive", "Sales Engineer"]);
  });

  it("ignores non-experience sections", () => {
    const titles = extractResumeTitles(
      resume([
        {
          sectionType: "skills",
          workExperiences: [],
          educations: [],
          licenseOrCertifications: [],
          skills: [{ category: null, order: 0, Tag: { id: "1", label: "React" } }],
        },
      ]),
    );
    expect(titles).toEqual([]);
  });

  it("returns an empty array when there are no experience sections", () => {
    expect(extractResumeTitles(resume([]))).toEqual([]);
  });
});

describe("extractResumeSkills (regression, unchanged behavior)", () => {
  it("still reads skill labels from skills sections", () => {
    const skills = extractResumeSkills(
      resume([
        {
          sectionType: "skills",
          workExperiences: [],
          educations: [],
          licenseOrCertifications: [],
          skills: [{ category: null, order: 0, Tag: { id: "1", label: "React" } }],
        },
      ]),
    );
    expect(skills).toEqual(["React"]);
  });
});
