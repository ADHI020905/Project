export type User = {
  id: string;
  email: string;
  displayName: string;
};

export type Repository = {
  id: string;
  fullName: string;
  createdAt: string;
};

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type BugStatus = "NEW" | "INVESTIGATING" | "RESOLVED" | "CLOSED";

export type BugReport = {
  id: string;
  repositoryId: string;
  repositoryName: string;
  title: string;
  description: string;
  reproductionSteps: string;
  severity: Severity;
  status: BugStatus;
  createdAt: string;
  updatedAt: string;
};

export type Page<T> = {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
};

export type DashboardMetrics = {
  totalReports: number;
  newReports: number;
  investigatingReports: number;
  highPriorityReports: number;
};
