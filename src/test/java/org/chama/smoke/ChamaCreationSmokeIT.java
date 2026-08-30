package org.chama.smoke;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * A chairperson setting up a chama from nothing, which is the shortest path through the parts of
 * the SPA that are most likely to differ between engines: a Radix dialog and its focus handling, a
 * controlled telephone input from a third-party package, client-side routing with no page load,
 * and an EventSource opened against a streaming endpoint behind nginx.
 *
 * <p>The journey seeds its own data rather than reading the Playwright fixture, so
 * {@code -Psmoke} needs nothing beyond a freshly started stack. Each run creates one chama with a
 * unique name, and nothing else in the suite looks at it.
 */
class ChamaCreationSmokeIT extends SmokeJourney {

    /**
     * Records every EventSource the app opens, so the journey can tell the streaming path from the
     * ten second polling fallback that useActivityFeed drops to when EventSource is unavailable or
     * errors. Both paths eventually render the same feed, so asserting on the rendered rows alone
     * cannot distinguish them.
     */
    private static final String RECORD_EVENT_SOURCES = """
        window.__smokeStreams = [];
        const Native = window.EventSource;
        window.EventSource = function (url, config) {
          window.__smokeStreams.push(String(url));
          return new Native(url, config);
        };
        window.EventSource.prototype = Native.prototype;
        """;

    @ParameterizedTest(name = "a chairperson can create a chama and reach its dashboard in {0}")
    @MethodSource("org.chama.smoke.SmokeJourney#browsers")
    void aChairpersonCanCreateAChamaAndReachItsDashboard(SmokeBrowser browser) {
        WebDriver driver = start(browser);
        signIn("chairperson1", SmokeEnvironment.seedPassword("chairperson1"));

        String name = "Smoke " + UUID.randomUUID().toString().substring(0, 8);
        driver.get(app("/chamas"));
        visible(By.xpath("//button[normalize-space()='+ New Chama']")).click();

        visible(By.id("chama-name")).sendKeys(name);
        driver.findElement(By.id("chama-amount")).sendKeys("1500");
        driver.findElement(By.id("chama-creator-name")).sendKeys("Smoke Chairperson");
        // The country selector already defaults to Kenya, so only the subscriber digits are typed.
        driver.findElement(By.id("chama-creator-phone")).sendKeys("712000111");
        driver.findElement(By.xpath("//button[normalize-space()='Create Chama']")).click();

        // The dialog closing is the app's own signal that the POST succeeded. Asserting on the
        // table first would race the refresh that follows it.
        until(ExpectedConditions.invisibilityOfElementLocated(By.id("chama-name")));
        WebElement row = visible(By.xpath("//a[normalize-space()='" + name + "']"));

        String membersPath = java.net.URI.create(row.getAttribute("href")).getPath();
        String chamaId = membersPath.replaceAll(".*/chamas/(\\d+)/.*", "$1");

        // Installed before the navigation and not after, because useActivityFeed opens its stream
        // during the dashboard's first render. Both hops from here are client-side, so the wrapper
        // survives.
        ((JavascriptExecutor) driver).executeScript(RECORD_EVENT_SOURCES);
        row.click();
        driver.findElement(By.cssSelector("a[href='/chamas/" + chamaId + "/dashboard']")).click();

        visible(By.xpath("//*[normalize-space()='Recent activity']"));

        @SuppressWarnings("unchecked")
        List<String> streams = (List<String>) ((JavascriptExecutor) driver)
            .executeScript("return window.__smokeStreams;");
        assertFalse(streams == null || streams.isEmpty(),
            "The dashboard opened no EventSource at all, so this engine is on the polling fallback.");
        assertTrue(streams.stream().anyMatch(url -> url.contains("/activity-log/stream")),
            "The activity feed did not open its stream. Opened instead: " + streams);
    }
}
