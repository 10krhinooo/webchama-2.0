package org.chama.security;

import io.quarkus.security.identity.SecurityIdentity;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.context.RequestScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.jwt.JsonWebToken;

@ApplicationScoped
public class CurrentUserProducer {

    @Inject
    SecurityIdentity identity;

    @Produces
    @RequestScoped
    public CurrentUser currentUser() {
        if (identity.isAnonymous()) {
            return new CurrentUser(null, false);
        }
        return new CurrentUser(jwtSubject(), identity.getRoles().contains("SUPER_ADMIN"));
    }

    private String jwtSubject() {
        try {
            return ((JsonWebToken) identity.getPrincipal()).getSubject();
        } catch (ClassCastException e) {
            return identity.getPrincipal().getName();
        }
    }
}
