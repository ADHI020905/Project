package ai.bugdetect.api.bugs;

import java.util.Optional;
import java.util.Collection;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BugReportStore extends JpaRepository<BugReport, UUID> {
    long countByRepository_Owner_Id(UUID ownerId);
    long countByRepository_Owner_IdAndStatus(UUID ownerId, BugStatus status);
    long countByRepository_Owner_IdAndSeverityIn(UUID ownerId, Collection<BugSeverity> severities);

    @EntityGraph(attributePaths = "repository")
    Page<BugReport> findAllByRepository_Owner_Id(UUID ownerId, Pageable pageable);

    @EntityGraph(attributePaths = "repository")
    Optional<BugReport> findByIdAndRepository_Owner_Id(UUID bugId, UUID ownerId);
}
