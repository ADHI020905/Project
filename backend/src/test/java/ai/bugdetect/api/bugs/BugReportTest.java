package ai.bugdetect.api.bugs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class BugReportTest {
    @Test
    void allowsExpectedStatusTransitions() {
        var report = new BugReport(null, null, "Title", "Description", "Steps", BugSeverity.MEDIUM);

        report.transitionTo(BugStatus.INVESTIGATING);
        assertEquals(BugStatus.INVESTIGATING, report.getStatus());

        report.transitionTo(BugStatus.RESOLVED);
        assertEquals(BugStatus.RESOLVED, report.getStatus());

        report.transitionTo(BugStatus.INVESTIGATING);
        report.transitionTo(BugStatus.CLOSED);
        assertEquals(BugStatus.CLOSED, report.getStatus());
    }

    @Test
    void rejectsReopeningClosedReport() {
        var report = new BugReport(null, null, "Title", "Description", "Steps", BugSeverity.MEDIUM);
        report.transitionTo(BugStatus.CLOSED);

        assertThrows(IllegalStateException.class, () -> report.transitionTo(BugStatus.NEW));
    }
}
