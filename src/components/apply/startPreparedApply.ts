// Starts the Accept → apply pipeline: tailor the resume, write a cover
// letter, then fill the form and stop for review. Never submits.
export async function startPreparedApply(
  jobId: string,
  resumeId?: string | null,
): Promise<{ id?: string; message?: string; engineOff?: boolean }> {
  const res = await fetch(`/api/apply/${jobId}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resumeId: resumeId ?? undefined, prepare: true }),
  }).catch(() => null);
  if (!res) return { message: "Could not reach the apply engine" };
  const data = await res.json().catch(() => ({}));
  if (res.ok && data.success) return { id: data.id };
  return { message: data.message ?? "Failed to start the application", engineOff: res.status === 403 };
}
