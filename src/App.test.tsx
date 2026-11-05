import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { api } from "./api";

vi.mock("./api", () => ({
  api: {
    currentUser: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    repositories: vi.fn(),
    bugs: vi.fn(),
    dashboardMetrics: vi.fn(),
  },
  getErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

describe("application authentication flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows sign-in and account creation forms after an unauthenticated response", async () => {
    vi.mocked(api.currentUser).mockRejectedValue(new Error("Unauthenticated"));
    render(<BrowserRouter><App /></BrowserRouter>);

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/)).toHaveAttribute("minLength", "12");
  });

  it("loads the owned workspace for a signed-in user", async () => {
    vi.mocked(api.currentUser).mockResolvedValue({ id: "u1", email: "ada@example.com", displayName: "Ada Lovelace" });
    vi.mocked(api.repositories).mockResolvedValue([{ id: "r1", fullName: "ada/compiler", createdAt: "2026-01-01T00:00:00Z" }]);
    vi.mocked(api.bugs).mockResolvedValue({ items: [], page: 0, size: 50, totalItems: 0, totalPages: 0 });
    vi.mocked(api.dashboardMetrics).mockResolvedValue({
      totalReports: 0,
      newReports: 0,
      investigatingReports: 0,
      highPriorityReports: 0,
    });

    render(<BrowserRouter><App /></BrowserRouter>);

    expect(await screen.findByText("Good to see you, Ada")).toBeInTheDocument();
    await waitFor(() => expect(api.repositories).toHaveBeenCalledOnce());
    expect(screen.getByText("ada/compiler")).toBeInTheDocument();
  });
});
