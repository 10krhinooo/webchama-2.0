package org.chama.observability;

import io.quarkus.runtime.StartupEvent;
import io.sentry.Sentry;
import io.sentry.SentryEvent;
import io.sentry.SentryOptions;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.util.Optional;

/**
 * Starts error reporting, and decides what is allowed to leave the building.
 *
 * <p>The second half of that sentence is the reason this class exists rather than a one-line
 * extension dependency. This schema encrypts member phone numbers and national ids at rest through
 * {@code DeterministicEncryptedStringConverter}, and the M-Pesa and Flutterwave paths carry phone
 * numbers and payment references in their request bodies. An error reporter left on its defaults
 * ships request bodies, headers and cookies with every event, which would quietly send a third
 * party exactly the fields the schema is careful to encrypt. Nothing would look wrong; the data
 * would simply be somewhere else too.
 *
 * <p>So the configuration below is deny-by-default in three layers. The SDK's own PII switch stays
 * off, the request payload is never attached, and {@link #scrub(SentryEvent)} runs last as a
 * backstop for anything a future SDK version decides to start collecting. The layers are
 * deliberate: any one of them alone is a single edit away from leaking.
 *
 * <p>Inert without a DSN. That is what keeps dev and CI silent without a separate profile, and it
 * means a misconfigured deployment fails to report rather than failing to start.
 */
@ApplicationScoped
public class SentryConfiguration {

    private static final Logger LOG = Logger.getLogger(SentryConfiguration.class);

    /**
     * Keys whose values never leave this process, matched case-insensitively against tag and extra
     * names. Deliberately broader than the fields in use today, since the cost of over-scrubbing is
     * a slightly less informative error and the cost of under-scrubbing is a member's phone number
     * in someone else's system.
     */
    private static final String[] FORBIDDEN_KEY_FRAGMENTS = {
        "phone", "msisdn", "national", "id_number", "idnumber", "email", "password", "secret",
        "token", "passkey", "credential", "authorization", "cookie", "pin", "account",
    };

    @ConfigProperty(name = "chama.sentry.dsn")
    Optional<String> dsn;

    @ConfigProperty(name = "chama.sentry.environment", defaultValue = "local")
    String environment;

    /**
     * Optional rather than a blank default. SmallRye reads an empty {@code defaultValue} as no
     * default at all and makes the property required, which turns a missing line in a gitignored
     * application.properties into a failure to boot.
     */
    @ConfigProperty(name = "chama.sentry.release")
    Optional<String> release;

    void onStart(@Observes StartupEvent event) {
        String configuredDsn = dsn.map(String::trim).filter(value -> !value.isEmpty()).orElse(null);
        if (configuredDsn == null) {
            LOG.info("Sentry not configured (chama.sentry.dsn unset), errors stay in the logs");
            return;
        }

        Sentry.init(options -> apply(options, configuredDsn, environment, release.orElse(null)));
        LOG.infof("Sentry reporting errors for environment %s", environment);
    }

    /**
     * Package-private and static so the options can be asserted without starting a Sentry client,
     * which is the only way to test a configuration whose failure mode is silent.
     */
    static void apply(SentryOptions options, String dsn, String environment, String release) {
        options.setDsn(dsn);
        options.setEnvironment(environment);
        if (release != null && !release.isBlank()) {
            options.setRelease(release);
        }

        // Layer one: the SDK's own switch for identifying data. Off means no IP address, no
        // cookies, no request body.
        options.setSendDefaultPii(false);
        options.setAttachStacktrace(true);

        // Errors, not APM. The system review asked for monitoring; tracing is a separate decision
        // with its own volume and cost, so nothing is sampled for performance here.
        options.setTracesSampleRate(null);

        // Layer two: never hold a request payload in the first place, so there is nothing for a
        // later change to accidentally start sending.
        options.setMaxRequestBodySize(SentryOptions.RequestSize.NONE);

        // Layer three: the backstop, applied to every event on its way out.
        options.setBeforeSend((event, hint) -> scrub(event));
    }

    /**
     * Strips anything that could carry member data, whatever put it there.
     *
     * <p>Runs on every event rather than on the paths known to touch PII, because the paths known
     * to touch PII are exactly the ones someone will add to later.
     */
    static SentryEvent scrub(SentryEvent event) {
        if (event.getRequest() != null) {
            event.getRequest().setData(null);
            event.getRequest().setCookies(null);
            event.getRequest().setHeaders(null);
            event.getRequest().setQueryString(null);
        }

        // The user keeps only its Keycloak subject id, which is an opaque UUID. It is enough to
        // tell two members' errors apart, and not enough to tell anyone who they are.
        if (event.getUser() != null) {
            event.getUser().setUsername(null);
            event.getUser().setEmail(null);
            event.getUser().setIpAddress(null);
            event.getUser().setData(null);
        }

        event.getContexts().remove("request");
        removeForbidden(event);
        return event;
    }

    private static void removeForbidden(SentryEvent event) {
        if (event.getTags() != null) {
            event.getTags().keySet().removeIf(SentryConfiguration::isForbidden);
        }
        if (event.getExtras() != null) {
            event.getExtras().keySet().removeIf(SentryConfiguration::isForbidden);
        }
    }

    static boolean isForbidden(String key) {
        if (key == null) {
            return false;
        }
        String lower = key.toLowerCase();
        for (String fragment : FORBIDDEN_KEY_FRAGMENTS) {
            if (lower.contains(fragment)) {
                return true;
            }
        }
        return false;
    }
}
