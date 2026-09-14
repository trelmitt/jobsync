"use server";
import prisma from "@/lib/db";
import { handleError } from "@/lib/utils";
import { ContactFormSchema } from "@/models/contact.schema";
import { getCurrentUser } from "@/utils/user.utils";
import { z } from "zod";

export const getContactsByJobId = async (
  jobId: string
): Promise<any | undefined> => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error("Not authenticated");
    }

    const job = await prisma.job.findFirst({
      where: { id: jobId, userId: user.id },
      select: { id: true },
    });
    if (!job) {
      throw new Error("Job not found");
    }

    const contacts = await prisma.contact.findMany({
      where: { jobId, createdBy: user.id },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: contacts };
  } catch (error) {
    const msg = "Failed to fetch contacts.";
    return handleError(error, msg);
  }
};

export const addContact = async (
  data: z.infer<typeof ContactFormSchema>
): Promise<any | undefined> => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error("Not authenticated");
    }

    const validated = ContactFormSchema.parse(data);

    const job = await prisma.job.findFirst({
      where: { id: validated.jobId, userId: user.id },
      select: { id: true },
    });
    if (!job) {
      throw new Error("Job not found");
    }

    const now = new Date();
    const contact = await prisma.contact.create({
      data: {
        jobId: validated.jobId,
        createdBy: user.id,
        name: validated.name,
        email: validated.email,
        createdAt: now,
        lastTouchedAt: now,
      },
    });

    return { success: true, data: contact };
  } catch (error) {
    const msg = "Failed to add contact.";
    return handleError(error, msg);
  }
};

export const touchContact = async (
  contactId: string
): Promise<any | undefined> => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error("Not authenticated");
    }

    const contact = await prisma.contact.update({
      where: { id: contactId, createdBy: user.id },
      data: { lastTouchedAt: new Date() },
    });

    return { success: true, data: contact };
  } catch (error) {
    const msg = "Failed to mark contact as followed up.";
    return handleError(error, msg);
  }
};

export const deleteContact = async (
  contactId: string
): Promise<any | undefined> => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error("Not authenticated");
    }

    await prisma.contact.delete({
      where: { id: contactId, createdBy: user.id },
    });

    return { success: true };
  } catch (error) {
    const msg = "Failed to delete contact.";
    return handleError(error, msg);
  }
};
