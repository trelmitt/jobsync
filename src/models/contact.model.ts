export interface Contact {
  id: string;
  name: string;
  email: string;
  jobId: string | null;
  createdAt: Date;
  createdBy: string;
  lastTouchedAt: Date;
}
