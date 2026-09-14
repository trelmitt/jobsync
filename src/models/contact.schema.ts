import { z } from "zod";

export const ContactFormSchema = z.object({
  jobId: z.string({ error: "Job ID is required." }),
  name: z
    .string({ error: "Name is required." })
    .min(1, { message: "Name cannot be empty." }),
  email: z.email({ error: "A valid email is required." }),
});
