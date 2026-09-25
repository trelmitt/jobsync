"use client";
import { useRef, useTransition } from "react";
import { Upload } from "lucide-react";
import { Button } from "../ui/button";
import { importLinkedInConnections } from "@/actions/contact.actions";
import { toastActionResult } from "@/lib/toast";

export function ImportLinkedInButton({ onImported }: { onImported: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const onFile = (file?: File) => {
    if (!file) return;
    startTransition(async () => {
      // A transport failure (e.g. an oversized body) rejects before the
      // action's own error handling runs.
      const result = await importLinkedInConnections(await file.text()).catch(() => ({
        success: false as const,
        message: "Upload failed. Is this LinkedIn's Connections.csv?",
      }));
      toastActionResult(result, {
        success: result.success
          ? `Imported ${result.data.created} connections (${result.data.skipped} already here)`
          : "",
        onSuccess: onImported,
      });
      if (input.current) input.current.value = "";
    });
  };

  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1"
        disabled={isPending}
        onClick={() => input.current?.click()}
        title="LinkedIn → Settings → Data privacy → Get a copy of your data → Connections"
      >
        <Upload className="h-3.5 w-3.5" />
        Import LinkedIn
      </Button>
    </>
  );
}
