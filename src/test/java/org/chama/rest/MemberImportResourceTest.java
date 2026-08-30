package org.chama.rest;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import jakarta.inject.Inject;
import org.chama.domain.enums.ChamaStatus;
import org.chama.domain.enums.ChamaType;
import org.chama.domain.enums.ContributionFrequency;
import org.chama.domain.enums.MemberRoleType;
import org.chama.domain.enums.MemberStatus;
import org.chama.domain.model.Chama;
import org.chama.domain.model.Member;
import org.chama.domain.model.MemberRole;
import org.chama.TestDataCleaner;
import org.chama.repository.ActivityLogRepository;
import org.chama.repository.ChamaRepository;
import org.chama.repository.MemberRepository;
import org.chama.repository.MemberRoleRepository;
import org.chama.service.KeycloakAdminService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.math.BigDecimal;
import java.util.concurrent.atomic.AtomicInteger;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;

@QuarkusTest
class MemberImportResourceTest {

    private static final String HEADER = "email,fullName,phone,nationalId,nextOfKin,roles\n";

    @InjectMock
    KeycloakAdminService keycloakAdminService;

    @Inject TestDataCleaner testDataCleaner;
    @Inject ChamaRepository chamaRepository;
    @Inject MemberRepository memberRepository;
    @Inject MemberRoleRepository memberRoleRepository;
    @Inject ActivityLogRepository activityLogRepository;

    private Long chamaId;

    @BeforeEach
    void seed() throws Exception {
        Mockito.when(keycloakAdminService.findUserByEmail(Mockito.anyString())).thenReturn(null);
        Mockito.when(keycloakAdminService.generateTempPassword()).thenReturn("Temp1234!");
        AtomicInteger sequence = new AtomicInteger();
        Mockito.when(keycloakAdminService.createUser(Mockito.anyString(), Mockito.anyString(), Mockito.anyString()))
            .thenAnswer(invocation -> "kc-import-" + sequence.incrementAndGet());

        QuarkusTransaction.requiringNew().run(() -> {
            testDataCleaner.deleteAll();

            Chama chama = new Chama();
            chama.name = "Import Chama";
            chama.type = ChamaType.TABLE_BANKING;
            chama.currency = "KES";
            chama.contributionFrequency = ContributionFrequency.MONTHLY;
            chama.contributionAmount = new BigDecimal("500");
            chama.status = ChamaStatus.ACTIVE;
            chamaRepository.persist(chama);
            chamaId = chama.id;

            member(chama, "import-chair", "Chair", "254700000801", MemberRoleType.CHAIRPERSON);
            member(chama, "import-treasurer", "Treasurer", "254700000802", MemberRoleType.TREASURER);
        });
    }

    private void member(Chama chama, String userId, String name, String phone, MemberRoleType role) {
        Member member = new Member();
        member.chama = chama;
        member.keycloakUserId = userId;
        member.fullName = name;
        member.phone = phone;
        member.status = MemberStatus.ACTIVE;
        memberRepository.persist(member);
        MemberRole memberRole = new MemberRole();
        memberRole.member = member;
        memberRole.role = role;
        memberRole.persist();
    }

    private io.restassured.specification.RequestSpecification upload(String csv) {
        return given().contentType("text/csv").body(csv);
    }

    @Test
    @TestSecurity(user = "import-chair")
    void aDryRunReportsWhatWouldHappenAndCreatesNothing() throws Exception {
        upload(HEADER + "jane@example.com,Jane Doe,254700000901,,,\n")
            .queryParam("dryRun", true)
            .when().post("/api/chamas/{chamaId}/members/import", chamaId)
            .then()
                .statusCode(200)
                .body("dryRun", equalTo(true))
                .body("ready", equalTo(1))
                .body("created", equalTo(0))
                .body("rows[0].outcome", equalTo("READY"))
                .body("rows[0].temporaryPassword", nullValue());

        Mockito.verify(keycloakAdminService, Mockito.never())
            .createUser(Mockito.anyString(), Mockito.anyString(), Mockito.anyString());
        org.junit.jupiter.api.Assertions.assertEquals(2, memberRepository.count());
    }

    @Test
    @TestSecurity(user = "import-chair")
    void acommitCreatesEveryValidMemberAndReturnsTheirTemporaryPasswords() {
        upload(HEADER
                + "jane@example.com,Jane Doe,254700000901,,,\n"
                + "amos@example.com,Amos Kip,254700000902,,,TREASURER\n")
            .when().post("/api/chamas/{chamaId}/members/import", chamaId)
            .then()
                .statusCode(200)
                .body("created", equalTo(2))
                .body("rows[0].outcome", equalTo("CREATED"))
                .body("rows[0].temporaryPassword", notNullValue());

        org.junit.jupiter.api.Assertions.assertEquals(4, memberRepository.count());
    }

    @Test
    @TestSecurity(user = "import-chair")
    void oneBadRowDoesNotStopTheGoodOnesFromLanding() {
        upload(HEADER
                + "jane@example.com,Jane Doe,254700000901,,,\n"
                + "not-an-email,Broken Row,254700000902,,,\n"
                + "amos@example.com,Amos Kip,254700000903,,,\n")
            .when().post("/api/chamas/{chamaId}/members/import", chamaId)
            .then()
                .statusCode(200)
                // Refusing two hundred and fifty valid members because row three has a typo is
                // what makes a bulk import useless.
                .body("created", equalTo(2))
                .body("skipped", equalTo(1))
                .body("rows[1].outcome", equalTo("SKIPPED"))
                .body("rows[1].problems", hasItem(org.hamcrest.Matchers.containsString("Email")));

        org.junit.jupiter.api.Assertions.assertEquals(4, memberRepository.count());
    }

