package org.chama.smoke;

import org.junit.jupiter.api.AfterEach;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedCondition;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Comparator;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Shared driver lifecycle and sign-in for the cross-browser smoke journeys.
 *
 * <p>These are plain JUnit 5 tests, deliberately not {@code @QuarkusTest}. They drive a stack that
 * is already running in Docker, so booting a second Quarkus in-process would start a competing
 * application, re-run Flyway against a database it does not own, and prove nothing about the
 * deployed artifact. Nothing here is on the classpath of a normal {@code mvn verify} run either:
 * the whole package only executes under {@code -Psmoke}.
 *
 * <p>Scope is strictly what a Chromium-only Playwright suite cannot observe. Everything the two
 * engines agree on is covered far more cheaply in {@code e2e/specs}; what lives here is behaviour
 * that is known to diverge between engines, so each journey names the divergence it is watching.
 */
abstract class SmokeJourney {

    /** Long enough for a cold OIDC redirect chain on a CI runner, short enough to fail usefully. */
    private static final Duration TIMEOUT = Duration.ofSeconds(30);

    static final By STAFF_LAYOUT = By.cssSelector("[data-testid='staff-layout']");
    private static final By KEYCLOAK_USERNAME = By.id("username");

    static Stream<SmokeBrowser> browsers() {
        return SmokeEnvironment.browsers().stream();
    }

    /**
     * Where a journey that downloads something tells the browser to put it.
     *
     * <p>Deliberately inside the build directory rather than a JUnit temporary directory. On Ubuntu
     * the packaged Firefox is a snap, and its AppArmor profile silently refuses to write anywhere
     * under /tmp: the download simply never appears, with nothing in the log to say why.
     */
    Path downloadDirectory;

    private WebDriver driver;
    private WebDriverWait wait;

    /**
     * Starts the engine under test. Called as the first statement of each journey rather than in a
     * setup hook, because the browser is the parameter and a hook cannot see it.
     */
    WebDriver start(SmokeBrowser browser) {
        downloadDirectory = freshDownloadDirectory(browser);
        driver = browser.start(downloadDirectory);
        wait = new WebDriverWait(driver, TIMEOUT);
        return driver;
    }

    @AfterEach
    void quit() {
        if (driver != null) {
            driver.quit();
            driver = null;
        }
    }

    private Path freshDownloadDirectory(SmokeBrowser browser) {
        Path directory = Path.of("target", "smoke-downloads", getClass().getSimpleName() + "-" + browser);
        try {
            if (Files.exists(directory)) {
                try (Stream<Path> entries = Files.walk(directory)) {
                    for (Path path : entries.sorted(Comparator.reverseOrder()).toList()) {
                        Files.delete(path);
                    }
                }
            }
            return Files.createDirectories(directory);
        } catch (IOException e) {
            throw new UncheckedIOException("Could not prepare " + directory, e);
        }
    }

    String app(String path) {
        return SmokeEnvironment.baseUrl() + path;
    }

    WebElement visible(By locator) {
        return wait.until(ExpectedConditions.visibilityOfElementLocated(locator));
    }

    <T> T until(ExpectedCondition<T> condition) {
        return wait.until(condition);
    }

    /** Navigates to a protected route and waits for Keycloak's own login form to be interactive. */
    void openLoginForm() {
        driver.get(app("/my-chamas"));
        wait.until(ExpectedConditions.urlContains("/realms/chama/protocol/openid-connect/auth"));
        visible(KEYCLOAK_USERNAME);
    }

    /**
     * Signs in through the real login form.
     *
     * <p>There is no shortcut available: the webchama-frontend client has direct access grants
     * disabled, so a password grant cannot mint a token, and keycloak-js keeps the token in memory
     * only, so there is nothing to inject either. Every journey therefore pays for one real login,
     * which is also the thing most worth checking in a second engine.
     */
    void signIn(String username, String password) {
        openLoginForm();
        driver.findElement(KEYCLOAK_USERNAME).sendKeys(username);
        driver.findElement(By.id("password")).sendKeys(password);
        driver.findElement(By.id("kc-login")).click();

        // Wait for the app to report itself authenticated rather than merely for the URL to
        // change. The redirect back lands before check-sso has settled, so asserting on the URL
        // alone passes against a page that is still anonymous.
        wait.until(ExpectedConditions.not(ExpectedConditions.urlContains("/realms/")));
        visible(STAFF_LAYOUT);
    }

    /**
     * Asserts a condition holds continuously for a stretch of wall clock, rather than at least
     * once.
     *
     * <p>Sleeping is the point here and not a workaround: what these journeys check is that a
     * background timer running inside the browser has not torn the session down, and that can only
     * be observed by letting the timer fire.
     */
    void staysTrueFor(Duration duration, String message, ExpectedCondition<Boolean> condition) {
        long deadline = System.nanoTime() + duration.toNanos();
        do {
            assertTrue(Boolean.TRUE.equals(condition.apply(driver)), message);
            try {
                Thread.sleep(500);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Interrupted while holding a stability assertion", interrupted);
            }
        } while (System.nanoTime() < deadline);
    }
}
