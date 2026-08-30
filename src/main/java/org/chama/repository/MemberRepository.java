package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.enums.MemberStatus;
import org.chama.domain.model.Member;

import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class MemberRepository implements PanacheRepository<Member> {

    public List<Member> findByChama(Long chamaId) {
        return list("chama.id", chamaId);
    }

    /** Platform-wide membership count for the SUPER_ADMIN overview, one row per (person, chama). */
    public long countByStatus(MemberStatus status) {
        return count("status", status);
    }

    public Optional<Member> findByChamaAndKeycloakUserId(Long chamaId, String keycloakUserId) {
        return find("chama.id = ?1 and keycloakUserId = ?2", chamaId, keycloakUserId).firstResultOptional();
    }

    /**
     * Whether a phone number is already taken in this chama, matching the scope of the unique
     * index in V33: the same person may legitimately belong to two chamas with one number.
     *
     * <p>Queried through Panache rather than raw SQL on purpose. The phone column holds
     * ciphertext, written by DeterministicEncryptedStringConverter, and its unique index is on the
     * ciphertext too. A hand-written SQL comparison against the plaintext silently matches
     * nothing, which reads as "this number is free" right up until the insert fails.
     */
    public boolean phoneExistsInChama(Long chamaId, String phone) {
        return count("chama.id = ?1 and phone = ?2", chamaId, phone) > 0;
    }

    /** Same reasoning and same scope as phoneExistsInChama; see V33 for the index. */
    public boolean nationalIdExistsInChama(Long chamaId, String nationalId) {
        return count("chama.id = ?1 and nationalId = ?2", chamaId, nationalId) > 0;
    }

    public List<Member> findByKeycloakUserId(String keycloakUserId) {
        return list("keycloakUserId", keycloakUserId);
    }
}
