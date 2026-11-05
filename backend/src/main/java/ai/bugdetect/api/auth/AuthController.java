package ai.bugdetect.api.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.core.userdetails.UserDetails;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final UserAccountRepository users;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final SecurityContextRepository contextRepository;
    private final SessionAuthenticationStrategy sessionAuthenticationStrategy;

    public AuthController(
            UserAccountRepository users,
            PasswordEncoder passwordEncoder,
            AuthenticationManager authenticationManager,
            SecurityContextRepository contextRepository,
            SessionAuthenticationStrategy sessionAuthenticationStrategy) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.contextRepository = contextRepository;
        this.sessionAuthenticationStrategy = sessionAuthenticationStrategy;
    }

    @GetMapping("/csrf")
    public Map<String, String> csrf(CsrfToken csrfToken) {
        return Map.of("token", csrfToken.getToken());
    }

    @PostMapping("/register")
    public ResponseEntity<UserResponse> register(@Valid @RequestBody RegisterRequest request) {
        validateBcryptPasswordLength(request.password());
        var email = request.email().trim().toLowerCase(Locale.ROOT);
        if (users.existsByEmail(email)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        }
        var account = users.save(new UserAccount(
            email,
            request.displayName().trim(),
            passwordEncoder.encode(request.password())));
        return ResponseEntity.status(HttpStatus.CREATED).body(UserResponse.from(account));
    }

    @PostMapping("/login")
    public UserResponse login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest servletRequest,
            HttpServletResponse servletResponse) {
        if (request.password().getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new BadCredentialsException("Invalid email or password");
        }
        var email = request.email().trim().toLowerCase(Locale.ROOT);
        Authentication authentication = authenticationManager.authenticate(
            UsernamePasswordAuthenticationToken.unauthenticated(email, request.password()));
        sessionAuthenticationStrategy.onAuthentication(authentication, servletRequest, servletResponse);

        SecurityContextHolderStrategy strategy = SecurityContextHolder.getContextHolderStrategy();
        SecurityContext context = strategy.createEmptyContext();
        context.setAuthentication(authentication);
        strategy.setContext(context);
        contextRepository.saveContext(context, servletRequest, servletResponse);

        return users.findByEmail(email)
            .map(UserResponse::from)
            .orElseThrow();
    }

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal UserDetails principal) {
        return users.findByEmail(principal.getUsername())
            .map(UserResponse::from)
            .orElseThrow();
    }

    public record RegisterRequest(
        @NotBlank @Email @Size(max = 320) String email,
        @NotBlank @Size(min = 12, max = 72) String password,
        @NotBlank @Size(min = 1, max = 80) String displayName) {}

    public record LoginRequest(
        @NotBlank @Email @Size(max = 320) String email,
        @NotBlank @Size(max = 72) String password) {}

    public record UserResponse(String id, String email, String displayName) {
        static UserResponse from(UserAccount account) {
            return new UserResponse(account.getId().toString(), account.getEmail(), account.getDisplayName());
        }
    }

    private void validateBcryptPasswordLength(String password) {
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new org.springframework.web.server.ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Password must be no more than 72 UTF-8 bytes.");
        }
    }
}
