package org.chama.rest;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.chama.domain.enums.NotificationEventFamily;
import org.chama.domain.model.Notification;
import org.chama.repository.NotificationPreferenceRepository;
import org.chama.repository.NotificationRepository;
import org.chama.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import io.quarkus.narayana.jta.QuarkusTransaction;
import org.chama.domain.enums.ActivityEventType;
import org.chama.domain.enums.ChamaStatus;
import org.chama.domain.enums.ChamaType;
import org.chama.domain.enums.ContributionFrequency;
import org.chama.domain.model.Chama;
import org.chama.repository.ChamaRepository;
import org.chama.service.ActivityLogService;
import org.chama.service.ChamaService;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The inbox is not chama-scoped, so the rule under test throughout is that every read and write is
 * confined to the caller's own Keycloak id.
 */
@QuarkusTest
class NotificationResourceTest {

    private static final String ALICE = "alice-keycloak-id";
    private static final String BOB = "bob-keycloak-id";

    @Inject
    NotificationService notificationService;

    @Inject
    NotificationRepository notificationRepository;

    @Inject
    NotificationPreferenceRepository preferenceRepository;

    @Inject
    ChamaRepository chamaRepository;

    @Inject
    ChamaService chamaService;

    @Inject
    ActivityLogService activityLogService;

    @BeforeEach
    @Transactional
    void clear() {
        notificationRepository.deleteAll();
        preferenceRepository.deleteAll();
    }

    private Notification give(String userId, NotificationEventFamily family, String title) {
        return notificationService.record(userId, null, family, title, "body", "/somewhere");
    }

    @Test
    @TestSecurity(user = ALICE)
    void listsOnlyTheCallersOwnNotifications() {
        give(ALICE, NotificationEventFamily.LOAN, "For Alice");
        give(BOB, NotificationEventFamily.LOAN, "For Bob");

        given().when().get("/api/notifications")
            .then().statusCode(200)
            .body("$", hasSize(1))
            .body("[0].title", equalTo("For Alice"));
    }

    @Test
    @TestSecurity(user = ALICE)
    void countsOnlyTheCallersUnread() {
        give(ALICE, NotificationEventFamily.LOAN, "One");
        give(ALICE, NotificationEventFamily.PENALTY, "Two");
        give(BOB, NotificationEventFamily.LOAN, "Not mine");

        given().when().get("/api/notifications/unread-count")
            .then().statusCode(200).body("unread", is(2));
    }

    @Test
    @TestSecurity(user = ALICE)
    void filtersToUnreadWhenAsked() {
        Notification read = give(ALICE, NotificationEventFamily.LOAN, "Already read");
        give(ALICE, NotificationEventFamily.LOAN, "Still unread");
        notificationService.markRead(ALICE, read.id);

        given().queryParam("unreadOnly", true).when().get("/api/notifications")
            .then().statusCode(200)
            .body("$", hasSize(1))
            .body("[0].title", equalTo("Still unread"));
    }

    @Test
    @TestSecurity(user = ALICE)
    void marksOneRead() {
        Notification notification = give(ALICE, NotificationEventFamily.LOAN, "Mine");

        given().when().put("/api/notifications/" + notification.id + "/read").then().statusCode(204);
        given().when().get("/api/notifications/unread-count").then().body("unread", is(0));
    }

    /**
     * 404 rather than 403 on purpose: a 403 would confirm the notification exists, which is more
     * than a caller is entitled to learn about someone else's inbox.
     */
    @Test
    @TestSecurity(user = ALICE)
    void cannotMarkSomeoneElsesNotificationRead() {
        Notification bobs = give(BOB, NotificationEventFamily.LOAN, "Bob's");

        given().when().put("/api/notifications/" + bobs.id + "/read").then().statusCode(404);
        assertNull(notificationRepository.findById(bobs.id).readAt, "Bob's notification must be untouched");
    }

    @Test
    @TestSecurity(user = ALICE)
    void marksAllReadWithoutTouchingAnotherUser() {
        give(ALICE, NotificationEventFamily.LOAN, "One");
        give(ALICE, NotificationEventFamily.PENALTY, "Two");
        Notification bobs = give(BOB, NotificationEventFamily.LOAN, "Bob's");

        given().when().put("/api/notifications/read-all").then().statusCode(200).body("unread", is(0));
        assertEquals(1, notificationRepository.countUnreadForUser(BOB), "Bob's inbox must be untouched");
        assertNull(notificationRepository.findById(bobs.id).readAt);
    }

