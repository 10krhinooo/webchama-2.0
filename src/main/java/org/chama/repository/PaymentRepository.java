package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.enums.PaymentMethod;
import org.chama.domain.enums.PaymentStatus;
import org.chama.domain.model.Payment;

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
}
