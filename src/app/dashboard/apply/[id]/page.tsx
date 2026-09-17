import { notFound } from "next/navigation";
import ApplyReviewClient from "./ApplyReviewClient";
import { getApplySessionDetail } from "@/actions/applySession.actions";

async function ApplyReview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getApplySessionDetail(id);
  if (!result?.success || !result.data) notFound();

  return <ApplyReviewClient session={result.data} />;
}

export default ApplyReview;
