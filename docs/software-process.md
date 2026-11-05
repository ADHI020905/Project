# BUGDETECT AI — Software Development Process

> **Status: proposed process.** This document defines a recommended way to build, verify, release, and operate BUGDETECT AI. It is not evidence that a team, CI pipeline, or deployment system already exists. The repository now includes an initial account and bug-report application slice; see the [README](../README.md) for implemented scope.

## 1. Purpose and principles

Use this process to deliver BUGDETECT AI in small, reviewable increments while protecting repository owners, users, and the systems that execute untrusted code. It complements [the Phase 1 architecture](architecture.md); it does not replace detailed feature requirements, threat models, API contracts, or operational runbooks.

The process is guided by these principles:

- **Evidence before claims:** acceptance criteria and test results must be observable. A model-generated explanation is not proof that a defect was diagnosed or fixed.
- **Secure by default:** least privilege, resource-level authorization, secret minimization, and bounded execution apply from the first implementation phase.
- **Humans control code changes:** generated patches remain proposals. No workflow automatically merges or deploys them.
- **Durable state, recoverable work:** asynchronous actions must survive retries and restarts without silently duplicating effects.
- **Small changes, early feedback:** implement in vertical slices; review and test close to the change rather than deferring integration.
- **Explicit operational ownership:** every launched capability has monitoring, resource limits, retention, support, and a rollback or disable path.
- **Planned is not shipped:** architecture and roadmap text describe intent. Mark a capability implemented only after its acceptance evidence is met.

## 2. Roles and decision ownership

One person may hold multiple roles in a small team, but each responsibility must be covered.

| Role | Responsibility |
|---|---|
| Product owner | Sets user outcomes, priority, acceptance criteria, and decisions about user-visible behavior. |
| Technical lead / architecture owner | Maintains component boundaries and contracts, reviews material design changes, and resolves cross-service decisions. |
| Feature owner | Delivers a scoped increment end to end, including tests, documentation, migration and operational implications. |
| Reviewer | Independently checks correctness, maintainability, scope, tests, and failure behavior before integration. |
| Security/privacy reviewer | Reviews authentication, authorization, GitHub permissions, sensitive-data flows, agent tools, artifact handling, and sandbox changes according to risk. This may be a designated reviewer or an explicitly recorded threat review. |
| Release/operator owner | Verifies deployment readiness, configuration and secrets, rollout, monitoring, rollback, and incident ownership. |
| AI workflow owner | Defines agent/tool permissions, evaluation datasets and criteria, model/provider changes, cost limits, and truthful reporting of uncertainty. |

The author should not be the only approver for security-sensitive changes. Repository code execution, credential handling, authorization, and sandbox isolation require review by someone other than the implementer before enabling the behavior.

## 3. Work item lifecycle

Every feature, defect, or operational change should move through the following lifecycle. A work item may return to an earlier step when evidence invalidates an assumption.

### 3.1 Intake and triage

Record:

- the user or operator problem and intended outcome;
- affected users, data, services, and trust boundaries;
- priority and dependencies, including the relevant roadmap phase;
- explicit non-goals and known unknowns;
- privacy, security, safety, availability, cost, and migration impact.

For defects, capture reproducible conditions, expected versus actual behavior, severity/impact, and relevant sanitized evidence. Do not include credentials, private source, or personal data in tickets unless strictly necessary and access-controlled.

Triage assigns an owner and chooses whether the work is a feature, defect, security issue, incident, or architecture decision. Security incidents and active exploitation follow the incident process rather than waiting in the ordinary feature queue.

### 3.2 Discovery and requirements

Before implementation, express behavior as testable acceptance criteria. Include:

- authorized and unauthorized cases;
- success, validation, timeout, cancellation, retry, and partial-failure outcomes;
- state transitions and idempotency expectations for asynchronous work;
- data retention and deletion effects;
- user-facing uncertainty, error, and recovery behavior;
- operational signals and resource ceilings for new background work.

