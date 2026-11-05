CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(320) NOT NULL UNIQUE,
    display_name VARCHAR(80) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE repositories (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(120) NOT NULL,
    full_name VARCHAR(240) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_repositories_owner_full_name UNIQUE (owner_id, full_name)
);

CREATE INDEX idx_repositories_owner_created
    ON repositories (owner_id, created_at DESC);

CREATE TABLE bug_reports (
    id UUID PRIMARY KEY,
    repository_id UUID NOT NULL REFERENCES repositories(id),
    reporter_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(180) NOT NULL,
    description VARCHAR(12000) NOT NULL,
    reproduction_steps VARCHAR(12000) NOT NULL,
    severity VARCHAR(16) NOT NULL,
    status VARCHAR(24) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT chk_bug_reports_severity
        CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    CONSTRAINT chk_bug_reports_status
        CHECK (status IN ('NEW', 'INVESTIGATING', 'RESOLVED', 'CLOSED'))
);

CREATE INDEX idx_bug_reports_repository_created
    ON bug_reports (repository_id, created_at DESC);

CREATE INDEX idx_bug_reports_reporter_created
    ON bug_reports (reporter_id, created_at DESC);
