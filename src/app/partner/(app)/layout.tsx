import { redirect } from "next/navigation";
import { isPartnerAuthed } from "@/lib/partner/auth";
import { PartnerHeader } from "@/components/partner/PartnerHeader";

export const dynamic = "force-dynamic";

// The gate. Everything under this route group requires a valid partner-session
// cookie; the /partner/login page lives OUTSIDE this group so it isn't gated.
export default async function PartnerAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isPartnerAuthed())) redirect("/partner/login");
  return (
    <div className="min-h-screen bg-background">
      <PartnerHeader />
      <main className="mx-auto w-full max-w-2xl px-4 py-6 pb-24">{children}</main>
    </div>
  );
}
