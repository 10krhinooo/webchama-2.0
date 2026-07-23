package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.enums.DeliveryStatus;
import org.chama.domain.model.GeneratedDocument;

import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class GeneratedDocumentRepository implements PanacheRepository<GeneratedDocument> {

    /** Tenant-scoped, newest first, for a chama's own document list (issue #43's wizard/list view). */
    public List<GeneratedDocument> findRecentForChama(Long chamaId, int page, int size) {
        return find("chama.id = ?1 order by createdAt desc", chamaId).page(page, size).list();
    }

    /** A member's own documents (self-service view), tenant-scoped by construction via memberId. */
    public List<GeneratedDocument> findForMember(Long chamaId, Long memberId) {
        return find("chama.id = ?1 and member.id = ?2 order by createdAt desc", chamaId, memberId).list();
    }

    /** Documents still awaiting delivery on at least one channel, for the chama's oversight view. */
    public long countPendingDeliveries(Long chamaId) {
        return count("chama.id = ?1 and (emailStatus = ?2 or whatsappStatus = ?2)", chamaId, DeliveryStatus.PENDING);
    }

    public Optional<GeneratedDocument> findByDocumentNumber(String documentNumber) {
        return find("documentNumber", documentNumber).firstResultOptional();
    }
}
