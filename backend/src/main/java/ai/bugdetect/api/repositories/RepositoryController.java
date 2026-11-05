package ai.bugdetect.api.repositories;

import ai.bugdetect.api.auth.UserAccountRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/repositories")
public class RepositoryController {
    private final RepositoryStore repositories;
    private final UserAccountRepository users;

    public RepositoryController(RepositoryStore repositories, UserAccountRepository users) {
        this.repositories = repositories;
        this.users = users;
    }

    @GetMapping
    public List<RepositoryResponse> list(@AuthenticationPrincipal UserDetails principal) {
        var owner = requireUser(principal.getUsername());
        return repositories.findAllByOwner_IdOrderByCreatedAtDesc(owner.getId())
            .stream()
            .map(RepositoryResponse::from)
            .toList();
    }

    @PostMapping
    @org.springframework.web.bind.annotation.ResponseStatus(HttpStatus.CREATED)
    public RepositoryResponse create(
            @AuthenticationPrincipal UserDetails principal,
            @Valid @RequestBody CreateRepositoryRequest request) {
        var owner = requireUser(principal.getUsername());
        var fullName = request.fullName().trim().toLowerCase();
        if (repositories.existsByOwner_IdAndFullNameIgnoreCase(owner.getId(), fullName)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Repository is already registered.");
        }
        var parts = fullName.split("/", -1);
        var repository = repositories.save(new ConnectedRepository(owner, parts[1], fullName));
        return RepositoryResponse.from(repository);
    }

    private ai.bugdetect.api.auth.UserAccount requireUser(String email) {
        return users.findByEmail(email)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }

    public record CreateRepositoryRequest(
        @NotBlank
        @Size(max = 240)
        @Pattern(regexp = "^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", message = "Use owner/repository format.")
        String fullName) {}

    public record RepositoryResponse(String id, String fullName, String createdAt) {
        static RepositoryResponse from(ConnectedRepository repository) {
            return new RepositoryResponse(
                repository.getId().toString(),
                repository.getFullName(),
                repository.getCreatedAt().toString());
        }
    }
}