Identify API/schema changes and update the applicable contract before parallel consumers depend on it. If the change affects a trust boundary, model/tool permissions, credentials, repository access, generated patches, or code execution, add or update the threat analysis before implementation.

### 3.3 Design and readiness

Use a short design note or an architecture decision record when a decision changes service ownership, persistence semantics, public contracts, threat assumptions, or an irreversible operational choice. Small local implementation choices need not create standalone design documents.

Confirm the data owner, API owner, authorization rule, failure behavior, test plan, migration/rollback plan, observability, and documentation updates. For AI workflows, also define allowed tools/data, output schema, evaluation criteria, retry/cost limits, and how the product distinguishes hypothesis from verified test evidence.

#### Definition of Ready

A work item is ready when:

- its outcome, scope, and acceptance criteria are clear;
- dependencies and affected services/contracts are identified;
- the approach respects the architecture or records an approved deviation;
- security/privacy and operational risks have an owner and review path;
- the verification strategy can demonstrate the acceptance criteria;
- open decisions that would materially change the implementation are resolved.

Do not treat “model confidence” or an agent's self-assessment as acceptance evidence.

### 3.4 Implementation

- Implement a focused vertical slice, preserving the Java API as the authority for product state and the Python worker as the orchestration/execution component.
- Keep public API behavior versioned and documented. Validate inputs at boundaries, use typed contracts between services, and return safe, stable errors.
- Enforce resource-level authorization in the server for every access path; frontend route guards are not authorization.
- For asynchronous work, commit domain state and outbox event together, publish durable messages, make consumers idempotent, and define retry/dead-letter behavior.
- Keep migrations forward-only and reviewable. Preserve existing data, make rollout order compatible with live application versions, and document a recovery strategy.
- Do not pass credentials or unrestricted tools to agents. Do not execute repository code in the API or worker process; use the approved broker/runner boundary.
- Add tests and necessary user/developer documentation in the same change. Do not add application capabilities that are merely described as planned in architecture docs without the relevant phase's security and operational gates.

### 3.5 Verification and review

Run the narrowest useful tests while developing, then all required checks for the affected component and contracts before requesting review. A pull request should be small enough to review, link its work item, explain user-visible effects, and include evidence for acceptance criteria.

Reviewers should verify:

- behavior against acceptance criteria and edge cases;
- authorization, data ownership, validation, and safe error handling;
- state transitions, transaction boundaries, idempotency, retries, cancellation, and cleanup;
- migration compatibility and rollback/forward-recovery needs;
- test quality and whether tests exercise the actual requirement rather than a proxy;
- secret handling, log content, resource ceilings, and operational signals;
- consistency of code, API contract, architecture, and user/developer documentation.

At least one independent approval is required before merge. Require an additional security/privacy approval when the change affects authentication, authorization, GitHub App access, sensitive data, agent/tool permissions, patch approval, artifact serving, sandboxing, or production secrets. A reviewer must not approve solely because CI is green.

### 3.6 Integration and completion

Merge only after required checks and approvals pass. Keep the primary branch in a releasable state. Resolve failures by fixing the cause or explicitly reverting/disabling the change; do not suppress a failing security or correctness check to make a merge green.

An item is complete only when its acceptance criteria are met, required tests pass, documentation and migration obligations are handled, operational ownership exists, and the implementation status is accurately reflected. If rollout is intentionally deferred, record the remaining release gate and do not claim the feature is available.

## 4. Branch, pull request, and change management

Use the repository's configured naming and merge policy when one is established. Until then, prefer short-lived branches named for the work item, one logical change per pull request, and frequent synchronization with the primary branch. Avoid long-lived feature branches and unrelated cleanup mixed into behavior changes.

A pull request should contain:

