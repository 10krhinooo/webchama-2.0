package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.enums.DeliveryStatus;
import org.chama.domain.model.DocumentDeliveryAttempt;

import java.time.Instant;
import java.util.List;

@ApplicationScoped
public class DocumentDeliveryAttemptRepository implements PanacheRepository<DocumentDeliveryAttempt> {

    public List<DocumentDeliveryAttempt> findByDocumentId(Long documentId) {
        return find("document.id = ?1 order by attemptedAt desc", documentId).list();
    }

    public long countFailedSince(Instant since) {
        return count("status = ?1 and attemptedAt >= ?2", DeliveryStatus.FAILED, since);
    }
}
