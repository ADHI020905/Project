package ai.bugdetect.api.bugs;

import ai.bugdetect.api.auth.UserAccount;
import ai.bugdetect.api.repositories.ConnectedRepository;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "bug_reports")
public class BugReport {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "repository_id", nullable = false)
    private ConnectedRepository repository;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reporter_id", nullable = false)
    private UserAccount reporter;

    @Column(nullable = false, length = 180)
    private String title;

    @Column(nullable = false, length = 12000)
    private String description;

    @Column(name = "reproduction_steps", nullable = false, length = 12000)
    private String reproductionSteps;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private BugSeverity severity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private BugStatus status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected BugReport() {}

    public BugReport(
            ConnectedRepository repository,
            UserAccount reporter,
            String title,
            String description,
            String reproductionSteps,
            BugSeverity severity) {
        this.id = UUID.randomUUID();
        this.repository = repository;
        this.reporter = reporter;
        this.title = title;
        this.description = description;
        this.reproductionSteps = reproductionSteps;
        this.severity = severity;
        this.status = BugStatus.NEW;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    public void transitionTo(BugStatus nextStatus) {
        boolean allowed = switch (status) {
            case NEW -> nextStatus == BugStatus.INVESTIGATING || nextStatus == BugStatus.RESOLVED || nextStatus == BugStatus.CLOSED;
            case INVESTIGATING -> nextStatus == BugStatus.NEW || nextStatus == BugStatus.RESOLVED || nextStatus == BugStatus.CLOSED;
            case RESOLVED -> nextStatus == BugStatus.INVESTIGATING || nextStatus == BugStatus.CLOSED;
            case CLOSED -> false;
        };
        if (!allowed) {
            throw new IllegalStateException("Status transition is not allowed.");
        }
        this.status = nextStatus;
        this.updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public ConnectedRepository getRepository() {
        return repository;
    }

    public UserAccount getReporter() {
        return reporter;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public String getReproductionSteps() {
        return reproductionSteps;
    }

    public BugSeverity getSeverity() {
        return severity;
    }

    public BugStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
