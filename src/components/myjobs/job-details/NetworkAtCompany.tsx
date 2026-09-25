"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getNetworkForJob } from "@/actions/contact.actions";
import { hiringManagerNote, mailtoHref, referralAsk, type Draft } from "@/lib/contacts/outreach";

type Person = {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  linkedinUrl: string | null;
  companyId: string | null;
};

type Props = {
  jobId: string;
  companyId?: string | null;
  jobTitle: string;
  company: string;
  jobUrl?: string | null;
};

function DraftBox({ draft, email, linkedinUrl }: { draft: Draft; email?: string | null; linkedinUrl?: string | null }) {
  const copy = async () => {
    await navigator.clipboard.writeText(draft.body);
    toast("Copied");
  };
  return (
    <div className="mt-2 space-y-2 rounded-md bg-muted p-3">
      <pre className="whitespace-pre-wrap font-sans text-sm">{draft.body}</pre>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="h-7 gap-1" onClick={copy}>
          <Copy className="h-3.5 w-3.5" />
          Copy
        </Button>
        {email && (
          <Button size="sm" variant="outline" className="h-7 gap-1" asChild>
            <a href={mailtoHref(email, draft)}>
              <Mail className="h-3.5 w-3.5" />
              Open in email
            </a>
          </Button>
        )}
        {linkedinUrl && (
          <Button size="sm" variant="outline" className="h-7 gap-1" asChild>
            <a href={linkedinUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              LinkedIn
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

// Warm paths first: a referral beats a cold application. Drafts are never
// sent from here; Trevor copies or opens them in his own mail client.
export function NetworkAtCompany({ jobId, companyId, jobTitle, company, jobUrl }: Props) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    getNetworkForJob(jobId).then((res) => setPeople(Array.isArray(res) ? res : []));
  }, [jobId]);

  const job = { jobTitle, company, jobUrl };
  const toggle = (id: string) => setOpen((cur) => (cur === id ? null : id));

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">In your network at {company}</h3>
      {people?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No one yet.{" "}
          <Link href="/dashboard/admin?tab=contacts" className="underline">
            Import your LinkedIn connections
          </Link>{" "}
          to see who you know here.
        </p>
      )}
      {people?.map((p) => (
        <div key={p.id} className="rounded-md border p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="font-medium">{p.name}</span>
              {p.title && <span className="text-muted-foreground"> · {p.title}</span>}
              {p.companyId !== companyId && <span className="text-muted-foreground"> · used to work here</span>}
            </div>
            <Button size="sm" variant="outline" className="h-7 shrink-0" onClick={() => toggle(p.id)}>
              Draft referral ask
            </Button>
          </div>
          {open === p.id && (
            <DraftBox draft={referralAsk(p.name.split(" ")[0], job)} email={p.email} linkedinUrl={p.linkedinUrl} />
          )}
        </div>
      ))}
      <Button size="sm" variant="ghost" className="h-7 px-0" onClick={() => toggle("hiring-manager")}>
        Draft a note to the hiring manager
      </Button>
      {open === "hiring-manager" && <DraftBox draft={hiringManagerNote(job)} />}
    </div>
  );
}
