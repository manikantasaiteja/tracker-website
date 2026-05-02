export const APPLICATION_STATUSES = [
  "Applied",
  "Interview",
  "Offer",
  "Rejected",
  "Ghosted",
  "Withdrawn",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export type ApplicationRecord = {
  id: string;
  user_id: string;
  company: string;
  role: string;
  status: ApplicationStatus;
  date_applied: string;
  location: string | null;
  job_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ApplicationDraft = {
  company: string;
  role: string;
  status: ApplicationStatus;
  date_applied: string;
  location: string;
  job_url: string;
  notes: string;
};
