"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitSuggestion } from "@/actions/partner.actions";
import { toastActionResult } from "@/lib/toast";

export function SuggestForm() {
  const [url, setUrl] = useState("");
  const [whyMe, setWhyMe] = useState("");
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await submitSuggestion({ url, whyMe });
      toastActionResult(res, {
        success: "Sent! He'll take a look.",
        onSuccess: () => {
          setUrl("");
          setWhyMe("");
        },
      });
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Input
        type="url"
        placeholder="Paste a job link…"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        required
      />
      <Textarea
        placeholder="Why you thought of him (optional)"
        value={whyMe}
        onChange={(e) => setWhyMe(e.target.value)}
        rows={2}
        maxLength={500}
      />
      <Button type="submit" className="w-full" disabled={pending || !url}>
        {pending ? "Sending…" : "Send this job"}
      </Button>
    </form>
  );
}
