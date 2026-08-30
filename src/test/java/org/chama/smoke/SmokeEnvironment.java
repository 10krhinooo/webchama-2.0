package org.chama.smoke;

import java.util.Arrays;
import java.util.List;

/**
 * Where the smoke journeys point and who they sign in as.
 *
 * <p>Every value comes from a system property that the {@code smoke} Maven profile forwards into
 * the forked JVM, so the same journeys can be aimed at the local docker-compose.e2e.yml stack or
 * at whatever ports CI publishes without editing a test.
 */
final class SmokeEnvironment {

    private SmokeEnvironment() {
    }

    /** The nginx-served SPA, which is the deployment artifact rather than a dev server. */
    static String baseUrl() {
        return property("smoke.baseUrl", "http://localhost:5174");
    }

    /**
     * Keycloak, which must be reached on the same hostname as the app.
     *
     * <p>Cookies are scoped by host and not by port, which is what lets the Keycloak session
     * cookie be visible to the app's origin over plain HTTP. Reaching one on {@code localhost} and
     * the other on {@code 127.0.0.1} splits the cookie jar, and silent re-authentication then
     * fails with nothing pointing at the cause.
     */
    static String keycloakUrl() {
        return property("smoke.keycloakUrl", "http://localhost:8181");
    }

    /**
     * An explicit browser executable, for hosts where the one on PATH is not one Selenium can
     * launch. Ubuntu's /usr/bin/firefox, for instance, is a shell wrapper around the snap; the real
     * executable lives under /snap/firefox/current/usr/lib/firefox/firefox.
     */
    static String binary(SmokeBrowser browser) {
        return System.getProperty("smoke." + browser + "Binary", "");
    }

    static boolean headless() {
        return Boolean.parseBoolean(property("smoke.headless", "true"));
    }

    static List<SmokeBrowser> browsers() {
        return Arrays.stream(property("smoke.browsers", "chrome,firefox").split(","))
            .map(String::trim)
            .filter(name -> !name.isEmpty())
            .map(SmokeBrowser::of)
            .toList();
    }

    /**
     * The demo realm derives each seed user's password from their own username: capitalised, then
     * an exclamation mark. Deriving it here keeps this file describing the convention rather than
     * holding a second copy of credentials that already live in keycloak/realm-chama.json.
     */
    static String seedPassword(String username) {
        return Character.toUpperCase(username.charAt(0)) + username.substring(1) + "!";
    }

    /**
     * The platform admin is the one account outside that convention. Its password is substituted
     * into the realm import at container start from CHAMA_SUPERADMIN_PASSWORD, which
     * docker-compose.e2e.yml pins.
     */
    static String superadminPassword() {
        return property("smoke.superadminPassword", "Superadmin1!");
    }

    private static String property(String key, String fallback) {
        String value = System.getProperty(key);
        return value == null || value.isBlank() ? fallback : value;
    }
}
