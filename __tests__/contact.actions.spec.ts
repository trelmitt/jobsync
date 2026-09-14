import {
  getContactsByJobId,
  addContact,
  touchContact,
  deleteContact,
} from "@/actions/contact.actions";
import { getCurrentUser } from "@/utils/user.utils";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

vi.mock("@prisma/client", () => {
  const mPrismaClient = {
    contact: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    job: {
      findFirst: vi.fn(),
    },
  };
  return { PrismaClient: vi.fn(function() { return mPrismaClient; }) };
});

vi.mock("@/utils/user.utils", () => ({
  getCurrentUser: vi.fn(),
}));

describe("contactActions", () => {
  const mockUser = { id: "user-id" };
  const now = new Date();
  const mockContact = {
    id: "contact-id",
    jobId: "job-id",
    createdBy: mockUser.id,
    name: "Jamie Recruiter",
    email: "jamie@example.com",
    createdAt: now,
    lastTouchedAt: now,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getContactsByJobId", () => {
    it("should return contacts newest-first", async () => {
      (getCurrentUser as any).mockResolvedValue(mockUser);
      (prisma.job.findFirst as any).mockResolvedValue({ id: "job-id" });
      (prisma.contact.findMany as any).mockResolvedValue([mockContact]);

      const result = await getContactsByJobId("job-id");

      expect(result).toEqual({ success: true, data: [mockContact] });
      expect(prisma.contact.findMany).toHaveBeenCalledWith({
        where: { jobId: "job-id", createdBy: mockUser.id },
        orderBy: { createdAt: "desc" },
      });
    });

    it("should return error when job is not found", async () => {
      (getCurrentUser as any).mockResolvedValue(mockUser);
      (prisma.job.findFirst as any).mockResolvedValue(null);

      const result = await getContactsByJobId("non-existent-job");

      expect(result).toEqual({ success: false, message: "Job not found" });
    });

    it("should return error when user is not authenticated", async () => {
      (getCurrentUser as any).mockResolvedValue(null);

      const result = await getContactsByJobId("job-id");

      expect(result).toEqual({ success: false, message: "Not authenticated" });
    });
  });

  describe("addContact", () => {
    const contactData = {
      jobId: "job-id",
      name: "Jamie Recruiter",
      email: "jamie@example.com",
    };

    it("should create a contact successfully", async () => {
      (getCurrentUser as any).mockResolvedValue(mockUser);
      (prisma.job.findFirst as any).mockResolvedValue({ id: "job-id" });
      (prisma.contact.create as any).mockResolvedValue(mockContact);

      const result = await addContact(contactData);

      expect(result).toEqual({ success: true, data: mockContact });
      expect(prisma.contact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          jobId: "job-id",
          createdBy: mockUser.id,
          name: "Jamie Recruiter",
          email: "jamie@example.com",
        }),
      });
    });

    it("should reject an invalid email", async () => {
      (getCurrentUser as any).mockResolvedValue(mockUser);

      const result = await addContact({ ...contactData, email: "not-an-email" });

      expect(result.success).toBe(false);
      expect(prisma.contact.create).not.toHaveBeenCalled();
    });

    it("should return error when job is not found", async () => {
      (getCurrentUser as any).mockResolvedValue(mockUser);
      (prisma.job.findFirst as any).mockResolvedValue(null);

      const result = await addContact(contactData);

      expect(result).toEqual({ success: false, message: "Job not found" });
    });
  });

  describe("touchContact", () => {
    it("should bump lastTouchedAt", async () => {
      (getCurrentUser as any).mockResolvedValue(mockUser);
      (prisma.contact.update as any).mockResolvedValue(mockContact);

      const result = await touchContact("contact-id");

      expect(result).toEqual({ success: true, data: mockContact });
      expect(prisma.contact.update).toHaveBeenCalledWith({
        where: { id: "contact-id", createdBy: mockUser.id },
        data: { lastTouchedAt: expect.any(Date) },
      });
    });

    it("should return error when user is not authenticated", async () => {
      (getCurrentUser as any).mockResolvedValue(null);

      const result = await touchContact("contact-id");

      expect(result).toEqual({ success: false, message: "Not authenticated" });
    });
  });

  describe("deleteContact", () => {
    it("should delete a contact successfully", async () => {
      (getCurrentUser as any).mockResolvedValue(mockUser);
      (prisma.contact.delete as any).mockResolvedValue(mockContact);

      const result = await deleteContact("contact-id");

      expect(result).toEqual({ success: true });
      expect(prisma.contact.delete).toHaveBeenCalledWith({
        where: { id: "contact-id", createdBy: mockUser.id },
      });
    });
  });
});