    @Test
    @TestSecurity(user = ALICE)
    void reportsNotFoundWhenMarkingAnAlreadyReadNotification() {
        Notification notification = give(ALICE, NotificationEventFamily.LOAN, "Mine");
        notificationService.markRead(ALICE, notification.id);

        given().when().put("/api/notifications/" + notification.id + "/read").then().statusCode(404);
    }

    @Test
    @TestSecurity(user = ALICE)
    void storesAndReturnsPreferences() {
        given().contentType(ContentType.JSON)
            .body("""
                [{"eventFamily":"LOAN","inAppEnabled":false,"emailEnabled":false}]
                """)
            .when().put("/api/notifications/preferences")
            .then().statusCode(200)
            .body("$", hasSize(1))
            .body("[0].eventFamily", equalTo("LOAN"))
            .body("[0].inAppEnabled", is(false));

        given().when().get("/api/notifications/preferences")
            .then().statusCode(200).body("[0].emailEnabled", is(false));
    }

    @Test
    @TestSecurity(user = ALICE)
    void leavesFamiliesTheRequestDoesNotMentionAlone() {
        notificationService.updatePreference(ALICE, NotificationEventFamily.PENALTY, false, false);

        given().contentType(ContentType.JSON)
            .body("""
                [{"eventFamily":"LOAN","inAppEnabled":true,"emailEnabled":false}]
                """)
            .when().put("/api/notifications/preferences").then().statusCode(200);

        // A client that knows about fewer families than the server must not switch the rest back on.
        assertTrue(preferenceRepository.find(ALICE, NotificationEventFamily.PENALTY).isPresent());
        assertEquals(false, preferenceRepository.find(ALICE, NotificationEventFamily.PENALTY).get().inAppEnabled);
    }

    @Test
    @TestSecurity(user = ALICE)
    void doesNotRecordWhenTheUserMutedTheFamilyInApp() {
        notificationService.updatePreference(ALICE, NotificationEventFamily.LOAN, false, true);

        assertNull(give(ALICE, NotificationEventFamily.LOAN, "Muted"));
        given().when().get("/api/notifications").then().body("$", hasSize(0));
    }

    @Test
    @TestSecurity(user = ALICE)
    void stillRecordsFamiliesTheUserHasNotMuted() {
        notificationService.updatePreference(ALICE, NotificationEventFamily.LOAN, false, true);

        assertNotNull(give(ALICE, NotificationEventFamily.PENALTY, "Not muted"));
        given().when().get("/api/notifications").then().body("$", hasSize(1));
    }

    @Test
    @TestSecurity(user = ALICE)
    void capsThePageSizeSoAnInboxCannotBeFetchedWholesale() {
        for (int i = 0; i < 5; i++) {
            give(ALICE, NotificationEventFamily.LOAN, "N" + i);
        }

        given().queryParam("size", 10_000).when().get("/api/notifications")
            .then().statusCode(200).body("$", hasSize(5));
    }

    @Test
    void rejectsAnUnauthenticatedCaller() {
        given().when().get("/api/notifications").then().statusCode(401);
        given().when().get("/api/notifications/unread-count").then().statusCode(401);
        given().when().put("/api/notifications/read-all").then().statusCode(401);
    }

    /**
     * Regression guard for two foreign keys with no cascade.
     *
     * activity_log and notification both reference chama, and neither was removed when a chama was
     * deleted, so deleting a chama that had been used at all failed. activity_log was missing from
     * that cleanup before notification was added, so this covers a defect that predates it.
     */
    @Test
    @TestSecurity(user = ALICE, roles = "SUPER_ADMIN")
    void aChamaWithNotificationsAndActivityCanStillBeDeleted() {
        Long chamaId = QuarkusTransaction.requiringNew().call(() -> {
            Chama chama = new Chama();
            chama.name = "Deletable";
            chama.type = ChamaType.TABLE_BANKING;
            chama.currency = "KES";
            chama.contributionFrequency = ContributionFrequency.MONTHLY;
            chama.contributionAmount = new java.math.BigDecimal("1000");
            chama.status = ChamaStatus.ACTIVE;
            chama.joinCode = "DELTST";
            chamaRepository.persist(chama);
            return chama.id;
        });

        QuarkusTransaction.requiringNew().run(() -> {
            notificationService.record(ALICE, chamaId, NotificationEventFamily.LOAN,
                "About this chama", "body", "/chamas/" + chamaId + "/loans");
            activityLogService.log(chamaRepository.findById(chamaId),
                ActivityEventType.MEMBER_INVITED, "someone was invited");
        });

        chamaService.delete(chamaId);
        assertNull(chamaRepository.findById(chamaId));
    }
}