1. **Purpose and scope:** linked work item, user impact, and explicit non-goals.
2. **Design:** relevant decisions, data/API changes, trust-boundary changes, and compatibility considerations.
3. **Verification:** commands/checks run and their outcomes; note checks not run and why.
4. **Operations:** configuration/secrets, migration, rollout, monitoring, and rollback or disable plan where applicable.
5. **Evidence:** screenshots or representative outputs only when useful and safe; redact private data and credentials.

Do not commit credentials, private keys, provider tokens, real user data, or sensitive repository artifacts. Never amend or rewrite shared history as a substitute for an ordinary corrective commit unless the repository's explicit policy calls for it.

## 5. Verification strategy

Verification is layered. Each layer should have a clear owner, fast feedback path, and failure policy.

| Layer | What it verifies | Examples for this architecture |
|---|---|---|
| Static checks | Basic correctness and maintainability | Format, lint, type-check, dependency/license policy, secret scanning. |
| Unit tests | Local rules and deterministic behavior | Java domain/state/auth policy; Python schema, graph transitions, tool policy; React components and validation. |
| Contract tests | Compatibility across service boundaries | OpenAPI request/response/error behavior; versioned worker messages; event payloads; outbox and webhook contracts. |
| Integration tests | Persistence and infrastructure semantics | PostgreSQL constraints/migrations/transactions; outbox publication; RabbitMQ redelivery and dead-letter behavior; authenticated API/resource access. |
| End-to-end tests | User-visible journeys across services | Connect authorized repository, submit report, observe investigation status, review evidence and patch, make approval decision. Use controlled repositories and test credentials. |
| Security tests | Resistance at trust boundaries | Authorization matrix/IDOR tests, webhook signature and replay tests, refresh-token rotation/revocation, upload bounds, prompt-injection/tool-policy tests, secret/log scanning. |
| Sandbox assurance | Limits and isolation hold under hostile workloads | Network denial, timeout and quota enforcement, cancellation/cleanup, workspace isolation, artifact validation, and periodic escape/abuse testing by qualified reviewers. |
| Operational checks | Recoverability and safe service behavior | Health/readiness, queue backlog alerts, database restore exercise, migration rehearsal, rate/cost limit checks, and rollback/disable drills. |

Use deterministic fixtures and fakes for ordinary unit tests; do not call production model providers or GitHub from the unit-test suite. Integration tests that use external providers must be separately marked, use dedicated least-privilege test credentials, redact outputs, and have explicit cost limits.

### AI workflow evaluation

Changes to prompts, models, agent graphs, retrieval, tools, or output schemas require a repeatable evaluation appropriate to their risk:

- maintain a reviewed set of representative, minimized cases, including ambiguous reports, unsupported frameworks, misleading repository instructions, malformed model output, and negative/security cases;
- measure evidence citation quality, task completion, false-positive/false-confidence behavior, policy/tool violations, latency, and cost against explicit thresholds;
- compare new behavior with the current approved baseline and record model/provider/version and configuration;
- verify that missing or failed test output is never converted into a passing claim, and that hypotheses remain distinguishable from verified behavior;
- test deterministic safety rules independently of model evaluation. Model scores cannot replace access-control, sandbox, or human-approval gates.

Do not include proprietary source or sensitive user data in evaluation corpora without authorization, minimization, access controls, and an approved retention policy.

## 6. Security and privacy gates

Security review is proportional to impact, with mandatory gates before capabilities cross these boundaries:

| Capability/change | Required gate before release |
|---|---|
| Authentication/session handling | Threat review of credential lifecycle, storage, CSRF, revocation, key rotation, abuse/rate controls, and negative authorization tests. |
| Repository connection/webhooks | Least-privilege GitHub permission review, callback state/replay protection, raw-body signature verification, delivery deduplication, and token/log redaction checks. |
| Agent/model/tool change | Data-flow and prompt-injection review, minimum tool/data permissions, schema/path validation, provider retention review, evaluation results, and cost limits. |
| Patch creation/approval | Isolated workspace, exact diff/scope review, reviewer path, durable actor-attributed approval/rejection, and proof that approval does not silently merge or deploy. |
| Repository code execution | Dedicated broker/runner threat review, default-deny network, resource-limit and cleanup tests, no application/worker runtime socket, artifact controls, and stronger isolation decision for public/untrusted inputs. Do not launch before these pass. |
| Data retention/export | Data inventory, access checks, deletion behavior, retention schedule, backup/log impact, and privacy review. |
| Production release | Dependency/image scan, secret scan, SBOM/provenance/signing controls as available, least-privilege deployment credentials, monitoring, rollback, and incident owner. |

