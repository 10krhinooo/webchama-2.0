package org.chama.security;

/**
 * The caller's Keycloak identity for this request. Deliberately does not
 * carry a per-chama role, since realm roles are global to the user and a
 * per-chama role can only be resolved once a specific chama is known, see
 * TenantAccessService.
 *
 * Exposed only via getters, not public fields: this bean is injected as a
 * CDI client proxy (it is @RequestScoped, produced fresh per request), and a
 * proxy only delegates method calls to the real instance, not direct field
 * reads, which would silently read the proxy's own default field values.
 */
public class CurrentUser {

    private final String keycloakUserId;
    private final boolean superAdmin;

    public CurrentUser(String keycloakUserId, boolean superAdmin) {
        this.keycloakUserId = keycloakUserId;
        this.superAdmin = superAdmin;
    }

    public String getKeycloakUserId() {
        return keycloakUserId;
    }

    public boolean isSuperAdmin() {
        return superAdmin;
    }
}
