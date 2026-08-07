package org.chama.domain.model;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.chama.domain.crypto.DeterministicEncryptedStringConverter;
import org.chama.domain.enums.MemberStatus;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;

/**
 * One row per (person, chama): a person who belongs to more than one chama
 * has more than one Member row, one per chama, each with its own MemberRole
 * set. This is what actually satisfies "a member can belong to several
 * chamas", not the member_role table itself.
 */
@Entity
@Table(name = "member")
public class Member extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chama_id", nullable = false)
    public Chama chama;

    @Column(name = "keycloak_user_id", nullable = false)
    public String keycloakUserId;

    @Column(name = "full_name", nullable = false)
    public String fullName;

    // Encrypted at rest (AUDIT_PLAN.md P2-14). Deterministic, so idx_member_chama_phone/
    // idx_member_chama_national_id (unique per chama) and exact-match lookups still work.
    @Convert(converter = DeterministicEncryptedStringConverter.class)
    @Column(nullable = false)
    public String phone;

    @Convert(converter = DeterministicEncryptedStringConverter.class)
    @Column(name = "national_id")
    public String nationalId;

    @Column(name = "next_of_kin")
    public String nextOfKin;

    // Not @CreationTimestamp: unlike Chama.createdAt this is a business field PayoutService sorts
    // by for seniority-based payout rotation, and test fixtures legitimately backdate it to
    // simulate longer-tenured members. @CreationTimestamp would silently overwrite that.
    @Column(name = "join_date", nullable = false)
    public LocalDate joinDate = LocalDate.now();

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "member_status")
    public MemberStatus status = MemberStatus.ACTIVE;

    // Explicit member opt-in for the scheduled auto-STK-push job (issue #60): when true, the
    // contribution auto-push scheduler is allowed to fire an unattended STK push against this
    // member's phone on their contribution due date, instead of waiting for them to pay manually.
    @Column(name = "auto_pay_enabled", nullable = false)
    public boolean autoPayEnabled = false;
}