Record accepted residual risks with an accountable owner, rationale, compensating controls, and review/expiry date. A waiver must not turn a known unsafe default—such as exposing the container socket to an AI worker—into a release shortcut.

## 7. Data, API, and asynchronous change rules

### Database and migrations

- Every production schema change is represented by a reviewed, versioned Flyway migration; do not modify an already-applied migration.
- Use an expand/migrate/contract sequence for changes that span concurrently running versions: add compatible structures, deploy dual-compatible code, backfill/verify, switch reads/writes, and remove obsolete structures only after old code is gone.
- Add indexes/constraints deliberately and understand lock and table-rewrite behavior for the selected PostgreSQL version and data volume.
- Test migration from the latest released schema and a representative prior schema. Record backup/restore or forward-recovery needs; do not assume a migration can be reversed safely.
- Keep raw tokens, passwords, full prompts, unbounded logs, and large artifacts out of ordinary relational records.

### Public and internal contracts

- Update OpenAPI and generated/client types with API behavior. Define compatibility, deprecation, pagination, error, and SSE replay semantics.
- Version worker/job schemas and reject unsupported or malformed messages safely. Deploy consumers before producers when adding compatible fields; use an explicit coordinated rollout for incompatible changes.
- Preserve request, event, job, and sandbox correlation identifiers across services without copying sensitive payloads into metadata.
- For webhook changes, verify signatures before accepting work, persist delivery identity for deduplication, and acknowledge only after durable acceptance.

### Asynchronous jobs

- Persist state change and outbox record atomically. The relay is retryable; consumers are idempotent; acknowledgment follows durable result handling.
- Specify ownership/lease behavior, timeout, retryable versus terminal failures, cancellation semantics, dead-letter handling, and operator redrive before adding a job type.
- Redriving a dead-letter job must be auditable, authorized, bounded, and safe against duplicate external effects.
- Expose queue depth, oldest-message age, retry/dead-letter counts, and stuck-job alerts. Reconciliation must detect records left inconsistent by interrupted work.

## 8. Release and operations process

Production releases are gated on the target phase's acceptance evidence, approved change, successful checks, compatible migration plan, monitoring, and an identified operator.

1. **Prepare:** confirm artifact identity and provenance, configuration/secrets, migration compatibility, dependency/image findings, capacity and cost budgets, and release notes.
2. **Deploy safely:** use the environment's approved staged/canary or rolling strategy where supported. Keep changes backward-compatible across the rollout; do not enable untrusted code execution merely because the service deployed.
3. **Observe:** monitor availability, errors, authorization denials, queue latency/backlog, stuck jobs, model/provider cost and latency, sandbox resource use/cleanup, artifact failures, and database health.
4. **Decide:** continue only while agreed service and security indicators remain within thresholds. Stop rollout or disable the affected capability on regression or security concern.
5. **Recover:** use a tested rollback, feature disable, forward migration, key/token revocation, or queue pause as appropriate. Preserve audit evidence without leaking sensitive data.
6. **Learn:** document material incidents and near misses, identify corrective actions with owners, and feed systemic findings into requirements, threat models, tests, and runbooks.

Define numerical service-level objectives, alert thresholds, retention periods, and recovery targets before production operation; this document intentionally does not invent targets without workload and business requirements.

### Incident handling

For suspected credential exposure, unauthorized repository access, sandbox escape, sensitive artifact disclosure, or unsafe automated behavior:

