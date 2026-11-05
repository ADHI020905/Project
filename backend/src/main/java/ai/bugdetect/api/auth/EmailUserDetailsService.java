package ai.bugdetect.api.auth;

import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class EmailUserDetailsService implements UserDetailsService {
    private final UserAccountRepository users;

    public EmailUserDetailsService(UserAccountRepository users) {
        this.users = users;
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        var account = users.findByEmail(email)
            .orElseThrow(() -> new UsernameNotFoundException("Invalid email or password"));
        return User.withUsername(account.getEmail())
            .password(account.getPasswordHash())
            .roles("USER")
            .build();
    }
}
