package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.enums.VoteChoice;
import org.chama.domain.model.ResolutionVote;

import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class ResolutionVoteRepository implements PanacheRepository<ResolutionVote> {

    public List<ResolutionVote> findByResolution(Long resolutionId) {
        return list("resolution.id = ?1 order by votedAt", resolutionId);
    }

    public Optional<ResolutionVote> findByResolutionAndMember(Long resolutionId, Long memberId) {
        return find("resolution.id = ?1 and member.id = ?2", resolutionId, memberId).firstResultOptional();
    }

    public long countByResolutionAndChoice(Long resolutionId, VoteChoice choice) {
        return count("resolution.id = ?1 and choice = ?2", resolutionId, choice);
    }
}
