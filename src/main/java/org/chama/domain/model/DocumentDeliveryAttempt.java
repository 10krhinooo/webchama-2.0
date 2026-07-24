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
import org.chama.domain.enums.DeliveryChannel;
import org.chama.domain.enums.DeliveryStatus;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

/**
 * The full per-attempt delivery ledger (every attempt, success or failure), distinct from
 * GeneratedDocument's emailStatus/whatsappStatus columns which only reflect the most recent
 * attempt. Append-only (issue #41).
 */
@Entity
@Table(name = "document_delivery_attempt")
public class DocumentDeliveryAttempt extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id", nullable = false)
    public GeneratedDocument document;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "delivery_channel")
    public DeliveryChannel channel;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "delivery_status")
    public DeliveryStatus status;

    @Column(name = "error_detail", columnDefinition = "text")
    public String errorDetail;

    @CreationTimestamp
    @Column(name = "attempted_at", nullable = false, updatable = false)
    public Instant attemptedAt;
}
