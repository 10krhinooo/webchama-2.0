package org.chama.smoke;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WindowType;
import org.openqa.selenium.support.ui.ExpectedConditions;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The single-sign-on session, which is the highest-value thing in this suite.
 *
 * <p>The SPA and Keycloak sit on different ports of the same host, so every cookie the session
 * depends on is third-party from the app's point of view. keycloak-js then keeps a hidden iframe
 * pointed at Keycloak's login-status endpoint and polls it every five seconds; if that iframe
 * cannot read the session cookie, the library concludes the user signed out elsewhere and tears
 * the session down.
 *
 * <p>Chromium is the permissive engine here. Firefox ships Total Cookie Protection, which
 * partitions storage per top-level site and targets exactly this pattern, and Safari's ITP does
 * something similar. A Chromium-only suite cannot see any of it, and the failure mode in the field
 * is a user who gets bounced back to the login page a few seconds after signing in.
 */
class SsoSessionSmokeIT extends SmokeJourney {

    private static final By KEYCLOAK_USERNAME = By.id("username");

    /**
     * Two full checkLoginIframe poll intervals plus room for a slow round trip. One interval would
     * pass against a session that is torn down on the very next tick.
     */
    private static final Duration BEYOND_TWO_POLLS = Duration.ofSeconds(13);

    @ParameterizedTest(name = "the session survives the login-status poll in {0}")
    @MethodSource("org.chama.smoke.SmokeJourney#browsers")
    void theSessionSurvivesTheLoginStatusPoll(SmokeBrowser browser) {
        start(browser);
        signIn("member1", SmokeEnvironment.seedPassword("member1"));

        staysTrueFor(BEYOND_TWO_POLLS,
            "The session was dropped while idling, which is what a partitioned login-status "
                + "cookie looks like from the outside.",
            driver -> !driver.getCurrentUrl().contains("/realms/")
                && !driver.findElements(STAFF_LAYOUT).isEmpty());
    }

    @ParameterizedTest(name = "a second tab authenticates without a second login in {0}")
    @MethodSource("org.chama.smoke.SmokeJourney#browsers")
    void aSecondTabAuthenticatesWithoutASecondLogin(SmokeBrowser browser) {
        WebDriver driver = start(browser);
        signIn("chairperson1", SmokeEnvironment.seedPassword("chairperson1"));

        driver.switchTo().newWindow(WindowType.TAB);
        driver.get(app("/chamas"));

        // check-sso still round-trips through Keycloak, so the URL does touch /realms/ on the way.
        // What must not happen is being asked for credentials again.
        visible(STAFF_LAYOUT);
        assertTrue(driver.findElements(KEYCLOAK_USERNAME).isEmpty(),
            "The second tab was asked to sign in again, so the SSO cookie did not survive.");
        until(ExpectedConditions.urlContains("/chamas"));
    }
}
