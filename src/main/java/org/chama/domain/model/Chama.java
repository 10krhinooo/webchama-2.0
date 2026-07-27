package org.chama.domain.model;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import org.chama.domain.enums.ChamaStatus;
import org.chama.domain.enums.ChamaType;
import org.chama.domain.enums.ContributionFrequency;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.Instant;

@Entity
@Table(name = "chama")
public class Chama extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false)
    public String name;

    public String description;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "type", nullable = false, columnDefinition = "chama_type")
    public ChamaType type;

    @Column(nullable = false)
    public String currency = "KES";

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "contribution_frequency", nullable = false, columnDefinition = "contribution_frequency")
    public ContributionFrequency contributionFrequency;

    @Column(name = "contribution_amount", nullable = false)
    public BigDecimal contributionAmount;

    @Column(name = "meeting_day")
    public String meetingDay;

    // Null means "use ApprovalService's system-wide default". A loan disbursement or payout at or
    // above this amount requires maker-checker dual sign-off (MIGRATION_PLAN.md section 9).
    @Column(name = "approval_threshold")
    public BigDecimal approvalThreshold;

    // Optional lifetime savings goal, distinct from contributionAmount (the per-cycle expected
    // amount). Null means no goal is set. Progress against it sums amountPaid across every
    // contribution the chama has ever had, not just the current cycle's rows.
    @Column(name = "savings_target")
    public BigDecimal savingsTarget;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "chama_status")
    public ChamaStatus status = ChamaStatus.ACTIVE;

    // Chairperson/treasurer-controlled kill switch for ContributionAutoPushService's sweep,
    // scoped to this chama only (distinct from the global contribution.auto-push.enabled config
    // property, which is an operator-level kill switch for the whole deployment).
    @Column(name = "auto_push_enabled", nullable = false)
    public boolean autoPushEnabled = true;

    // Hours since a contribution's last auto-push attempt before the sweep retries it.
    @Column(name = "auto_push_retry_hours", nullable = false)
    public int autoPushRetryHours = 24;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt = Instant.now();

    // Short shareable code an already-registered user redeems to self-join this chama (issue
    // #170), instead of only via chairperson-added-by-email. ChamaService.create() generates this
    // with a DB uniqueness check before persisting; the @PrePersist fallback below only exists so
    // code that persists a Chama directly (tests, other seed paths) doesn't need to know about it.
    @Column(name = "join_code", nullable = false, unique = true)
    public String joinCode;

    private static final String JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private static final SecureRandom JOIN_CODE_RANDOM = new SecureRandom();

    @PrePersist
    void ensureJoinCode() {
        if (joinCode == null) {
            StringBuilder sb = new StringBuilder(8);
            for (int i = 0; i < 8; i++) {
                sb.append(JOIN_CODE_ALPHABET.charAt(JOIN_CODE_RANDOM.nextInt(JOIN_CODE_ALPHABET.length())));
            }
            joinCode = sb.toString();
        }
    }
}
