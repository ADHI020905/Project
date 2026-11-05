package ai.bugdetect.api.repositories;

import ai.bugdetect.api.auth.UserAccount;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
    name = "repositories",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_repositories_owner_full_name",
        columnNames = {"owner_id", "full_name"}))
public class ConnectedRepository {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private UserAccount owner;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "full_name", nullable = false, length = 240)
    private String fullName;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected ConnectedRepository() {}

    public ConnectedRepository(UserAccount owner, String name, String fullName) {
        this.id = UUID.randomUUID();
        this.owner = owner;
        this.name = name;
        this.fullName = fullName;
        this.createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UserAccount getOwner() {
        return owner;
    }

    public String getName() {
        return name;
    }

    public String getFullName() {
        return fullName;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
