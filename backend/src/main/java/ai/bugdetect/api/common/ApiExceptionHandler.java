package ai.bugdetect.api.common;

import java.util.Map;
import java.util.TreeMap;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail validationError(MethodArgumentNotValidException exception) {
        var problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Request validation failed.");
        problem.setTitle("Invalid request");
        Map<String, String> fields = new TreeMap<>();
        exception.getBindingResult().getFieldErrors().forEach(error ->
            fields.putIfAbsent(error.getField(), error.getDefaultMessage()));
        problem.setProperty("fieldErrors", fields);
        return problem;
    }

    @ExceptionHandler(BadCredentialsException.class)
    ProblemDetail badCredentials() {
        return ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, "Invalid email or password.");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ProblemDetail conflict() {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, "The requested record conflicts with existing data.");
    }

    @ExceptionHandler(ResponseStatusException.class)
    ProblemDetail statusError(ResponseStatusException exception) {
        return ProblemDetail.forStatusAndDetail(exception.getStatusCode(), exception.getReason());
    }
}
