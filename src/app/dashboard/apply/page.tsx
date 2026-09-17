import ApplyQueueClient from "./ApplyQueueClient";
import { getApplyQueue } from "@/actions/applySession.actions";

async function ApplyQueue() {
  const result = await getApplyQueue();
  return <ApplyQueueClient sessions={result?.data || []} />;
}

export default ApplyQueue;
