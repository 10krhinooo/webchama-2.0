package org.chama.smoke;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The branded Keycloak login page.
 *
 * <p>This page is the one screen in the product that React never renders. It is hand-written
 * FreeMarker with its own stylesheet and its own inline script, served by Keycloak, and no test in
 * the repository loads it: the Vitest suite cannot, and the Playwright suite only types into it on
 * its way somewhere else. A broken template, a stylesheet Keycloak failed to pick up, or a script
 * that throws in one engine all look identical from a spec that only asserts it got logged in.
 */
class LoginThemeSmokeIT extends SmokeJourney {

    private static final Pattern RGB = Pattern.compile("rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)");

    /** --chama-primary in keycloak/themes/chama/login/resources/css/login.css. */
    private static final String BRAND_TEAL = "27,77,69";

    @ParameterizedTest(name = "the branded login page renders and behaves in {0}")
    @MethodSource("org.chama.smoke.SmokeJourney#browsers")
    void theBrandedLoginPageRendersAndBehaves(SmokeBrowser browser) {
        WebDriver driver = start(browser);
        openLoginForm();

        // The template is ours, not Keycloak's stock one.
        assertTrue(
            driver.findElement(By.cssSelector(".chama-card-sub")).getText().contains("chama"),
            "The chama login template did not render; Keycloak is probably serving the stock theme.");

        // And its stylesheet was actually fetched and applied. Asserting on the class alone would
        // still pass if theme.properties stopped listing login.css, which is the realistic way for
        // this page to regress.
        WebElement submit = driver.findElement(By.id("kc-login"));
        assertTrue(submit.getAttribute("class").contains("chama-btn-submit"),
            "The submit button lost its themed class.");
        assertEquals(BRAND_TEAL, rgb(submit.getCssValue("background-color")),
            "The themed stylesheet did not apply to the submit button.");

        // The show/hide password control is plain inline JavaScript with no build step and no unit
        // test anywhere. Either engine could reject it silently.
        WebElement password = driver.findElement(By.id("password"));
        password.sendKeys("not-a-real-password");
        assertEquals("password", password.getAttribute("type"));

        driver.findElement(By.cssSelector("[data-password-toggle]")).click();
        assertEquals("text", password.getAttribute("type"),
            "The password visibility toggle did not run.");
    }

    @ParameterizedTest(name = "a rejected sign-in shows the themed error in {0}")
    @MethodSource("org.chama.smoke.SmokeJourney#browsers")
    void aRejectedSignInShowsTheThemedError(SmokeBrowser browser) {
        WebDriver driver = start(browser);
        openLoginForm();

        // A username that cannot exist, deliberately. The realm has brute force protection on, so
        // repeatedly failing a real seed user would eventually lock the account this suite and the
        // Playwright suite both depend on.
        driver.findElement(By.id("username")).sendKeys("nobody-smoke-test");
        driver.findElement(By.id("password")).sendKeys("wrong-password");
        driver.findElement(By.id("kc-login")).click();

        WebElement alert = until(
            ExpectedConditions.visibilityOfElementLocated(By.cssSelector(".chama-alert-danger")));
        assertNotEquals("", alert.getText().trim(), "The error alert rendered with no message in it.");
        assertTrue(driver.getCurrentUrl().contains("/realms/chama/"),
            "A rejected sign-in should stay on Keycloak.");
    }

    /** Chrome reports rgba(...) and Firefox reports rgb(...) for the same declaration. */
    private static String rgb(String cssColour) {
        Matcher matcher = RGB.matcher(cssColour);
        assertTrue(matcher.find(), "Unparseable colour: " + cssColour);
        return matcher.group(1) + "," + matcher.group(2) + "," + matcher.group(3);
    }
}
