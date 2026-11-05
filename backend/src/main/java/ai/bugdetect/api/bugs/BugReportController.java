package ai.bugdetect.api.bugs;

import ai.bugdetect.api.auth.UserAccountRepository;
import ai.bugdetect.api.repositories.RepositoryStore;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/bugs")
public class BugReportController {
    private final BugReportStore bugs;
    private final RepositoryStore repositories;
    private final UserAccountRepository users;

    public BugReportController(
            BugReportStore bugs,
            RepositoryStore repositories,
            UserAccountRepository users) {
        this.bugs = bugs;
        this.repositories = repositories;
        this.users = users;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public BugResponse create(
            @AuthenticationPrincipal UserDetails principal,
            @Valid @RequestBody CreateBugRequest request) {
        var user = requireUser(principal.getUsername());
        var repository = repositories.findByIdAndOwner_Id(request.repositoryId(), user.getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Repository not found."));
        var saved = bugs.save(new BugReport(
            repository,
            user,
            request.title().trim(),
            request.description().trim(),
            request.reproductionSteps().trim(),
            request.severity()));
        return bugs.findByIdAndRepository_Owner_Id(saved.getId(), user.getId())
            .map(BugResponse::from)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR));
    }

    @GetMapping
    public PageResponse<BugResponse> list(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        if (page < 0 || size < 1 || size > 50) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Page must be non-negative and size must be between 1 and 50.");
        }
        var user = requireUser(principal.getUsername());
        var results = bugs.findAllByRepository_Owner_Id(
            user.getId(),
            PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return new PageResponse<>(
            results.map(BugResponse::from).getContent(),
            results.getNumber(),
            results.getSize(),
            results.getTotalElements(),
            results.getTotalPages());
    }

    @GetMapping("/{bugId}")
    public BugResponse get(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable UUID bugId) {
        var user = requireUser(principal.getUsername());
        return findOwned(bugId, user.getId());
    }

    @PatchMapping("/{bugId}")
    public BugResponse updateStatus(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable UUID bugId,
            @Valid @RequestBody UpdateBugStatusRequest request) {
        var user = requireUser(principal.getUsername());
        var bug = bugs.findByIdAndRepository_Owner_Id(bugId, user.getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Bug report not found."));
        try {
            bug.transitionTo(request.status());
        } catch (IllegalStateException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, exception.getMessage());
        }
        bugs.save(bug);
        return findOwned(bugId, user.getId());
    }

    private BugResponse findOwned(UUID bugId, UUID ownerId) {
        return bugs.findByIdAndRepository_Owner_Id(bugId, ownerId)
            .map(BugResponse::from)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Bug report not found."));
    }

    private ai.bugdetect.api.auth.UserAccount requireUser(String email) {
        return users.findByEmail(email)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }

    public record CreateBugRequest(
        @NotNull UUID repositoryId,
        @NotBlank @Size(max = 180) String title,
        @NotBlank @Size(max = 12000) String description,
        @NotBlank @Size(max = 12000) String reproductionSteps,
        @NotNull BugSeverity severity) {}

    public record UpdateBugStatusRequest(@NotNull BugStatus status) {}

    public record BugResponse(
        String id,
        String repositoryId,
        String repositoryName,
        String title,
        String description,
        String reproductionSteps,
        BugSeverity severity,
        BugStatus status,
        String createdAt,
        String updatedAt) {
        static BugResponse from(BugReport bug) {
            return new BugResponse(
                bug.getId().toString(),
                bug.getRepository().getId().toString(),
                bug.getRepository().getFullName(),
                bug.getTitle(),
                bug.getDescription(),
                bug.getReproductionSteps(),
                bug.getSeverity(),
                bug.getStatus(),
                bug.getCreatedAt().toString(),
                bug.getUpdatedAt().toString());
        }
    }

    public record PageResponse<T>(java.util.List<T> items, int page, int size, long totalItems, int totalPages) {}
}
