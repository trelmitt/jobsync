import {
  getActivityCalendarData,
  getActivityDataForPeriod,
  getJobsActivityForPeriod,
  getJobsActivitySummary,
  getRecentActivities,
  getRecentJobs,
  getStaleJobs,
} from "@/actions/dashboard.actions";
import ActivityCalendar from "@/components/dashboard/ActivityCalendar";
import JobsActivityCard from "@/components/dashboard/JobsActivityCard";
import JobsApplied from "@/components/dashboard/JobsAppliedCard";
import RecentCardToggle from "@/components/dashboard/RecentCardToggle";
import WeeklyBarChartToggle from "@/components/dashboard/WeeklyBarChartToggle";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function Dashboard() {
  const [
    summary7Days,
    summary30Days,
    recentJobs,
    recentActivities,
    weeklyData,
    activitiesData,
    activityCalendarData,
    staleJobs,
  ] = await Promise.all([
    getJobsActivitySummary(7),
    getJobsActivitySummary(30),
    getRecentJobs(),
    getRecentActivities(),
    getJobsActivityForPeriod(),
    getActivityDataForPeriod(),
    getActivityCalendarData(),
    getStaleJobs(),
  ]);
  const activityCalendarDataKeys = Object.keys(activityCalendarData);
  const activitiesDataKeys = (data: string[]) =>
    Array.from(
      new Set(
        data.flatMap((entry) =>
          Object.keys(entry).filter((key) => key !== "day"),
        ),
      ),
    );
  return (
    <>
      <div className="@container grid grid-cols-1 auto-rows-max items-start gap-2 md:gap-2 @3xl/main:col-span-2">
        <div className="grid gap-2 @lg:grid-cols-4">
          <JobsApplied />
          <JobsActivityCard
            data={[
              { label: "7d", summary: summary7Days },
              { label: "30d", summary: summary30Days },
            ]}
          />
        </div>
        <WeeklyBarChartToggle
          charts={[
            {
              label: "Jobs",
              data: weeklyData,
              keys: ["value"],
              axisLeftLegend: "JOBS APPLIED",
            },
            {
              label: "Activities",
              data: activitiesData,
              keys: activitiesDataKeys(activitiesData),
              groupMode: "stacked",
              axisLeftLegend: "TIME SPENT (Hours)",
            },
          ]}
        />
      </div>
      {staleJobs.length > 0 && (
        <div className="@3xl/main:col-span-2">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">
            Needs follow-up
          </h2>
          <div className="grid gap-2 @lg:grid-cols-2">
            {staleJobs.map((job) => (
              <Link key={job.id} href={`/dashboard/myjobs/${job.id}`}>
                <Card className="hover:bg-accent">
                  <CardContent className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {job.JobTitle?.label ?? "Role"}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {job.Company?.label ?? ""}
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      No activity {formatDistanceToNow(job.createdAt)}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
      <div className="@3xl/main:relative @3xl/main:self-stretch">
        <RecentCardToggle jobs={recentJobs} activities={recentActivities} />
      </div>
      <div className="w-full col-span-3">
        <ActivityCalendar
          years={activityCalendarDataKeys}
          dataByYear={activityCalendarData}
        />
      </div>
    </>
  );
}