- contain first: disable the affected integration/job type, pause queue consumption, revoke credentials, or isolate runners as appropriate;
- preserve relevant access-controlled audit and operational evidence while restricting further disclosure;
- notify the designated security/operations owner and follow applicable customer, legal, and regulatory notification requirements;
- determine scope and user/data impact; do not rely solely on model-generated incident summaries;
- recover only after the risk is understood and required controls are verified;
- record root causes and track corrective actions through the normal reviewed process.

## 9. BUGDETECT AI phase gates

The roadmap phases in `architecture.md` are sequential capability milestones, not promises of release dates. Each phase should end with reviewable evidence before its dependent capability is enabled.

| Phase | Process gate |
|---|---|
| 1 — Architecture and system design | Architecture, trust boundaries, logical model, API outline, workflow, security/sandbox design, risks, and this delivery process are reviewed. |
| 2 — Database/backend foundation | Migration and transaction tests pass; authorization foundations and outbox delivery/idempotency are demonstrated before asynchronous product work is enabled. |
| 3 — Frontend/authentication | Credential/session policy is reviewed; authenticated and unauthorized paths pass; frontend is not treated as an access-control boundary. |
| 4 — GitHub App | Permission review, callback protections, signature/replay tests, and credential-redaction checks pass using a controlled test installation. |
| 5 — Repository analysis | Access stays within authorized repositories; evidence is attributable to source; resource and data limits are verified. |
| 6 — Agent orchestration | Contracts, redelivery/idempotency, state recovery, retry budgets, cost limits, and provider-data controls are tested. |
| 7 — Bug investigation | State transitions, cancellation, evidence/uncertainty display, resource authorization, and SSE reconnect/status recovery work. |
| 8 — Test generation | Generated tests are treated as untrusted; evaluation and validation distinguish proposed tests from executed results. |
| 9 — Patch generation | Patch scope is bounded, isolated, reviewable, and cannot write directly to the user's repository or merge automatically. |
| 10 — Sandbox | Security and abuse tests, resource quotas, default-deny network, artifact validation, cancellation/cleanup, and appropriate isolation review pass before untrusted code runs. |
| 11 — Review and validation | Reviewer and human approval controls work; baseline/candidate results are truthful, reproducible enough for the declared claim, and auditable. |
| 12 — Dashboard/reporting | Aggregates and artifacts enforce the same resource-level access controls as underlying data. |
| 13 — Security/deployment | Production threat review, operations runbooks, retention, secrets, supply-chain checks, backup/recovery, monitoring, release/rollback drills, and ownership are complete. |

## 10. Process health and continuous improvement

Use a small set of indicators to find bottlenecks and regressions, not to reward unsafe speed or inflate AI success:

- lead time from ready work to release and age of in-progress work;
- change failure, rollback, and escaped-defect rates;
- review turnaround and proportion of changes with acceptance evidence;
- test and migration failures, flaky-test rate, and time to restore a healthy build;
- queue age, duplicate/terminal job rates, retry/dead-letter volume, and stuck-work duration;
- authorization/security findings, incident response time, and overdue corrective actions;
- investigation completion, verified reproduction rate, inconclusive rate, patch rejection rate, and measured model/sandbox cost.

Interpret AI-related metrics with human-reviewed samples and confidence intervals where appropriate. Do not optimize for patches generated, “bugs fixed,” or test pass counts without validating correctness and safety.

Review this process after major incidents, a material architecture change, or repeated delivery friction. Changes to required security gates need explicit technical/security ownership and must preserve the baseline protections described here.

## 11. Process exceptions

An exception must identify the exact requirement being waived, why it cannot be met, affected users/data/services, compensating controls, approver, expiration/review date, and remediation owner. Exceptions are documented and auditable. Do not waive authentication, resource-level authorization, secret handling, or safe isolation requirements to meet a delivery date; defer or disable the affected capability instead.
