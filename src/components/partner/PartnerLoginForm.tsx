"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { partnerLogin } from "@/actions/partner.actions";
import { toastError } from "@/lib/toast";

export function PartnerLoginForm() {
  const [pin, setPin] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await partnerLogin(pin);
      if (res?.success) router.replace("/partner");
      else toastError(res?.message ?? "Login failed.");
    });
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Job Search Status</CardTitle>
        <CardDescription>Enter the PIN to see the latest.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            placeholder="PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            autoFocus
          />
          <Button type="submit" className="w-full" disabled={pending || !pin}>
            {pending ? "Checking…" : "View status"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
