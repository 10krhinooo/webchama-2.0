package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.model.Member;

import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class MemberRepository implements PanacheRepository<Member> {

    public List<Member> findByChama(Long chamaId) {
        return list("chama.id", chamaId);
    }

    public Optional<Member> findByChamaAndKeycloakUserId(Long chamaId, String keycloakUserId) {
        return find("chama.id = ?1 and keycloakUserId = ?2", chamaId, keycloakUserId).firstResultOptional();
    }

    public List<Member> findByKeycloakUserId(String keycloakUserId) {
        return list("keycloakUserId", keycloakUserId);
    }
}
