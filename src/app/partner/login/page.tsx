import { redirect } from "next/navigation";
import { isPartnerAuthed } from "@/lib/partner/auth";
import { PartnerLoginForm } from "@/components/partner/PartnerLoginForm";

export const dynamic = "force-dynamic";

export default async function PartnerLoginPage() {
  if (await isPartnerAuthed()) redirect("/partner");
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <PartnerLoginForm />
    </div>
  );
}
