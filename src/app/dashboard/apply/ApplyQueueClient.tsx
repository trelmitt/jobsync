"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { getApplySessionStatusBadgeColor } from "@/lib/badge-colors";
import { Send } from "lucide-react";

interface ApplySessionRow {
  id: string;
  status: string;
  createdAt: string | Date;
  Job: { JobTitle: { label: string }; Company: { label: string } };
}

interface ApplyQueueClientProps {
  sessions: ApplySessionRow[];
}

export default function ApplyQueueClient({ sessions }: ApplyQueueClientProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Apply Queue
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">
            No fill-and-review attempts yet. Accept a discovered job and use
            &quot;Fill application&quot; to start one.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell className="font-medium">
                    {session.Job.JobTitle.label}
                  </TableCell>
                  <TableCell>{session.Job.Company.label}</TableCell>
                  <TableCell>
                    <StatusBadge
                      label={session.status.replace("_", " ")}
                      color={getApplySessionStatusBadgeColor(session.status)}
                    />
                  </TableCell>
                  <TableCell>
                    {format(new Date(session.createdAt), "MMM d, yyyy h:mm a")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/dashboard/apply/${session.id}`}
                      className="text-primary hover:underline text-sm"
                    >
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
