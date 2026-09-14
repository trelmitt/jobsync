"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { formatDistanceToNow } from "date-fns";
import { touchContact } from "@/actions/contact.actions";
import { toastActionResult } from "@/lib/toast";

type StaleContact = {
  id: string;
  name: string;
  lastTouchedAt: Date;
  Job: {
    id: string;
    JobTitle?: { label: string } | null;
    Company?: { label: string } | null;
  } | null;
};

export function StaleContactsSection({
  contacts,
}: {
  contacts: StaleContact[];
}) {
  const [list, setList] = useState(contacts);
  const [isPending, startTransition] = useTransition();

  if (list.length === 0) return null;

  const handleTouch = (id: string) => {
    startTransition(async () => {
      const result = await touchContact(id);
      toastActionResult(result, {
        success: "Marked as followed up",
        onSuccess: () => setList((prev) => prev.filter((c) => c.id !== id)),
      });
    });
  };

  return (
    <div className="@3xl/main:col-span-2">
      <h2 className="mb-2 text-sm font-medium text-muted-foreground">
        Contacts needing follow-up
      </h2>
      <div className="grid gap-2 @lg:grid-cols-2">
        {list.map((contact) => (
          <Card key={contact.id}>
            <CardContent className="flex items-center justify-between gap-2 p-3">
              <Link
                href={contact.Job ? `/dashboard/myjobs/${contact.Job.id}` : "#"}
                className="min-w-0 hover:underline"
              >
                <div className="truncate text-sm font-medium">
                  {contact.name}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {contact.Job?.JobTitle?.label ?? ""}
                  {contact.Job?.Company?.label
                    ? ` @ ${contact.Job.Company.label}`
                    : ""}
                </div>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="outline">
                  No touch {formatDistanceToNow(contact.lastTouchedAt)}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => handleTouch(contact.id)}
                >
                  Mark followed up
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
