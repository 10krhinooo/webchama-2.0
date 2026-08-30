package org.chama.smoke;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.firefox.FirefoxDriver;
import org.openqa.selenium.firefox.FirefoxOptions;

import java.nio.file.Path;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * The engines the smoke journeys run against, and the per-engine setup each one needs.
 *
 * <p>Selenium 4 resolves and caches the matching driver binary itself, so nothing here pins a
 * driver version and there is no WebDriverManager dependency to keep in step with the installed
 * browser.
 */
enum SmokeBrowser {

    CHROME {
        @Override
        WebDriver start(Path downloadDirectory) {
            ChromeOptions options = new ChromeOptions();
            applyBinary(SmokeEnvironment.binary(this), options::setBinary);
            if (SmokeEnvironment.headless()) {
                options.addArguments("--headless=new");
            }
            // Containers and CI runners give the browser a small /dev/shm, which Chrome fills and
            // then crashes on with a bare "session deleted because of page crash".
            options.addArguments("--no-sandbox", "--disable-dev-shm-usage", "--window-size=1440,900");

            Map<String, Object> preferences = new HashMap<>();
            preferences.put("download.default_directory", downloadDirectory.toAbsolutePath().toString());
            preferences.put("download.prompt_for_download", false);
            options.setExperimentalOption("prefs", preferences);

            return new ChromeDriver(options);
        }
    },

    FIREFOX {
        @Override
        WebDriver start(Path downloadDirectory) {
            FirefoxOptions options = new FirefoxOptions();
            applyBinary(SmokeEnvironment.binary(this), options::setBinary);
            if (SmokeEnvironment.headless()) {
                options.addArguments("-headless");
            }
            options.addArguments("-width", "1440", "-height", "900");

            // folderList 2 means "the directory named below" rather than the system Downloads
            // folder, useDownloadDir suppresses the unattended-hostile "where shall I save this"
            // dialog, and start_downloads_in_tmp_dir would otherwise stage the file somewhere else
            // entirely. Firefox needs all of them; Chrome needs the one preference above.
            options.addPreference("browser.download.folderList", 2);
            options.addPreference("browser.download.dir", downloadDirectory.toAbsolutePath().toString());
            options.addPreference("browser.download.useDownloadDir", true);
            options.addPreference("browser.download.start_downloads_in_tmp_dir", false);
            options.addPreference("browser.download.manager.showWhenStarting", false);
            options.addPreference("browser.helperApps.neverAsk.saveToDisk", "text/csv,application/csv,text/plain");

            return new FirefoxDriver(options);
        }
    };

    abstract WebDriver start(Path downloadDirectory);

    private static void applyBinary(String path, java.util.function.Consumer<String> setter) {
        if (!path.isBlank()) {
            setter.accept(path);
        }
    }

    static SmokeBrowser of(String name) {
        return switch (name.toLowerCase(Locale.ROOT)) {
            case "chrome", "chromium" -> CHROME;
            case "firefox" -> FIREFOX;
            default -> throw new IllegalArgumentException(
                "Unknown browser \"" + name + "\" in smoke.browsers. Supported: chrome, firefox.");
        };
    }

    @Override
    public String toString() {
        return name().toLowerCase(Locale.ROOT);
    }
}
