import { importLinkedInConnections, getNetworkForJob } from "@/actions/contact.actions";
import { parseLinkedInConnections } from "@/lib/contacts/linkedinCsv";
import { mailtoHref, referralAsk } from "@/lib/contacts/outreach";
import { resolveCompany } from "@/lib/jobs/resolve";
import { getCurrentUser } from "@/utils/user.utils";
import prisma from "@/lib/db";

vi.mock("@/lib/db", () => ({
  default: {
    contact: { findMany: vi.fn(), createMany: vi.fn() },
    job: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/jobs/resolve", () => ({ resolveCompany: vi.fn() }));
vi.mock("@/utils/user.utils", () => ({ getCurrentUser: vi.fn() }));

const db = prisma as any;

const CSV = `Notes:
"When exporting your connection data, you may notice that some of the email addresses are missing."

First Name,Last Name,URL,Email Address,Company,Position,Connected On
Ana,Lee,https://www.linkedin.com/in/ana,ana@x.io,"Weaviate, Inc.",Account Executive,01 Jan 2024
Ben,Ray,https://www.linkedin.com/in/ben,,Supabase,Partnerships,02 Jan 2024
Cal,Moe,https://www.linkedin.com/in/cal,,Weaviate,,03 Jan 2024
,,https://www.linkedin.com/in/hidden,,,,04 Jan 2024
Dee,Fox,,,Modal,AE,05 Jan 2024
`;

describe("parseLinkedInConnections", () => {
  it("skips the notes preamble, keeps quoted commas, drops nameless rows", () => {
    const rows = parseLinkedInConnections(CSV);
    expect(rows.map((r) => r.name)).toEqual(["Ana Lee", "Ben Ray", "Cal Moe", "Dee Fox"]);
    expect(rows[0]).toMatchObject({ company: "Weaviate, Inc.", email: "ana@x.io", position: "Account Executive" });
    expect(rows[1].email).toBeNull();
  });

  it("returns nothing for a file that isn't a connections export", () => {
    expect(parseLinkedInConnections("name,email\nx,y")).toEqual([]);
  });
});

describe("importLinkedInConnections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getCurrentUser as any).mockResolvedValue({ id: "user-1" });
    (resolveCompany as any).mockImplementation(async (label: string) => ({ id: `co-${label}` }));
    db.contact.createMany.mockImplementation(async ({ data }: any) => ({ count: data.length }));
  });

  it("adds only people not already imported, resolving each company once", async () => {
    db.contact.findMany.mockResolvedValue([
      { linkedinUrl: "https://www.linkedin.com/in/ben", name: "Ben Ray", Company: null },
      // No profile URL: matched on name + company instead.
      { linkedinUrl: null, name: "Dee Fox", Company: { label: "Modal" } },
    ]);

    const res = await importLinkedInConnections(CSV);

    expect(res).toEqual({ success: true, data: { created: 2, skipped: 2 } });
    expect(resolveCompany).toHaveBeenCalledTimes(2);
    expect(db.contact.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ name: "Ana Lee", companyId: "co-Weaviate, Inc.", createdBy: "user-1" }),
        expect.objectContaining({ name: "Cal Moe", companyId: "co-Weaviate", title: null }),
      ],
    });
  });

  it("refuses a file with no connections", async () => {
    const res = await importLinkedInConnections("hello");
    expect(res.success).toBe(false);
    expect(db.contact.createMany).not.toHaveBeenCalled();
  });
});

describe("getNetworkForJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getCurrentUser as any).mockResolvedValue({ id: "user-1" });
  });

  it("finds the user's current and former people at the job's company", async () => {
    db.job.findFirst.mockResolvedValue({ companyId: "co-1" });
    db.contact.findMany.mockResolvedValue([{ id: "c1" }]);

    expect(await getNetworkForJob("job-1")).toEqual([{ id: "c1" }]);
    expect(db.job.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "job-1", userId: "user-1" } }),
    );
    expect(db.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdBy: "user-1",
          OR: [{ companyId: "co-1" }, { workedAtCompanyId: "co-1" }],
          jobLinks: { none: { jobId: "job-1" } },
        },
      }),
    );
  });

  it("returns nobody for another user's job", async () => {
    db.job.findFirst.mockResolvedValue(null);
    expect(await getNetworkForJob("job-x")).toEqual([]);
    expect(db.contact.findMany).not.toHaveBeenCalled();
  });
});

describe("outreach drafts", () => {
  it("fills the referral ask and encodes it into a mailto link", () => {
    const draft = referralAsk("Ana", { jobTitle: "Account Executive", company: "Weaviate", jobUrl: "https://x.io/j?a=1&b=2" });
    expect(draft.body).toContain("Hi Ana,");
    expect(draft.body).toContain("Account Executive role at Weaviate");
    expect(draft.body).not.toContain("undefined");
    const href = mailtoHref("ana@x.io", draft);
    expect(href.startsWith("mailto:ana@x.io?subject=")).toBe(true);
    expect(decodeURIComponent(href.split("&body=")[1])).toBe(draft.body);
  });
});
