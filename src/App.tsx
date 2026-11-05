import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { api, getErrorMessage } from "./api";
import type { BugReport, BugStatus, DashboardMetrics, Repository, Severity, User } from "./types";

type AuthMode = "login" | "register";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    api.currentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setCheckingSession(false));
  }, []);

  if (checkingSession) {
    return <main className="loading-screen"><span className="loader" />Loading your workspace</main>;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <AuthPage onAuthenticated={setUser} />}
      />
      <Route
        path="/"
        element={user ? <Dashboard user={user} onSignOut={() => setUser(null)} /> : <Navigate to="/login" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AuthPage({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = mode === "register"
        ? await api.register({ email, displayName, password })
        : await api.login(email, password);
      onAuthenticated(user);
      navigate("/", { replace: true });
    } catch (reason) {
      setError(getErrorMessage(reason, mode === "register" ? "Could not create your account." : "Could not sign in."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        <Brand />
        <div className="story-copy">
          <div className="eyebrow"><span className="pulse-dot" /> EVIDENCE-FIRST DEBUGGING</div>
          <h1>Find the signal<br />in every bug.</h1>
          <p>Keep reports, reproduction steps, and investigation work together—without losing sight of the evidence.</p>
        </div>
        <div className="story-footer">A calmer way to get from report to resolution.</div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <span className="mobile-brand"><Brand /></span>
          <div className="eyebrow">YOUR WORKSPACE</div>
          <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
          <p className="muted">{mode === "login" ? "Sign in to pick up where you left off." : "Start organizing your team's bug reports."}</p>
          <form onSubmit={submit} className="form-stack">
            {mode === "register" && (
              <label>
                Name
                <input autoComplete="name" maxLength={80} onChange={(event) => setDisplayName(event.target.value)} required value={displayName} />
              </label>
            )}
            <label>
              Email
              <input autoComplete="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
            </label>
            <label>
              Password
              <input
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={mode === "register" ? 12 : 1}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
              {mode === "register" && <span className="field-hint">Use at least 12 characters.</span>}
            </label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="button button-primary button-wide" disabled={busy} type="submit">
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
              {!busy && <span aria-hidden="true">→</span>}
            </button>
          </form>
          <p className="auth-switch">
            {mode === "login" ? "New to BugDetect?" : "Already have an account?"}{" "}
            <button className="text-button" onClick={() => { setError(""); setMode(mode === "login" ? "register" : "login"); }} type="button">
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
          <p className="security-note"><span aria-hidden="true">◈</span> Your workspace is private to your account.</p>
        </div>
      </section>
    </main>
  );
}

function Dashboard({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalReports: 0,
    newReports: 0,
    investigatingReports: 0,
    highPriorityReports: 0,
  });
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [showReportForm, setShowReportForm] = useState(false);
  const [showRepositoryForm, setShowRepositoryForm] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  async function refresh() {
    setLoading(true);
    setPageError("");
    try {
      const [repositoryList, bugPage, dashboardMetrics] = await Promise.all([
        api.repositories(),
        api.bugs(page),
        api.dashboardMetrics(),
      ]);
      setRepositories(repositoryList);
      setBugs(bugPage.items);
      setMetrics(dashboardMetrics);
      setTotalPages(bugPage.totalPages);
    } catch (error) {
      setPageError(getErrorMessage(error, "Could not load your workspace."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, [page]);

  async function signOut() {
    try {
      await api.logout();
      onSignOut();
      navigate("/login", { replace: true });
    } catch {
      setPageError("Could not end your session. Check your connection and try again.");
    }
  }

  const visibleBugs = useMemo(() => bugs.filter((bug) => {
    const matchesStatus = filter === "ALL" || bug.status === filter;
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${bug.title} ${bug.repositoryName} ${bug.description}`.toLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  }), [bugs, filter, search]);

  const stats = [
    { label: "Total reports", value: metrics.totalReports, icon: "▤", tone: "blue" },
    { label: "New", value: metrics.newReports, icon: "✳", tone: "violet" },
    { label: "Investigating", value: metrics.investigatingReports, icon: "◷", tone: "amber" },
    { label: "High priority", value: metrics.highPriorityReports, icon: "↑", tone: "rose" },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">WORKSPACE</div>
        <button className="nav-item active"><span>▦</span> Overview</button>
        <button className="nav-item" onClick={() => document.getElementById("reports")?.scrollIntoView({ behavior: "smooth" })}><span>▤</span> Bug reports <span className="nav-count">{bugs.length}</span></button>
        <div className="sidebar-section-heading">YOUR REPOSITORIES</div>
        {repositories.length === 0 ? (
          <p className="sidebar-empty">Add a repository to get started.</p>
        ) : repositories.slice(0, 5).map((repository) => (
          <div className="repo-nav-item" key={repository.id}><span className="repo-mark">{repository.fullName.slice(0, 1).toUpperCase()}</span>{repository.fullName}</div>
        ))}
        <button className="add-repo-link" onClick={() => setShowRepositoryForm(true)}>＋ Add repository</button>
        <div className="sidebar-bottom">
          <div className="avatar">{initials(user.displayName)}</div>
          <div className="user-summary"><strong>{user.displayName}</strong><span>{user.email}</span></div>
          <button aria-label="Sign out" className="icon-button signout-button" onClick={() => void signOut()} title="Sign out">↗</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> <strong>Overview</strong></div>
          <div className="topbar-actions"><span className="live-indicator"><i /> All systems operational</span><button aria-label="Sign out" className="icon-button mobile-signout" onClick={() => void signOut()}>↗</button></div>
        </header>
        <div className="page-content">
          <section className="welcome-row">
            <div>
              <div className="eyebrow">{new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(new Date()).toUpperCase()}, LET'S GET TO IT</div>
              <h1>Good to see you, {firstName(user.displayName)} <span className="wave">✦</span></h1>
              <p className="muted">Here's what's happening across your bug reports.</p>
            </div>
            <button className="button button-primary" disabled={repositories.length === 0} onClick={() => setShowReportForm(true)}>
              <span aria-hidden="true">＋</span> New bug report
            </button>
          </section>

          {pageError && <div className="banner-error" role="alert">{pageError}<button onClick={() => void refresh()}>Retry</button></div>}

          <section aria-label="Bug report summary" className="stats-grid">
            {stats.map((stat) => (
              <article className="stat-card" key={stat.label}>
                <div className={`stat-icon ${stat.tone}`}>{stat.icon}</div>
                <div><div className="stat-value">{stat.value}</div><div className="stat-label">{stat.label}</div></div>
                <span className="stat-spark" aria-hidden="true">⌁</span>
              </article>
            ))}
          </section>

          <section className="reports-section" id="reports">
            <div className="section-heading">
              <div><h2>Bug reports <span className="count-pill">{bugs.length}</span></h2><p className="muted">Track issues from first report to resolution.</p></div>
              <button className="button button-secondary" onClick={() => setShowRepositoryForm(true)}>＋ Add repository</button>
            </div>
            <div className="report-toolbar">
              <div className="search-field"><span aria-hidden="true">⌕</span><input aria-label="Search bug reports" onChange={(event) => setSearch(event.target.value)} placeholder="Search reports..." value={search} /></div>
              <div className="filter-tabs" role="group" aria-label="Filter reports">
                {["ALL", "NEW", "INVESTIGATING", "RESOLVED", "CLOSED"].map((status) => (
                  <button aria-pressed={filter === status} className={filter === status ? "filter-tab selected" : "filter-tab"} key={status} onClick={() => setFilter(status)}>
                    {status === "ALL" ? "All reports" : statusLabel(status as BugStatus)}
                  </button>
                ))}
              </div>
            </div>
            <div className="report-list">
              {loading ? <div className="empty-state"><span className="loader" />Loading reports…</div> :
                visibleBugs.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-illustration">✳</div>
                    <h3>{bugs.length === 0 ? "Your workspace is ready" : "No matching reports"}</h3>
                    <p>{bugs.length === 0 ? repositories.length === 0 ? "Add a repository, then create your first bug report." : "Create a bug report to start organizing your investigations." : "Try another search or status filter."}</p>
                    {bugs.length === 0 && repositories.length > 0 && <button className="button button-primary" onClick={() => setShowReportForm(true)}>＋ Create your first report</button>}
                    {bugs.length === 0 && repositories.length === 0 && <button className="button button-primary" onClick={() => setShowRepositoryForm(true)}>＋ Add a repository</button>}
                  </div>
                ) : visibleBugs.map((bug) => (
                  <BugRow bug={bug} key={bug.id} onStatusChanged={(updated) => {
                    setBugs((current) => current.map((item) => item.id === updated.id ? updated : item));
                    setMetrics((current) => ({
                      ...current,
                      newReports: current.newReports + (updated.status === "NEW" ? 1 : 0) - (bug.status === "NEW" ? 1 : 0),
                      investigatingReports: current.investigatingReports + (updated.status === "INVESTIGATING" ? 1 : 0) - (bug.status === "INVESTIGATING" ? 1 : 0),
                    }));
                  }} />
                ))}
            </div>
            {totalPages > 1 && <div className="pagination">
                <span>Page {page + 1} of {totalPages}</span>
                <div><button className="button button-secondary" disabled={page === 0 || loading} onClick={() => setPage((current) => current - 1)}>Previous</button><button className="button button-secondary" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((current) => current + 1)}>Next</button></div>
            </div>}
            <p className="local-note"><span aria-hidden="true">ⓘ</span> Repository records are local for now. GitHub connection and automated investigation are not enabled yet.</p>
          </section>
        </div>
      </main>
      {showRepositoryForm && <RepositoryDialog onClose={() => setShowRepositoryForm(false)} onCreated={(repository) => { setRepositories((current) => [repository, ...current]); setShowRepositoryForm(false); }} />}
      {showReportForm && <ReportDialog repositories={repositories} onClose={() => setShowReportForm(false)} onCreated={(bug) => {
        setBugs((current) => [bug, ...current]);
        setMetrics((current) => ({
          ...current,
          totalReports: current.totalReports + 1,
          newReports: current.newReports + 1,
          highPriorityReports: current.highPriorityReports + (bug.severity === "HIGH" || bug.severity === "CRITICAL" ? 1 : 0),
        }));
        setPage(0);
        setShowReportForm(false);
      }} />}
    </div>
  );
}

function BugRow({ bug, onStatusChanged }: { bug: BugReport; onStatusChanged: (bug: BugReport) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");

  async function changeStatus(status: BugStatus) {
    setError("");
    try {
      onStatusChanged(await api.updateBugStatus(bug.id, status));
    } catch (reason) {
      setError(getErrorMessage(reason, "Could not update the report."));
    }
  }

  return (
    <article className="bug-row">
      <button aria-expanded={expanded} className="bug-row-main" onClick={() => setExpanded(!expanded)}>
        <span className={`severity-dot ${bug.severity.toLowerCase()}`} title={`${bug.severity.toLowerCase()} severity`} />
        <span className="bug-main-copy"><strong>{bug.title}</strong><span>{bug.repositoryName} <i>·</i> {formatDate(bug.createdAt)}</span></span>
        <span className={`severity-label ${bug.severity.toLowerCase()}`}>{bug.severity}</span>
        <span className={`status-pill ${bug.status.toLowerCase()}`}><i />{statusLabel(bug.status)}</span>
        <span aria-hidden="true" className="row-chevron">{expanded ? "⌄" : "›"}</span>
      </button>
      {expanded && (
        <div className="bug-detail">
          <p>{bug.description}</p>
          <div className="repro-box"><strong>Reproduction steps</strong><pre>{bug.reproductionSteps}</pre></div>
          <div className="status-control"><label htmlFor={`status-${bug.id}`}>Update status</label>
            <select id={`status-${bug.id}`} onChange={(event) => void changeStatus(event.target.value as BugStatus)} value={bug.status}>
              {(["NEW", "INVESTIGATING", "RESOLVED", "CLOSED"] as BugStatus[]).map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </select>
          </div>
          {error && <p className="inline-error" role="alert">{error}</p>}
        </div>
      )}
    </article>
  );
}

function RepositoryDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (repository: Repository) => void }) {
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      onCreated(await api.createRepository(fullName));
    } catch (reason) {
      setError(getErrorMessage(reason, "Could not add that repository."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog title="Add a repository" onClose={onClose}>
      <p className="muted dialog-intro">Create a local workspace label using <code>owner/repository</code>. This does not connect to GitHub yet.</p>
      <form className="form-stack" onSubmit={submit}>
        <label>Repository name<input autoFocus maxLength={240} onChange={(event) => setFullName(event.target.value)} placeholder="acme/web-app" required value={fullName} /></label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="dialog-actions"><button className="button button-secondary" onClick={onClose} type="button">Cancel</button><button className="button button-primary" disabled={busy} type="submit">{busy ? "Adding…" : "Add repository"}</button></div>
      </form>
    </Dialog>
  );
}

function ReportDialog({ repositories, onClose, onCreated }: { repositories: Repository[]; onClose: () => void; onCreated: (bug: BugReport) => void }) {
  const [repositoryId, setRepositoryId] = useState(repositories[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reproductionSteps, setReproductionSteps] = useState("");
  const [severity, setSeverity] = useState<Severity>("MEDIUM");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      onCreated(await api.createBug({ repositoryId, title, description, reproductionSteps, severity }));
    } catch (reason) {
      setError(getErrorMessage(reason, "Could not create the bug report."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog title="New bug report" onClose={onClose}>
      <p className="muted dialog-intro">Capture what happened and how to reproduce it. No analysis runs automatically.</p>
      <form className="form-stack report-form" onSubmit={submit}>
        <label>Repository<select onChange={(event) => setRepositoryId(event.target.value)} required value={repositoryId}>{repositories.map((repository) => <option key={repository.id} value={repository.id}>{repository.fullName}</option>)}</select></label>
        <label>Title<input autoFocus maxLength={180} onChange={(event) => setTitle(event.target.value)} placeholder="What went wrong?" required value={title} /></label>
        <label>Description<textarea maxLength={12000} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the unexpected behavior…" required rows={3} value={description} /></label>
        <label>Reproduction steps<textarea maxLength={12000} onChange={(event) => setReproductionSteps(event.target.value)} placeholder={"1. Go to…\n2. Click…\n3. See the error"} required rows={4} value={reproductionSteps} /></label>
        <label>Severity<select onChange={(event) => setSeverity(event.target.value as Severity)} value={severity}>{(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as Severity[]).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="dialog-actions"><button className="button button-secondary" onClick={onClose} type="button">Cancel</button><button className="button button-primary" disabled={busy} type="submit">{busy ? "Saving…" : "Create report"}</button></div>
      </form>
    </Dialog>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section aria-labelledby="dialog-title" aria-modal="true" className="dialog" role="dialog">
        <div className="dialog-heading"><div><div className="eyebrow">WORKSPACE</div><h2 id="dialog-title">{title}</h2></div><button aria-label="Close dialog" className="icon-button" onClick={onClose}>×</button></div>
        {children}
      </section>
    </div>
  );
}

function Brand() {
  return <div className="brand"><span className="brand-mark"><span>⌘</span></span><span>bugdetect<span className="brand-ai">.ai</span></span></div>;
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function statusLabel(status: BugStatus | "ALL") {
  return status === "ALL" ? "All reports" : status.charAt(0) + status.slice(1).toLowerCase().replace("_", " ");
}
