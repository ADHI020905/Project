package ai.bugdetect.api.repositories;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RepositoryStore extends JpaRepository<ConnectedRepository, UUID> {
    List<ConnectedRepository> findAllByOwner_IdOrderByCreatedAtDesc(UUID ownerId);
    Optional<ConnectedRepository> findByIdAndOwner_Id(UUID id, UUID ownerId);
    boolean existsByOwner_IdAndFullNameIgnoreCase(UUID ownerId, String fullName);
}
