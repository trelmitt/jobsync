"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { partnerLogout } from "@/actions/partner.actions";

export function PartnerHeader() {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-3">
        <span className="font-semibold">Job Search Status</span>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await partnerLogout();
              router.replace("/partner/login");
            })
          }
        >
          <LogOut className="mr-1 h-4 w-4" /> Sign out
        </Button>
      </div>
    </header>
  );
}
