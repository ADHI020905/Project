package ai.bugdetect.api.dashboard;

import ai.bugdetect.api.auth.UserAccountRepository;
import ai.bugdetect.api.bugs.BugReportStore;
import ai.bugdetect.api.bugs.BugSeverity;
import ai.bugdetect.api.bugs.BugStatus;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {
    private final BugReportStore bugs;
    private final UserAccountRepository users;

    public DashboardController(BugReportStore bugs, UserAccountRepository users) {
        this.bugs = bugs;
        this.users = users;
    }

    @GetMapping("/metrics")
    public DashboardMetrics metrics(@AuthenticationPrincipal UserDetails principal) {
        var user = users.findByEmail(principal.getUsername())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        return new DashboardMetrics(
            bugs.countByRepository_Owner_Id(user.getId()),
            bugs.countByRepository_Owner_IdAndStatus(user.getId(), BugStatus.NEW),
            bugs.countByRepository_Owner_IdAndStatus(user.getId(), BugStatus.INVESTIGATING),
            bugs.countByRepository_Owner_IdAndSeverityIn(
                user.getId(),
                List.of(BugSeverity.HIGH, BugSeverity.CRITICAL)));
    }

    public record DashboardMetrics(
        long totalReports,
        long newReports,
        long investigatingReports,
        long highPriorityReports) {}
}
