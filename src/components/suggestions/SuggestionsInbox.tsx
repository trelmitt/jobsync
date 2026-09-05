"use client";
import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { reviewSuggestion } from "@/actions/suggestion.actions";
import { toastActionResult } from "@/lib/toast";
import { ExternalLink } from "lucide-react";

type Suggestion = {
  id: string;
  url: string;
  whyMe: string | null;
  status: string;
  replyNote: string | null;
  createdAt: Date;
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
    new: { label: "New", variant: "outline" },
    reviewed: { label: "Reviewed", variant: "secondary" },
    promoted: { label: "On list", variant: "default" },
    dismissed: { label: "Passed", variant: "secondary" },
  };
  const m = map[status] ?? map.new;
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

function SuggestionRow({ s }: { s: Suggestion }) {
  const [reply, setReply] = useState(s.replyNote ?? "");
  const [pending, start] = useTransition();

  const act = (action: "promote" | "dismiss" | "reviewed") =>
    start(async () => {
      const res = await reviewSuggestion(s.id, action, reply);
      toastActionResult(res, { success: "Updated. They'll see it." });
    });

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 items-center gap-1 truncate text-sm font-medium underline"
          >
            <span className="truncate">{s.url}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
          <StatusBadge status={s.status} />
        </div>
        {s.whyMe && <p className="text-xs italic text-muted-foreground">&ldquo;{s.whyMe}&rdquo;</p>}
        <Textarea
          placeholder="A note back to them (optional)"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={2}
          maxLength={500}
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => act("promote")} disabled={pending}>
            Added to my list
          </Button>
          <Button size="sm" variant="secondary" onClick={() => act("dismiss")} disabled={pending}>
            Pass
          </Button>
          <Button size="sm" variant="ghost" onClick={() => act("reviewed")} disabled={pending}>
            Just reply
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function SuggestionsInbox({ suggestions }: { suggestions: Suggestion[] }) {
  if (suggestions.length === 0) {
    return <p className="text-sm text-muted-foreground">No suggestions yet.</p>;
  }
  return (
    <div className="space-y-3">
      {suggestions.map((s) => (
        <SuggestionRow key={s.id} s={s} />
      ))}
    </div>
  );
}
