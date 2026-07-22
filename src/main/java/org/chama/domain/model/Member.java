package org.chama.domain.model;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
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
import org.chama.domain.enums.MemberStatus;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;

/**
 * One row per (person, chama): a person who belongs to more than one chama
 * has more than one Member row, one per chama, each with its own MemberRole
 * set. This is what actually satisfies "a member can belong to several
 * chamas" from MIGRATION_PLAN.md section 4, not the member_role table itself.
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

    @Column(nullable = false)
    public String phone;

    @Column(name = "national_id")
    public String nationalId;

    @Column(name = "next_of_kin")
    public String nextOfKin;

    @Column(name = "join_date", nullable = false)
    public LocalDate joinDate = LocalDate.now();

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "member_status")
    public MemberStatus status = MemberStatus.ACTIVE;
}
