package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.enums.ChamaStatus;
import org.chama.domain.model.Chama;

import java.time.Instant;

@ApplicationScoped
public class ChamaRepository implements PanacheRepository<Chama> {

    public long countByStatus(ChamaStatus status) {
        return count("status", status);
    }

    public long countCreatedSince(Instant since) {
        return count("createdAt >= ?1", since);
    }
}