    @Test
    @TestSecurity(user = "import-chair")
    void everyProblemWithARowIsReportedAtOnce() {
        upload(HEADER + "not-an-email,,254700000901,,,PRESIDENT\n")
            .queryParam("dryRun", true)
            .when().post("/api/chamas/{chamaId}/members/import", chamaId)
            .then()
                .statusCode(200)
                // One problem per upload would mean fixing a file one round trip at a time.
                .body("rows[0].problems.size()", org.hamcrest.Matchers.greaterThanOrEqualTo(3));
    }

    @Test
    @TestSecurity(user = "import-chair")
    void twoRowsOfTheSameFileCannotClaimTheSameEmailOrPhone() {
        upload(HEADER
                + "jane@example.com,Jane Doe,254700000901,,,\n"
                + "JANE@Example.com,Jane Again,254700000902,,,\n"
                + "amos@example.com,Amos Kip,254700000901,,,\n")
            .queryParam("dryRun", true)
            .when().post("/api/chamas/{chamaId}/members/import", chamaId)
            .then()
                .statusCode(200)
                // The database unique indexes cannot catch this: neither row exists yet when the
                // other is checked.
                .body("ready", equalTo(1))
                .body("skipped", equalTo(2))
                .body("rows[1].problems", hasItem(org.hamcrest.Matchers.containsString("Duplicate email")))
                .body("rows[2].problems", hasItem(org.hamcrest.Matchers.containsString("Duplicate phone")));
    }

    @Test
    @TestSecurity(user = "import-chair")
    void aPhoneNumberAlreadyInTheChamaIsCaughtBeforeAnythingIsAttempted() {
        upload(HEADER + "new@example.com,New Person,254700000801,,,\n")
            .queryParam("dryRun", true)
            .when().post("/api/chamas/{chamaId}/members/import", chamaId)
            .then()
                .statusCode(200)
                // Checked through Panache, so the comparison is against the ciphertext the unique
                // index is actually built on rather than the plaintext.
                .body("skipped", equalTo(1))
                .body("rows[0].problems", hasItem(org.hamcrest.Matchers.containsString("phone number is already")));
    }

    @Test
    @TestSecurity(user = "import-chair")
    void aStructuralProblemRejectsTheBatchWithoutJudgingAnyRow() {
        upload("email,fullName\njane@example.com,Jane Doe\n")
            .when().post("/api/chamas/{chamaId}/members/import", chamaId)
            .then()
                .statusCode(200)
                .body("structuralErrors", hasSize(1))
                .body("rows", hasSize(0))
                .body("created", equalTo(0));

        org.junit.jupiter.api.Assertions.assertEquals(2, memberRepository.count());
    }

    @Test
    @TestSecurity(user = "import-chair")
    void anOversizedFileIsRefusedBeforeAnyAccountIsProvisioned() {
        StringBuilder csv = new StringBuilder(HEADER);
        for (int i = 0; i < 501; i++) {
            csv.append("m%d@example.com,Member %d,2547%08d,,,\n".formatted(i, i, i));
        }

        upload(csv.toString())
            .when().post("/api/chamas/{chamaId}/members/import", chamaId)
            .then()
                .statusCode(200)
                .body("structuralErrors", hasItem(org.hamcrest.Matchers.containsString("more than the 500")))
                .body("created", equalTo(0));
    }

    @Test
    @TestSecurity(user = "import-chair")
    void aRowThatFailsWhileBeingCreatedIsReportedWithoutTakingTheBatchDown() throws Exception {
        Mockito.when(keycloakAdminService.createUser(Mockito.eq("boom@example.com"), Mockito.anyString(), Mockito.anyString()))
            .thenThrow(new RuntimeException("Keycloak is unreachable"));

        upload(HEADER
                + "jane@example.com,Jane Doe,254700000901,,,\n"
                + "boom@example.com,Boom,254700000902,,,\n"
                + "amos@example.com,Amos Kip,254700000903,,,\n")
            .when().post("/api/chamas/{chamaId}/members/import", chamaId)
            .then()
                .statusCode(200)
                // One fresh transaction per row, so the failure cannot mark the batch
                // rollback-only and silently undo the members already created in it.
                .body("created", equalTo(2))
                .body("failed", equalTo(1))
                .body("rows[1].outcome", equalTo("FAILED"));

        org.junit.jupiter.api.Assertions.assertEquals(4, memberRepository.count());
    }

    @Test
    @TestSecurity(user = "import-chair")
    void theActivityFeedGetsOneEntryForTheImportRatherThanOnePerMember() {
        upload(HEADER
                + "jane@example.com,Jane Doe,254700000901,,,\n"
                + "amos@example.com,Amos Kip,254700000902,,,\n")
            .when().post("/api/chamas/{chamaId}/members/import", chamaId)
            .then().statusCode(200).body("created", equalTo(2));

        long imported = activityLogRepository.find("eventType", org.chama.domain.enums.ActivityEventType.MEMBERS_IMPORTED).count();
        org.junit.jupiter.api.Assertions.assertEquals(1, imported);
    }

    @Test
    @TestSecurity(user = "import-treasurer")
    void aTreasurerCannotImportMembers() {
        // Provisioning accounts is a chairperson power everywhere else, and doing it three hundred
        // at a time is not a smaller version of it.
        upload(HEADER + "jane@example.com,Jane Doe,254700000901,,,\n")
            .when().post("/api/chamas/{chamaId}/members/import", chamaId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "outsider")
    void someoneWithNoMembershipCannotImportMembers() {
        upload(HEADER + "jane@example.com,Jane Doe,254700000901,,,\n")
            .when().post("/api/chamas/{chamaId}/members/import", chamaId)
            .then().statusCode(403);
    }
}
