import axios from "axios";
import type { BugReport, BugStatus, DashboardMetrics, Page, Repository, Severity, User } from "./types";

const client = axios.create({
  baseURL: "/api/v1",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

let csrfToken: string | undefined;

async function getCsrfToken(): Promise<string> {
  if (!csrfToken) {
    const response = await client.get<{ token: string }>("/auth/csrf");
    csrfToken = response.data.token;
  }
  return csrfToken;
}

async function post<T>(path: string, data?: unknown) {
  return client.post<T>(path, data, { headers: { "X-XSRF-TOKEN": await getCsrfToken() } });
}

async function patch<T>(path: string, data: unknown) {
  return client.patch<T>(path, data, { headers: { "X-XSRF-TOKEN": await getCsrfToken() } });
}

export const api = {
  async currentUser() {
    return (await client.get<User>("/auth/me")).data;
  },
  async register(input: { email: string; displayName: string; password: string }) {
    await post<User>("/auth/register", input);
    return this.login(input.email, input.password);
  },
  async login(email: string, password: string) {
    const user = (await post<User>("/auth/login", { email, password })).data;
    return user;
  },
  async logout() {
    await post<void>("/auth/logout");
    csrfToken = undefined;
  },
  async repositories() {
    return (await client.get<Repository[]>("/repositories")).data;
  },
  async createRepository(fullName: string) {
    return (await post<Repository>("/repositories", { fullName })).data;
  },
  async bugs(page = 0) {
    return (await client.get<Page<BugReport>>("/bugs", { params: { page, size: 50 } })).data;
  },
  async dashboardMetrics() {
    return (await client.get<DashboardMetrics>("/dashboard/metrics")).data;
  },
  async createBug(input: {
    repositoryId: string;
    title: string;
    description: string;
    reproductionSteps: string;
    severity: Severity;
  }) {
    return (await post<BugReport>("/bugs", input)).data;
  },
  async updateBugStatus(id: string, status: BugStatus) {
    return (await patch<BugReport>(`/bugs/${id}`, { status })).data;
  },
};

export function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.length > 0) return detail;
    if (error.response?.status === 401) return "Your session has expired. Please sign in again.";
    if (error.response?.status === 409) return "That record already exists or this status change is not allowed.";
    if (error.response?.status === 403) return "You do not have permission to do that.";
    return fallback;
  }
  return fallback;
}
