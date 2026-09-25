// Fixed templates, not model output: these go out under Trevor's name, so
// nothing in them should be a claim he didn't write. He edits before sending.
interface JobRef {
  jobTitle: string;
  company: string;
  jobUrl?: string | null;
}

export interface Draft {
  subject: string;
  body: string;
}

const posting = (job: JobRef) => (job.jobUrl ? `\n\nHere's the posting: ${job.jobUrl}` : "");

export function referralAsk(firstName: string, job: JobRef): Draft {
  return {
    subject: `${job.company}: ${job.jobTitle}`,
    body:
      `Hi ${firstName || "there"},\n\n` +
      `Hope you're doing well. I'm applying for the ${job.jobTitle} role at ${job.company} ` +
      `and would value your take on the team. If it feels right after a quick chat, ` +
      `would you be open to referring me?${posting(job)}\n\nThanks!`,
  };
}

export function hiringManagerNote(job: JobRef): Draft {
  return {
    subject: `${job.jobTitle} application`,
    body:
      `Hi there,\n\n` +
      `I just applied for the ${job.jobTitle} role at ${job.company}. ` +
      `I'd welcome 15 minutes to share how I'd approach it.${posting(job)}\n\nThanks!`,
  };
}

export const mailtoHref = (email: string, draft: Draft) =>
  `mailto:${email}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
