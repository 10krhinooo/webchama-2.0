package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.enums.PaymentMethod;
import org.chama.domain.enums.PaymentStatus;
import org.chama.domain.model.Payment;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class PaymentRepository implements PanacheRepository<Payment> {

    public Optional<Payment> findByProviderReference(String providerReference) {
        return find("providerReference", providerReference).firstResultOptional();
    }

    public List<Payment> findByChama(Long chamaId) {
        return list("chama.id", chamaId);
    }

    public long countByMethodAndStatus(PaymentMethod method, PaymentStatus status) {
        return count("method = ?1 and status = ?2", method, status);
    }

    public List<Payment> findByContribution(Long contributionId) {
        return list("contribution.id", contributionId);
    }

    public List<Payment> findByChamaAndMember(Long chamaId, Long memberId) {
        return list("chama.id = ?1 and member.id = ?2 order by createdAt desc", chamaId, memberId);
    }

    public Optional<Payment> findPendingByContribution(Long contributionId) {
        return find("contribution.id = ?1 and status = ?2", contributionId, PaymentStatus.PENDING)
            .firstResultOptional();
    }

    public Optional<Payment> findPendingByWelfareContribution(Long welfareContributionId) {
        return find("welfareContribution.id = ?1 and status = ?2", welfareContributionId, PaymentStatus.PENDING)
            .firstResultOptional();
    }

    public Optional<Payment> findPendingWelfareByChamaAndMember(Long chamaId, Long memberId) {
        return find("welfareContribution.chama.id = ?1 and member.id = ?2 and status = ?3",
            chamaId, memberId, PaymentStatus.PENDING).firstResultOptional();
    }

    public List<Payment> findPendingOlderThan(PaymentMethod method, Instant cutoff) {
        return list("method = ?1 and status = ?2 and createdAt < ?3", method, PaymentStatus.PENDING, cutoff);
    }
}
