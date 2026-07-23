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
import org.chama.domain.enums.DeliveryStatus;
import org.chama.domain.enums.DocumentType;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * A generated PDF statement/receipt, mirrors DondooHomes' GeneratedDocument: a denormalized
 * snapshot (member name/email/phone captured at generation time, not re-read live off member) so
 * a document still reads correctly even if the member's details change later, plus the rendered
 * PDF bytes and a last-write-wins status per delivery channel. The full per-attempt delivery
 * history lives in DocumentDeliveryAttempt, not here. Exactly one of contribution/loan/payout is
 * populated depending on documentType, same polymorphic-nullable-FK convention as Payment's
 * purpose column (MIGRATION_PLAN.md section 4, issue #41).
 */
@Entity
@Table(name = "generated_document")
public class GeneratedDocument extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chama_id", nullable = false)
    public Chama chama;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "member_id", nullable = false)
    public Member member;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contribution_id")
    public Contribution contribution;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "loan_id")
    public Loan loan;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "payout_id")
    public Payout payout;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "document_type", nullable = false, columnDefinition = "document_type")
    public DocumentType documentType;

    @Column(name = "document_number", nullable = false, length = 30)
    public String documentNumber;

    @Column(name = "member_name", nullable = false, length = 200)
    public String memberName;

    @Column(name = "member_email", length = 200)
    public String memberEmail;

    @Column(name = "member_phone", length = 30)
    public String memberPhone;

    @Column(name = "line_items_json", nullable = false, columnDefinition = "text")
    public String lineItemsJson;

    @Column(name = "total_amount", nullable = false)
    public BigDecimal totalAmount;

    @Column(name = "billing_period", length = 50)
    public String billingPeriod;

    @Column(columnDefinition = "text")
    public String notes;

    @Column(name = "pdf_bytes", columnDefinition = "bytea")
    public byte[] pdfBytes;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "email_status", columnDefinition = "delivery_status")
    public DeliveryStatus emailStatus;

    @Column(name = "email_sent_at")
    public Instant emailSentAt;

    @Column(name = "email_error", columnDefinition = "text")
    public String emailError;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "whatsapp_status", columnDefinition = "delivery_status")
    public DeliveryStatus whatsappStatus;

    @Column(name = "whatsapp_sent_at")
    public Instant whatsappSentAt;

    @Column(name = "whatsapp_error", columnDefinition = "text")
    public String whatsappError;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    public Instant createdAt;
}
