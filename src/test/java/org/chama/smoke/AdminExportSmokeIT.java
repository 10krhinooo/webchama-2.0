package org.chama.smoke;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The CSV export on the platform overview.
 *
 * <p>utils/csv.ts builds a Blob, points a synthetic anchor at an object URL, clicks it, and then
 * revokes the URL on the very next statement. Chromium starts the download synchronously on the
 * click and so is unaffected by the revoke; other engines have historically not, and the symptom
 * is a button that appears to work and produces no file. Nothing about that is visible to a unit
 * test, which can only assert that createObjectURL was called, and Playwright's download API
 * papers over the difference by waiting on its own event.
 *
 * <p>This is also the one place in the product where the browser writes a file to disk, so it is
 * the only journey that exercises the download plumbing at all.
 */
class AdminExportSmokeIT extends SmokeJourney {

    private static final Duration DOWNLOAD_TIMEOUT = Duration.ofSeconds(20);

    @ParameterizedTest(name = "the platform overview exports a CSV in {0}")
    @MethodSource("org.chama.smoke.SmokeJourney#browsers")
    void thePlatformOverviewExportsACsv(SmokeBrowser browser) {
        WebDriver driver = start(browser);
        signIn("admin", SmokeEnvironment.superadminPassword());

        driver.get(app("/admin/overview"));
        // Waiting for the heading is not enough: the export button is rendered from data that is
        // still loading, and clicking it before then exports nothing.
        visible(By.xpath("//h1[normalize-space()='Platform overview']"));
        visible(By.xpath("//button[normalize-space()='Export CSV']")).click();

        Path file = awaitDownload();
        List<String> lines = read(file);
        assertTrue(lines.size() > 1,
            "The exported file has no rows beyond its header: " + lines);
        assertTrue(lines.get(0).startsWith("Metric,Value"),
            "Unexpected header in the exported file: " + lines.get(0));
    }

    /**
     * Waits for a completed file rather than for any file. Both engines write the download under a
     * temporary name first, Chrome as .crdownload and Firefox as .part, so a directory listing
     * taken too early finds a partial file and the assertions read garbage.
     */
    private Path awaitDownload() {
        long deadline = System.nanoTime() + DOWNLOAD_TIMEOUT.toNanos();
        while (System.nanoTime() < deadline) {
            try (var entries = Files.list(downloadDirectory)) {
                var finished = entries
                    .filter(path -> path.getFileName().toString().endsWith(".csv"))
                    .findFirst();
                if (finished.isPresent()) {
                    return finished.get();
                }
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
            try {
                Thread.sleep(250);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Interrupted while waiting for the export", interrupted);
            }
        }
        throw new AssertionError(
            "No .csv arrived in " + downloadDirectory + " within " + DOWNLOAD_TIMEOUT.toSeconds()
                + "s. The click produced no file in this engine.");
    }

    private static List<String> read(Path file) {
        try {
            return Files.readAllLines(file);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
